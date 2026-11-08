package com.pathwise.backend.dto;

import com.pathwise.backend.entity.Document;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardStatsDto {
    private long totalUploaded;
    private long completed;
    private long processing;
    private long failed;
    private long pendingVerification;
    private long approved;
    private long rejected;
    private long totalCourses;
    private long totalUniCodes;
    private long totalCutoffs;
    private long totalDistricts;
    private List<Document> recentDocuments;
}
