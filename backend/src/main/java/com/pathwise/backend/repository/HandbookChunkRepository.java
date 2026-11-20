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

    /**
     * Text-based fallback search directly querying document_pages and handbook_chunks.
     * Ensures RAG continues to work even if vector embeddings are unavailable or not yet generated.
     */
    public List<Map<String, Object>> searchHandbookText(String query, int topK) {
        if (query == null || query.isBlank()) {
            return Collections.emptyList();
        }

        String[] terms = query.toLowerCase().replaceAll("[^a-z0-9 ]", "").split("\\s+");
        List<String> validTerms = Arrays.stream(terms)
                .filter(t -> t.length() >= 3)
                .filter(t -> !List.of("the", "and", "for", "what", "are", "how", "can", "with", "from", "this", "that").contains(t))
                .limit(4)
                .toList();

        if (validTerms.isEmpty()) {
            return Collections.emptyList();
        }

        StringBuilder whereClause = new StringBuilder();
        List<Object> params = new ArrayList<>();
        for (int i = 0; i < validTerms.size(); i++) {
            if (i > 0) whereClause.append(" OR ");
            whereClause.append("raw_text ILIKE ?");
            params.add("%" + validTerms.get(i) + "%");
        }
        params.add(topK);

        String sql = "SELECT page_number AS pageNumber, page_type AS sectionTitle, raw_text AS content " +
                     "FROM document_pages WHERE (" + whereClause + ") AND raw_text IS NOT NULL " +
                     "ORDER BY page_number ASC LIMIT ?";

        try {
            return jdbcTemplate.query(sql, (rs, rowNum) -> {
                Map<String, Object> map = new HashMap<>();
                int pageNum = rs.getInt("pageNumber");
                String pageType = rs.getString("sectionTitle");
                String rawContent = rs.getString("content");
                // Cap content size to ~1500 chars to avoid prompt bloat
                String trimmedContent = rawContent.length() > 1500 ? rawContent.substring(0, 1500) + "..." : rawContent;

                map.put("pageNumber", pageNum);
                map.put("sectionTitle", "Handbook Page " + pageNum + " (" + (pageType != null ? pageType : "Guidance") + ")");
                map.put("content", trimmedContent);
                map.put("similarityScore", 0.85);
                return map;
            }, params.toArray());
        } catch (Exception e) {
            log.error("Failed to execute text fallback search on document_pages: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
