package com.pathwise.backend.controller.admin;

import com.pathwise.backend.dto.BulkApproveRequest;
import com.pathwise.backend.dto.BulkApproveResponse;
import com.pathwise.backend.dto.BulkDeleteRequest;
import com.pathwise.backend.dto.BulkDeleteResponse;
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

        List<String> targetModules = null;
        if (moduleType != null && !moduleType.isBlank()) {
            if ("UNIVERSITY_COURSE".equalsIgnoreCase(moduleType) || "UNI_CODE".equalsIgnoreCase(moduleType)) {
                targetModules = List.of("UNIVERSITY_COURSE", "UNI_CODE");
            } else {
                targetModules = List.of(moduleType);
            }
        }

        if (status != null && !status.isBlank() && targetModules != null) {
            return ResponseEntity.ok(extractedRecordRepository.findByModuleTypeInAndStatusOrderByCreatedAtDesc(targetModules, status));
        } else if (status != null && !status.isBlank()) {
            return ResponseEntity.ok(extractedRecordRepository.findByStatusOrderByCreatedAtDesc(status));
        } else if (targetModules != null) {
            return ResponseEntity.ok(extractedRecordRepository.findByModuleTypeInOrderByCreatedAtDesc(targetModules));
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

    @PostMapping("/bulk-approve")
    public ResponseEntity<BulkApproveResponse> bulkApprove(
            @RequestBody(required = false) BulkApproveRequest request) {
        BulkApproveResponse response = reviewAndPublishService.bulkApprove(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ExtractedRecord> rejectRecord(
            @PathVariable UUID id,
            @RequestBody(required = false) RecordRejectRequest request) {
        ExtractedRecord rejected = reviewAndPublishService.rejectRecord(id, request);
        return ResponseEntity.ok(rejected);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecord(@PathVariable UUID id) {
        reviewAndPublishService.deleteRecord(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<BulkDeleteResponse> bulkDelete(
            @RequestBody(required = false) BulkDeleteRequest request) {
        BulkDeleteResponse response = reviewAndPublishService.bulkDelete(request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping
    public ResponseEntity<BulkDeleteResponse> deleteAll(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String moduleType) {
        BulkDeleteResponse response = reviewAndPublishService.bulkDelete(
                BulkDeleteRequest.builder().status(status).moduleType(moduleType).build());
        return ResponseEntity.ok(response);
    }
}

