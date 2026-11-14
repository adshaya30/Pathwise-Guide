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

        int totalExtracted = 0;

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
                try {
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
                    DocumentPage docPage = documentPageRepository.findByDocumentIdAndPageNumber(doc.getId(), pageNum)
                            .orElse(DocumentPage.builder()
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

                                String payloadJson = objectMapper.writeValueAsString(item);
                                ExtractedRecord record = ExtractedRecord.builder()
                                        .documentId(doc.getId())
                                        .pageNumber(pageNum)
                                        .moduleType(result.pageType)
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

                    // Update progress
                    int progress = 5 + (int) (((double) pageNum / numPages) * 90);
                    job.setProgressPercent(Math.min(95, progress));
                    job.setCurrentStep(String.format("Processed page %d of %d (%s)", pageNum, numPages, result.pageType));
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
            job.setCurrentStep(String.format("Completed extraction: %d items found", totalExtracted));
            job.setCompletedAt(OffsetDateTime.now());
            job.setTotalItemsExtracted(totalExtracted);
            extractionJobRepository.save(job);

            doc.setStatus("COMPLETED");
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

        // 2. Clean up previous staging records in PENDING status for this document so we don't accumulate duplicates
        try {
            extractedRecordRepository.deleteByDocumentIdAndStatus(doc.getId(), "PENDING");
        } catch (Exception ex) {
            log.warn("Could not clear pending extracted records for doc {}: {}", doc.getId(), ex.getMessage());
        }

        // 3. Immediately update doc state so frontend UI reflects reprocessing state
        doc.setStatus("PROCESSING");
        doc.setProcessedPages(0);
        doc.setErrorMessage(null);
        documentRepository.save(doc);

        ExtractionJob job = ExtractionJob.builder()
                .documentId(doc.getId())
                .status("QUEUED")
                .progressPercent(0)
                .currentStep("Queued for reprocessing")
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
}

