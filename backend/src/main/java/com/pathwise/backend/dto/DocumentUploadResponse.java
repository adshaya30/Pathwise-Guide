package com.pathwise.backend.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentUploadResponse {
    private UUID documentId;
    private UUID jobId;
    private String title;
    private String academicYear;
    private String fileName;
    private String status;
    private String message;
}
