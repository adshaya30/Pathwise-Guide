package com.pathwise.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdvisorChatResponse {
    private String answer;
    private List<Integer> citedPages;
    private List<String> citedSections;
    private int structuredMatchesCount;
    private int ragChunksCount;
    private List<Map<String, Object>> structuredDataPreview;
}
