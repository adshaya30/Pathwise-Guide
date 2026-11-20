package com.pathwise.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdvisorChatRequest {
    private String question;
    private String district;
    private Double zScore;
    private String stream;
    private String academicYear;
}
