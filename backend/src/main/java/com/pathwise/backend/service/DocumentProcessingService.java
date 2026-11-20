package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.DocumentUploadResponse;
import com.pathwise.backend.entity.Document;
import com.pathwise.backend.entity.DocumentPage;
import com.pathwise.backend.entity.ExtractedRecord;
import com.pathwise.backend.entity.ExtractionJob;
import com.pathwise.backend.repository.DocumentPageRepository;
import com.pathwise.backend.repository.DocumentRepository;
import com.pathwise.backend.repository.ExtractedRecordRepository;
import com.pathwise.backend.repository.ExtractionJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentProcessingService {

    private final DocumentRepository documentRepository;
    private final ExtractionJobRepository extractionJobRepository;
    private final DocumentPageRepository documentPageRepository;
    private final ExtractedRecordRepository extractedRecordRepository;
    private final GeminiExtractionService geminiExtractionService;
    private final SupabaseStorageService supabaseStorageService;
    private final ObjectMapper objectMapper;
    private final GeminiEmbeddingService geminiEmbeddingService;
    private final com.pathwise.backend.repository.HandbookChunkRepository handbookChunkRepository;

    @Value("${pathwise.upload.dir:uploads/handbooks}")
    private String uploadDir;

    // Track cancelled job IDs in-memory
    private final Map<UUID, Boolean> cancelledJobs = new ConcurrentHashMap<>();

    public DocumentUploadResponse uploadDocument(MultipartFile file, String title, String academicYear) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot upload empty file.");
        }
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "handbook.pdf";
        if (!originalFilename.toLowerCase().endsWith(".pdf")) {
            throw new IllegalArgumentException("Only PDF files are supported.");
        }

        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String storedFileName = UUID.randomUUID() + "_" + originalFilename;
        Path targetPath = uploadPath.resolve(storedFileName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        File pdfFile = targetPath.toFile();
        int totalPages = 0;
        try (PDDocument doc = Loader.loadPDF(pdfFile)) {
            totalPages = doc.getNumberOfPages();
        }

        byte[] fileBytes = file.getBytes();
        Optional<String> supabaseUrlOpt = supabaseStorageService.uploadPdf(storedFileName, fileBytes);

        Document document = Document.builder()
                .title(title != null && !title.isBlank() ? title.trim() : originalFilename)
                .academicYear(academicYear != null && !academicYear.isBlank() ? academicYear.trim() : "")
                .fileName(originalFilename)
                .fileSize(file.getSize())
                .fileType(file.getContentType() != null ? file.getContentType() : "application/pdf")
                .storagePath(targetPath.toAbsolutePath().toString())
                .storageUrl(supabaseUrlOpt.orElse(null))
                .totalPages(totalPages)
                .processedPages(0)
                .status("UPLOADED")
                .build();

        Document savedDoc = documentRepository.save(document);

        ExtractionJob job = ExtractionJob.builder()
                .documentId(savedDoc.getId())
                .status("QUEUED")
                .progressPercent(0)
                .currentStep("Queued for processing")
                .startedAt(OffsetDateTime.now())
                .build();

        ExtractionJob savedJob = extractionJobRepository.save(job);

        return DocumentUploadResponse.builder()
                .documentId(savedDoc.getId())
                .jobId(savedJob.getId())
                .title(savedDoc.getTitle())
                .academicYear(savedDoc.getAcademicYear())
                .fileName(savedDoc.getFileName())
                .storageUrl(savedDoc.getStorageUrl())
                .status("QUEUED")
                .message("File uploaded successfully. Background extraction queued.")
                .build();
    }

    @Async("documentTaskExecutor")
    public void processDocumentAsync(UUID documentId, UUID jobId) {
        log.info("Starting async background extraction for document: {}, job: {}", documentId, jobId);

        Document doc = documentRepository.findById(documentId).orElse(null);
        ExtractionJob job = extractionJobRepository.findById(jobId).orElse(null);
        if (doc == null || job == null) {
            log.error("Document or job not found for async processing.");
            return;
        }

        doc.setStatus("PROCESSING");
        documentRepository.save(doc);

        job.setStatus("PROCESSING");
        job.setCurrentStep("Opening PDF document");
        job.setProgressPercent(5);
        extractionJobRepository.save(job);

        File pdfFile = resolvePdfFile(doc);
        if (pdfFile == null || !pdfFile.exists()) {
            String errorMsg = "PDF file not found at " + doc.getStoragePath() + ". Please re-upload the handbook.";
            job.setStatus("FAILED");
            job.setErrorMessage(errorMsg);
            job.setCompletedAt(OffsetDateTime.now());
            extractionJobRepository.save(job);
            doc.setStatus("FAILED");
            doc.setErrorMessage(errorMsg);
            documentRepository.save(doc);
            return;
        }

        if (!pdfFile.getAbsolutePath().equals(doc.getStoragePath())) {
            doc.setStoragePath(pdfFile.getAbsolutePath());
            documentRepository.save(doc);
        }

        int totalExtracted = (int) extractedRecordRepository.countByDocumentId(doc.getId());

        try (PDDocument pdDoc = Loader.loadPDF(pdfFile)) {
            int numPages = pdDoc.getNumberOfPages();
            doc.setTotalPages(numPages);
            documentRepository.save(doc);

            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            PDFRenderer renderer = new PDFRenderer(pdDoc);

            for (int p = 1; p <= numPages; p++) {
                if (Boolean.TRUE.equals(cancelledJobs.get(jobId))) {
                    job.setStatus("CANCELLED");
                    job.setCurrentStep("Cancelled by administrator");
                    job.setCompletedAt(OffsetDateTime.now());
                    extractionJobRepository.save(job);
                    doc.setStatus("CANCELLED");
                    doc.setErrorMessage("Extraction was cancelled by administrator.");
                    documentRepository.save(doc);
                    cancelledJobs.remove(jobId);
                    log.info("Job {} was cancelled by administrator.", jobId);
                    return;
                }

                final int pageNum = p;

                // Incremental Check: Only reprocess missing data, skip already processed pages!
                Optional<DocumentPage> existingPageOpt = documentPageRepository.findByDocumentIdAndPageNumber(doc.getId(), pageNum);
                boolean isAlreadyProcessed = existingPageOpt.isPresent()
                        && "PROCESSED".equalsIgnoreCase(existingPageOpt.get().getStatus())
                        && existingPageOpt.get().getRawText() != null
                        && !existingPageOpt.get().getRawText().isBlank();

                if (isAlreadyProcessed) {
                    DocumentPage existingPage = existingPageOpt.get();
                    log.info("Page {} of document {} is already processed (type: {}). Skipping re-extraction.",
                            pageNum, doc.getId(), existingPage.getPageType());

                    int progress = 5 + (int) (((double) pageNum / numPages) * 90);
                    job.setProgressPercent(Math.min(95, progress));
                    job.setCurrentStep(String.format("Skipping already processed page %d of %d (%s)", pageNum, numPages, existingPage.getPageType()));
                    job.setTotalItemsExtracted(totalExtracted);
                    extractionJobRepository.save(job);

                    doc.setProcessedPages(pageNum);
                    documentRepository.save(doc);
                    continue;
                }

                // If missing or failed, process only this page!
                try {
                    // If retrying a failed page, remove any stale pending records for this specific page
                    try {
                        extractedRecordRepository.deleteByDocumentIdAndPageNumberAndStatus(doc.getId(), pageNum, "PENDING");
                    } catch (Exception ex) {
                        log.warn("Could not clear pending records for doc {} page {}: {}", doc.getId(), pageNum, ex.getMessage());
                    }

                    stripper.setStartPage(pageNum);
                    stripper.setEndPage(pageNum);
                    String pageText = stripper.getText(pdDoc);

                    String base64Image = null;
                    try {
                        BufferedImage image = renderer.renderImageWithDPI(pageNum - 1, 140, ImageType.RGB);
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        ImageIO.write(image, "PNG", baos);
                        base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());
                    } catch (Exception imgEx) {
                        log.warn("Could not render page {} to image: {}", pageNum, imgEx.getMessage());
                    }

                    // Save or update DocumentPage
                    DocumentPage docPage = existingPageOpt.orElse(DocumentPage.builder()
                            .documentId(doc.getId())
                            .pageNumber(pageNum)
                            .build());

                    docPage.setRawText(pageText);

                    // Call Gemini extraction service using Vision + Text
                    GeminiExtractionService.ExtractionResult result =
                            geminiExtractionService.extractFromPage(base64Image, pageText, pageNum);

                    docPage.setPageType(result.pageType);
                    docPage.setExtractedJson(result.rawJson);
                    docPage.setStatus("PROCESSED");
                    docPage.setErrorMessage(null);
                    documentPageRepository.save(docPage);

                    // If items were extracted, stage them in extracted_records
                    if (result.items != null && !result.items.isEmpty()) {
                        for (Map<String, Object> item : result.items) {
                            try {
                                String validationNotes = null;
                                if (item.containsKey("validationNotes") && item.get("validationNotes") != null) {
                                    validationNotes = item.get("validationNotes").toString();
                                } else if ("CUTOFF".equalsIgnoreCase(result.pageType)) {
                                    validationNotes = GeminiExtractionService.validateCutoffDistricts(item);
                                }

                                // If CUTOFF, ensure the academic year reflects the prior year's cutoffs published in this handbook
                                if ("CUTOFF".equalsIgnoreCase(result.pageType)) {
                                    String cutoffYear = deriveCutoffAcademicYear(doc.getAcademicYear());
                                    if (cutoffYear != null && !cutoffYear.isBlank()) {
                                        item.put("academicYear", cutoffYear);
                                    }
                                    if (doc.getAcademicYear() != null && !doc.getAcademicYear().isBlank()) {
                                        item.put("handbookAcademicYear", doc.getAcademicYear());
                                    }
                                }

                                String itemModuleType = item.containsKey("moduleType") && item.get("moduleType") != null
                                        ? item.get("moduleType").toString()
                                        : result.pageType;
                                String payloadJson = objectMapper.writeValueAsString(item);
                                ExtractedRecord record = ExtractedRecord.builder()
                                        .documentId(doc.getId())
                                        .pageNumber(pageNum)
                                        .moduleType(itemModuleType)
                                        .status("PENDING")
                                        .rawPayload(payloadJson)
                                        .validationNotes(validationNotes)
                                        .build();
                                extractedRecordRepository.save(record);
                                totalExtracted++;
                            } catch (Exception err) {
                                log.warn("Failed to serialize extracted item on page {}: {}", pageNum, err.getMessage());
                            }
                        }
                    }

                    // Hybrid RAG: Index narrative policy text, guidelines, and bylaws into handbook_chunks
                    indexPageTextForRag(doc.getId(), pageNum, pageText, result.pageType);

                    // Update progress
                    int progress = 5 + (int) (((double) pageNum / numPages) * 90);
                    job.setProgressPercent(Math.min(95, progress));
                    job.setCurrentStep(String.format("Processed missing page %d of %d (%s)", pageNum, numPages, result.pageType));
                    job.setTotalItemsExtracted(totalExtracted);
                    extractionJobRepository.save(job);

                    doc.setProcessedPages(pageNum);
                    documentRepository.save(doc);

                } catch (Exception pageEx) {
                    log.error("Non-fatal error processing page {} of document {}: {}", pageNum, doc.getId(), pageEx.getMessage(), pageEx);
                    try {
                        DocumentPage failedPage = documentPageRepository.findByDocumentIdAndPageNumber(doc.getId(), pageNum)
                                .orElse(DocumentPage.builder()
                                        .documentId(doc.getId())
                                        .pageNumber(pageNum)
                                        .build());
                        failedPage.setStatus("FAILED");
                        failedPage.setErrorMessage(pageEx.getMessage());
                        documentPageRepository.save(failedPage);
                    } catch (Exception ignored) {}

                    // Advance progress even if individual page had non-fatal error so extraction does not stall
                    int progress = 5 + (int) (((double) pageNum / numPages) * 90);
                    job.setProgressPercent(Math.min(95, progress));
                    job.setCurrentStep(String.format("Processed page %d of %d (partial)", pageNum, numPages));
                    extractionJobRepository.save(job);

                    doc.setProcessedPages(pageNum);
                    documentRepository.save(doc);
                }
            }

            // Completed successfully
            job.setStatus("COMPLETED");
            job.setProgressPercent(100);
            job.setCurrentStep(String.format("Completed extraction: %d total items staged", totalExtracted));
            job.setCompletedAt(OffsetDateTime.now());
            job.setTotalItemsExtracted(totalExtracted);
            extractionJobRepository.save(job);

            doc.setStatus("COMPLETED");
            doc.setProcessedPages(numPages);
            documentRepository.save(doc);
            log.info("Async extraction finished successfully for document {}. Total items: {}", documentId, totalExtracted);

        } catch (Exception e) {
            log.error("Error during document processing: {}", e.getMessage(), e);
            job.setStatus("FAILED");
            job.setErrorMessage(e.getMessage());
            job.setCompletedAt(OffsetDateTime.now());
            extractionJobRepository.save(job);

            doc.setStatus("FAILED");
            doc.setErrorMessage(e.getMessage());
            documentRepository.save(doc);
        }
    }

    public void cancelJob(UUID jobId) {
        ExtractionJob job = extractionJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
        if ("PROCESSING".equals(job.getStatus()) || "QUEUED".equals(job.getStatus())) {
            cancelledJobs.put(jobId, true);
            job.setStatus("CANCELLED");
            job.setCurrentStep("Cancellation requested by administrator");
            job.setCompletedAt(OffsetDateTime.now());
            extractionJobRepository.save(job);

            documentRepository.findById(job.getDocumentId()).ifPresent(doc -> {
                doc.setStatus("CANCELLED");
                doc.setErrorMessage("Extraction was cancelled by administrator.");
                documentRepository.save(doc);
            });
        }
    }

    @Transactional
    public ExtractionJob reprocessDocument(UUID documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        // 1. Cancel any active jobs for this document
        List<ExtractionJob> existingJobs = extractionJobRepository.findByDocumentIdOrderByCreatedAtDesc(documentId);
        for (ExtractionJob j : existingJobs) {
            if ("PROCESSING".equalsIgnoreCase(j.getStatus()) || "QUEUED".equalsIgnoreCase(j.getStatus())) {
                cancelledJobs.put(j.getId(), true);
                j.setStatus("CANCELLED");
                j.setCompletedAt(OffsetDateTime.now());
                extractionJobRepository.save(j);
            }
        }

        // 2. Incremental Reprocessing:
        // Do NOT delete all pending records or reset processedPages to 0!
        // We only reprocess missing or failed data ("only reprocess missing data not at all").
        long processedCount = documentPageRepository.countByDocumentIdAndStatus(doc.getId(), "PROCESSED");
        int totalPages = doc.getTotalPages() != null && doc.getTotalPages() > 0 ? doc.getTotalPages() : 210;
        int progress = (int) (((double) processedCount / totalPages) * 90) + 5;
        if (progress > 95) progress = 95;

        // 3. Update doc state so frontend UI reflects reprocessing state with current progress
        doc.setStatus("PROCESSING");
        doc.setProcessedPages((int) processedCount);
        doc.setErrorMessage(null);
        documentRepository.save(doc);

        ExtractionJob job = ExtractionJob.builder()
                .documentId(doc.getId())
                .status("QUEUED")
                .progressPercent(progress)
                .currentStep(String.format("Resuming incremental extraction (already processed %d of %d pages)", processedCount, totalPages))
                .startedAt(OffsetDateTime.now())
                .build();

        ExtractionJob savedJob = extractionJobRepository.save(job);
        cancelledJobs.remove(savedJob.getId());
        return savedJob;
    }

    /**
     * Cleans up orphaned jobs and documents left in PROCESSING or QUEUED state on server restart.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void recoverOrphanedJobs() {
        log.info("Checking for orphaned extraction jobs from previous application sessions...");
        try {
            List<ExtractionJob> allJobs = extractionJobRepository.findAll();
            for (ExtractionJob j : allJobs) {
                if ("PROCESSING".equalsIgnoreCase(j.getStatus()) || "QUEUED".equalsIgnoreCase(j.getStatus())) {
                    j.setStatus("FAILED");
                    j.setErrorMessage("Extraction was interrupted by server restart. Please click Reprocess.");
                    j.setCompletedAt(OffsetDateTime.now());
                    extractionJobRepository.save(j);
                    log.warn("Recovered orphaned job {} -> marked as FAILED", j.getId());
                }
            }

            List<Document> allDocs = documentRepository.findAll();
            for (Document d : allDocs) {
                if ("PROCESSING".equalsIgnoreCase(d.getStatus()) || "QUEUED".equalsIgnoreCase(d.getStatus())) {
                    d.setStatus("FAILED");
                    d.setErrorMessage("Extraction was interrupted by server restart. Please click Reprocess.");
                    documentRepository.save(d);
                    log.warn("Recovered orphaned document {} -> marked as FAILED", d.getId());
                }
            }
        } catch (Exception e) {
            log.warn("Could not check/recover orphaned extraction jobs: {}", e.getMessage());
        }
    }

    private File resolvePdfFile(Document doc) {
        if (doc == null) return null;

        // 1. Check exact storage path
        if (doc.getStoragePath() != null && !doc.getStoragePath().isBlank()) {
            File f = new File(doc.getStoragePath());
            if (f.exists() && f.isFile()) return f;

            String baseName = f.getName();

            // 2. Check in configured uploadDir
            try {
                Path inUploadDir = Paths.get(uploadDir, baseName);
                if (Files.exists(inUploadDir) && Files.isRegularFile(inUploadDir)) {
                    return inUploadDir.toFile();
                }
            } catch (Exception ignored) {}

            // 3. Check in /app/uploads
            try {
                Path inApp = Paths.get("/app/uploads", baseName);
                if (Files.exists(inApp) && Files.isRegularFile(inApp)) {
                    return inApp.toFile();
                }
            } catch (Exception ignored) {}

            // 4. Check in /tmp/uploads/handbooks
            try {
                Path inTmp = Paths.get("/tmp/uploads/handbooks", baseName);
                if (Files.exists(inTmp) && Files.isRegularFile(inTmp)) {
                    return inTmp.toFile();
                }
            } catch (Exception ignored) {}
        }

        // 5. Check by original fileName in directories
        if (doc.getFileName() != null && !doc.getFileName().isBlank()) {
            String orig = doc.getFileName();
            try {
                Path p1 = Paths.get(uploadDir, orig);
                if (Files.exists(p1) && Files.isRegularFile(p1)) return p1.toFile();
                Path p2 = Paths.get("/tmp/uploads/handbooks", orig);
                if (Files.exists(p2) && Files.isRegularFile(p2)) return p2.toFile();
                Path p3 = Paths.get("/app/uploads", orig);
                if (Files.exists(p3) && Files.isRegularFile(p3)) return p3.toFile();
                String userHome = System.getProperty("user.home");
                if (userHome != null) {
                    Path p4 = Paths.get(userHome, "Downloads", orig);
                    if (Files.exists(p4) && Files.isRegularFile(p4)) return p4.toFile();
                }
                Path p5 = Paths.get("uploads", orig);
                if (Files.exists(p5) && Files.isRegularFile(p5)) return p5.toFile();
            } catch (Exception ignored) {}
        }

        return null;
    }

    /**
     * Derives the prior academic year for Minimum Z-Scores published in a handbook.
     * E.g. Handbook Academic Year 2023/2024 contains cutoffs based on Academic Year 2022/2023.
     */
    public static String deriveCutoffAcademicYear(String handbookAcademicYear) {
        if (handbookAcademicYear == null || handbookAcademicYear.isBlank()) {
            return "";
        }
        Pattern p = Pattern.compile("(\\d{4})\\s*/\\s*(\\d{4})");
        Matcher m = p.matcher(handbookAcademicYear.trim());
        if (m.find()) {
            int startYear = Integer.parseInt(m.group(1));
            int endYear = Integer.parseInt(m.group(2));
            return (startYear - 1) + "/" + (endYear - 1);
        }
        Pattern pSingle = Pattern.compile("(\\d{4})");
        Matcher mSingle = pSingle.matcher(handbookAcademicYear.trim());
        if (mSingle.find()) {
            int year = Integer.parseInt(mSingle.group(1));
            return (year - 1) + "/" + year;
        }
        return handbookAcademicYear.trim();
    }

    /**
     * Hybrid RAG: Chunks and embeds narrative text pages (general policies, admission rules, footnotes).
     * Excludes dense Cutoff tables which are already structured into SQL tables.
     */
    public void indexPageTextForRag(UUID documentId, int pageNumber, String pageText, String pageType) {
        if (pageText == null || pageText.isBlank() || "CUTOFF".equalsIgnoreCase(pageType)) {
            return;
        }

        try {
            // Split page text into semantic paragraphs (delimited by blank lines or headers)
            String[] rawParagraphs = pageText.split("\\n\\s*\\n");
            for (String rawPara : rawParagraphs) {
                String clean = rawPara.replaceAll("\\s+", " ").trim();
                if (clean.length() < 60) {
                    continue; // Skip single header lines or noise
                }

                // Identify potential chapter / section title
                String sectionTitle = "Page " + pageNumber + " Policy Guidance";
                String[] lines = rawPara.trim().split("\\r?\\n");
                if (lines.length > 0 && lines[0].trim().length() < 100) {
                    String candidate = lines[0].trim().replaceAll("[^A-Za-z0-9 .:-]", "");
                    if (!candidate.isBlank()) {
                        sectionTitle = candidate;
                    }
                }

                // If paragraph is very long, chunk it into ~700 char segments
                int chunkSize = 700;
                for (int start = 0; start < clean.length(); start += chunkSize - 100) {
                    int end = Math.min(start + chunkSize, clean.length());
                    String chunkContent = clean.substring(start, end).trim();
                    if (chunkContent.length() < 50) continue;

                    String embeddingVector = geminiEmbeddingService.generateEmbeddingString(chunkContent);
                    if (embeddingVector != null && !embeddingVector.isBlank()) {
                        handbookChunkRepository.insertChunk(documentId, pageNumber, sectionTitle, chunkContent, embeddingVector);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Non-fatal notice during RAG indexing for doc {} page {}: {}", documentId, pageNumber, e.getMessage());
        }
    }

    /**
     * Manually index or re-index all pages of an existing document for RAG.
     */
    public long indexDocumentForRag(UUID documentId) {
        List<DocumentPage> pages = documentPageRepository.findByDocumentIdOrderByPageNumberAsc(documentId);
        handbookChunkRepository.deleteByDocumentId(documentId);
        long count = 0;
        for (DocumentPage p : pages) {
            if (p.getRawText() != null && !p.getRawText().isBlank() && !"CUTOFF".equalsIgnoreCase(p.getPageType())) {
                indexPageTextForRag(documentId, p.getPageNumber(), p.getRawText(), p.getPageType());
                count++;
            }
        }
        log.info("RAG indexing completed for document {}: {} pages processed.", documentId, count);
        return handbookChunkRepository.countByDocumentId(documentId);
    }
}

