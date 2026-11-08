package com.pathwise.backend.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExtractionProgressDto {
    private UUID jobId;
    private UUID documentId;
    private String status;
    private Integer progressPercent;
    private String currentStep;
    private Integer totalItemsExtracted;
    private String errorMessage;
}

