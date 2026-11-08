package com.pathwise.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecordRejectRequest {
    private String reviewedBy;
    private String rejectionReason;
}

