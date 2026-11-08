package com.pathwise.backend.service;

import com.pathwise.backend.dto.DashboardStatsDto;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final DocumentRepository documentRepository;
    private final ExtractionJobRepository extractionJobRepository;
    private final ExtractedRecordRepository extractedRecordRepository;
    private final CourseRepository courseRepository;
    private final UniCodeRepository uniCodeRepository;
    private final CutoffRepository cutoffRepository;
    private final DistrictRepository districtRepository;

    public DashboardStatsDto getDashboardStats() {
        long totalUploaded = documentRepository.count();
        long completed = documentRepository.countByStatus("COMPLETED");
        long processing = documentRepository.countByStatus("PROCESSING");
        long failed = documentRepository.countByStatus("FAILED");

        long pendingVerification = extractedRecordRepository.countByStatus("PENDING");
        long approved = extractedRecordRepository.countByStatus("APPROVED");
        long rejected = extractedRecordRepository.countByStatus("REJECTED");

        long totalCourses = courseRepository.count();
        long totalUniCodes = uniCodeRepository.count();
        long totalCutoffs = cutoffRepository.count();
        long totalDistricts = districtRepository.count();

        var recentDocuments = documentRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .limit(5)
                .toList();

        return DashboardStatsDto.builder()
                .totalUploaded(totalUploaded)
                .completed(completed)
                .processing(processing)
                .failed(failed)
                .pendingVerification(pendingVerification)
                .approved(approved)
                .rejected(rejected)
                .totalCourses(totalCourses)
                .totalUniCodes(totalUniCodes)
                .totalCutoffs(totalCutoffs)
                .totalDistricts(totalDistricts)
                .recentDocuments(recentDocuments)
                .build();
    }
}
