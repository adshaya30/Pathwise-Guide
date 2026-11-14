package com.pathwise.backend.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkApproveResponse {
    private int totalRequested;
    private int approvedCount;
    private int failedCount;
    private List<String> errors;
}

