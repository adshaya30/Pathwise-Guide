package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AdvisorChatRequest;
import com.pathwise.backend.dto.AdvisorChatResponse;
import com.pathwise.backend.repository.HandbookChunkRepository;
import com.pathwise.backend.service.DocumentProcessingService;
import com.pathwise.backend.service.HybridAdvisorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/advisor")
@RequiredArgsConstructor
@CrossOrigin
public class AdvisorController {

    private final HybridAdvisorService hybridAdvisorService;
    private final DocumentProcessingService documentProcessingService;
    private final HandbookChunkRepository handbookChunkRepository;

    @PostMapping("/chat")
    public ResponseEntity<AdvisorChatResponse> chat(@RequestBody AdvisorChatRequest request) {
        AdvisorChatResponse response = hybridAdvisorService.askAdvisor(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/index/{documentId}")
    public ResponseEntity<Map<String, Object>> indexDocument(@PathVariable UUID documentId) {
        long chunksCreated = documentProcessingService.indexDocumentForRag(documentId);
        return ResponseEntity.ok(Map.of(
                "documentId", documentId,
                "status", "INDEXED",
                "chunksIndexed", chunksCreated,
                "message", "Handbook successfully indexed into pgvector for Hybrid RAG retrieval."
        ));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getRagStats() {
        long totalChunks = handbookChunkRepository.getTotalChunkCount();
        return ResponseEntity.ok(Map.of(
                "totalHandbookChunks", totalChunks,
                "vectorEngine", "pgvector (HNSW)",
                "embeddingModel", "text-embedding-004 (768-dim)",
                "ragStatus", totalChunks > 0 ? "ACTIVE" : "READY_FOR_DOCUMENTS"
        ));
    }
}
