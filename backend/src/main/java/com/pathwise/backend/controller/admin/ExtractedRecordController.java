package com.pathwise.backend.controller.admin;

import com.pathwise.backend.dto.RecordRejectRequest;
import com.pathwise.backend.dto.RecordReviewRequest;
import com.pathwise.backend.entity.ExtractedRecord;
import com.pathwise.backend.repository.ExtractedRecordRepository;
import com.pathwise.backend.service.ReviewAndPublishService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/extracted-records")
@RequiredArgsConstructor
@CrossOrigin
public class ExtractedRecordController {

    private final ExtractedRecordRepository extractedRecordRepository;
    private final ReviewAndPublishService reviewAndPublishService;

    @GetMapping
    public ResponseEntity<List<ExtractedRecord>> listRecords(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String moduleType) {

        if (status != null && !status.isBlank() && moduleType != null && !moduleType.isBlank()) {
            return ResponseEntity.ok(extractedRecordRepository.findByModuleTypeAndStatusOrderByCreatedAtDesc(moduleType, status));
        } else if (status != null && !status.isBlank()) {
            return ResponseEntity.ok(extractedRecordRepository.findByStatusOrderByCreatedAtDesc(status));
        } else if (moduleType != null && !moduleType.isBlank()) {
            return ResponseEntity.ok(extractedRecordRepository.findByModuleTypeOrderByCreatedAtDesc(moduleType));
        }
        return ResponseEntity.ok(extractedRecordRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ExtractedRecord> getRecord(@PathVariable UUID id) {
        return extractedRecordRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExtractedRecord> updateRecord(
            @PathVariable UUID id,
            @RequestBody RecordReviewRequest request) {
        ExtractedRecord updated = reviewAndPublishService.updateRecordPayload(id, request.getRawPayload(), request.getValidationNotes());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ExtractedRecord> approveRecord(
            @PathVariable UUID id,
            @RequestBody(required = false) RecordReviewRequest request) {
        ExtractedRecord approved = reviewAndPublishService.approveAndPublish(id, request);
        return ResponseEntity.ok(approved);
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ExtractedRecord> rejectRecord(
            @PathVariable UUID id,
            @RequestBody(required = false) RecordRejectRequest request) {
        ExtractedRecord rejected = reviewAndPublishService.rejectRecord(id, request);
        return ResponseEntity.ok(rejected);
    }
}

