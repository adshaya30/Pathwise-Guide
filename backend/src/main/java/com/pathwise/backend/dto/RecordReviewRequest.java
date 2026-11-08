package com.pathwise.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecordReviewRequest {
    private String reviewedBy;
    private String validationNotes;
    private String rawPayload; // optional edited payload before approving
}

