package com.pathwise.backend.dto;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkApproveRequest {
    private List<UUID> recordIds;
    private String moduleType;
    private String reviewedBy;
}

