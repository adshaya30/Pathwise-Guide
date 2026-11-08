package com.pathwise.backend.controller;

import com.pathwise.backend.dto.DocumentUploadResponse;
import com.pathwise.backend.dto.ExtractionProgressDto;
import com.pathwise.backend.entity.Document;
import com.pathwise.backend.entity.DocumentPage;
import com.pathwise.backend.entity.ExtractionJob;
import com.pathwise.backend.repository.DocumentPageRepository;
import com.pathwise.backend.repository.DocumentRepository;
import com.pathwise.backend.repository.ExtractionJobRepository;
import com.pathwise.backend.service.DocumentProcessingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/documents")
@RequiredArgsConstructor
@CrossOrigin
@Slf4j
public class DocumentController {

    private final DocumentRepository documentRepository;
    private final ExtractionJobRepository extractionJobRepository;
    private final DocumentPageRepository documentPageRepository;
    private final DocumentProcessingService documentProcessingService;

    @GetMapping
    public ResponseEntity<List<Document>> listDocuments() {
        return ResponseEntity.ok(documentRepository.findAllByOrderByCreatedAtDesc());
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentUploadResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "academicYear", required = false) String academicYear) throws IOException {

        DocumentUploadResponse response = documentProcessingService.uploadDocument(file, title, academicYear);
        // Start background extraction
        documentProcessingService.processDocumentAsync(response.getDocumentId(), response.getJobId());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable UUID id) {
        return documentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pages")
    public ResponseEntity<List<DocumentPage>> getDocumentPages(@PathVariable UUID id) {
        return ResponseEntity.ok(documentPageRepository.findByDocumentIdOrderByPageNumberAsc(id));
    }

    @GetMapping("/{id}/jobs")
    public ResponseEntity<List<ExtractionJob>> getDocumentJobs(@PathVariable UUID id) {
        return ResponseEntity.ok(extractionJobRepository.findByDocumentIdOrderByCreatedAtDesc(id));
    }

    @GetMapping("/jobs/{jobId}/progress")
    public ResponseEntity<ExtractionProgressDto> getJobProgress(@PathVariable UUID jobId) {
        return extractionJobRepository.findById(jobId)
                .map(job -> ResponseEntity.ok(ExtractionProgressDto.builder()
                        .jobId(job.getId())
                        .documentId(job.getDocumentId())
                        .status(job.getStatus())
                        .progressPercent(job.getProgressPercent())
                        .currentStep(job.getCurrentStep())
                        .totalItemsExtracted(job.getTotalItemsExtracted())
                        .errorMessage(job.getErrorMessage())
                        .build()))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/jobs/{jobId}/cancel")
    public ResponseEntity<Void> cancelJob(@PathVariable UUID jobId) {
        documentProcessingService.cancelJob(jobId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/reprocess")
    public ResponseEntity<ExtractionJob> reprocessDocument(@PathVariable UUID id) {
        ExtractionJob job = documentProcessingService.reprocessDocument(id);
        return ResponseEntity.ok(job);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable UUID id) {
        documentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
