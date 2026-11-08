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
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentProcessingService {

    private final DocumentRepository documentRepository;
    private final ExtractionJobRepository extractionJobRepository;
    private final DocumentPageRepository documentPageRepository;
    private final ExtractedRecordRepository extractedRecordRepository;
    private final GeminiExtractionService geminiExtractionService;
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

        Document document = Document.builder()
                .title(title != null && !title.isBlank() ? title : originalFilename)
                .academicYear(academicYear != null && !academicYear.isBlank() ? academicYear : "2023/2024")
                .fileName(originalFilename)
                .fileSize(file.getSize())
                .fileType(file.getContentType() != null ? file.getContentType() : "application/pdf")
                .storagePath(targetPath.toAbsolutePath().toString())
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

        File pdfFile = new File(doc.getStoragePath());
        if (!pdfFile.exists()) {
            job.setStatus("FAILED");
            job.setErrorMessage("PDF file not found at " + doc.getStoragePath());
            job.setCompletedAt(OffsetDateTime.now());
            extractionJobRepository.save(job);
            doc.setStatus("FAILED");
            documentRepository.save(doc);
            return;
        }

        int totalExtracted = 0;

        try (PDDocument pdDoc = Loader.loadPDF(pdfFile)) {
            int numPages = pdDoc.getNumberOfPages();
            doc.setTotalPages(numPages);
            documentRepository.save(doc);

            PDFTextStripper stripper = new PDFTextStripper();

            for (int p = 1; p <= numPages; p++) {
                if (Boolean.TRUE.equals(cancelledJobs.get(jobId))) {
                    job.setStatus("CANCELLED");
                    job.setCurrentStep("Cancelled by administrator");
                    job.setCompletedAt(OffsetDateTime.now());
                    extractionJobRepository.save(job);
                    doc.setStatus("CANCELLED");
                    documentRepository.save(doc);
                    cancelledJobs.remove(jobId);
                    log.info("Job {} was cancelled by administrator.", jobId);
                    return;
                }

                stripper.setStartPage(p);
                stripper.setEndPage(p);
                String pageText = stripper.getText(pdDoc);

                // Save or update DocumentPage
                final int pageNum = p;
                DocumentPage docPage = documentPageRepository.findByDocumentIdAndPageNumber(doc.getId(), pageNum)
                        .orElse(DocumentPage.builder()
                                .documentId(doc.getId())
                                .pageNumber(pageNum)
                                .build());

                docPage.setRawText(pageText);

                // Call Gemini extraction service
                GeminiExtractionService.ExtractionResult result =
                        geminiExtractionService.extractFromPageText(pageText, pageNum);

                docPage.setPageType(result.pageType);
                docPage.setExtractedJson(result.rawJson);
                docPage.setStatus("PROCESSED");
                documentPageRepository.save(docPage);

                // If items were extracted, stage them in extracted_records
                if (result.items != null && !result.items.isEmpty()) {
                    for (Map<String, Object> item : result.items) {
                        try {
                            String payloadJson = objectMapper.writeValueAsString(item);
                            ExtractedRecord record = ExtractedRecord.builder()
                                    .documentId(doc.getId())
                                    .pageNumber(pageNum)
                                    .moduleType(result.pageType)
                                    .status("PENDING")
                                    .rawPayload(payloadJson)
                                    .build();
                            extractedRecordRepository.save(record);
                            totalExtracted++;
                        } catch (Exception err) {
                            log.warn("Failed to serialize extracted item: {}", err.getMessage());
                        }
                    }
                }

                // Update progress
                int progress = 5 + (int) (((double) p / numPages) * 90);
                job.setProgressPercent(Math.min(95, progress));
                job.setCurrentStep(String.format("Processed page %d of %d (%s)", p, numPages, result.pageType));
                job.setTotalItemsExtracted(totalExtracted);
                extractionJobRepository.save(job);

                doc.setProcessedPages(p);
                documentRepository.save(doc);
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
            job.setCurrentStep("Cancellation requested");
            extractionJobRepository.save(job);
        }
    }

    public ExtractionJob reprocessDocument(UUID documentId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found: " + documentId));

        ExtractionJob job = ExtractionJob.builder()
                .documentId(doc.getId())
                .status("QUEUED")
                .progressPercent(0)
                .currentStep("Queued for reprocessing")
                .startedAt(OffsetDateTime.now())
                .build();

        ExtractionJob savedJob = extractionJobRepository.save(job);
        processDocumentAsync(doc.getId(), savedJob.getId());
        return savedJob;
    }
}

