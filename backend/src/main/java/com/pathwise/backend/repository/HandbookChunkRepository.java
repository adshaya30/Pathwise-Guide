package com.pathwise.backend.repository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
@RequiredArgsConstructor
@Slf4j
public class HandbookChunkRepository {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Inserts a text chunk and its vector embedding into handbook_chunks.
     */
    public UUID insertChunk(UUID documentId, int pageNumber, String sectionTitle, String content, String embeddingVector) {
        UUID id = UUID.randomUUID();
        String sql = """
            INSERT INTO handbook_chunks (id, document_id, page_number, section_title, content, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, cast(? as vector), CURRENT_TIMESTAMP)
            """;

        jdbcTemplate.update(sql, id, documentId, pageNumber, sectionTitle, content, embeddingVector);
        return id;
    }

    /**
     * Performs cosine distance similarity search using pgvector (<=> operator).
     * Returns list of top-K matching chunks with pageNumber, sectionTitle, content, and similarity score.
     */
    public List<Map<String, Object>> findSimilarChunks(String embeddingVector, int topK, double minSimilarity) {
        if (embeddingVector == null || embeddingVector.isBlank()) {
            return Collections.emptyList();
        }

        String sql = """
            SELECT 
                id,
                document_id AS documentId,
                page_number AS pageNumber,
                section_title AS sectionTitle,
                content,
                (1 - (embedding <=> cast(? as vector))) AS similarityScore
            FROM handbook_chunks
            WHERE (1 - (embedding <=> cast(? as vector))) >= ?
            ORDER BY embedding <=> cast(? as vector)
            LIMIT ?
            """;

        try {
            return jdbcTemplate.query(sql, (rs, rowNum) -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", rs.getObject("id", UUID.class));
                map.put("documentId", rs.getObject("documentId", UUID.class));
                map.put("pageNumber", rs.getInt("pageNumber"));
                map.put("sectionTitle", rs.getString("sectionTitle"));
                map.put("content", rs.getString("content"));
                map.put("similarityScore", rs.getDouble("similarityScore"));
                return map;
            }, embeddingVector, embeddingVector, minSimilarity, embeddingVector, topK);
        } catch (Exception e) {
            log.error("Failed to execute vector similarity search: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public int deleteByDocumentId(UUID documentId) {
        String sql = "DELETE FROM handbook_chunks WHERE document_id = ?";
        return jdbcTemplate.update(sql, documentId);
    }

    public long countByDocumentId(UUID documentId) {
        String sql = "SELECT COUNT(*) FROM handbook_chunks WHERE document_id = ?";
        Long count = jdbcTemplate.queryForObject(sql, Long.class, documentId);
        return count != null ? count : 0;
    }

    public long getTotalChunkCount() {
        try {
            String sql = "SELECT COUNT(*) FROM handbook_chunks";
            Long count = jdbcTemplate.queryForObject(sql, Long.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
