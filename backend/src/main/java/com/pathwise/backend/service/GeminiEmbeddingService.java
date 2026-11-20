package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiEmbeddingService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${pathwise.gemini.api-key:}")
    private String geminiApiKey;

    private static final List<String> EMBEDDING_MODELS = List.of(
            "text-embedding-004",
            "embedding-001"
    );

    /**
     * Generates a 768-dimensional embedding vector for the given text.
     */
    public List<Float> generateEmbedding(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }

        String cleanText = text.trim();
        // Truncate to safe token limit (~8000 characters) if too large
        if (cleanText.length() > 8000) {
            cleanText = cleanText.substring(0, 8000);
        }

        String cleanKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        if (cleanKey.isBlank()) {
            log.warn("Gemini API key is not configured. Returning empty embedding.");
            return List.of();
        }

        int maxRetries = 3;
        long backoffMs = 1000;

        for (String model : EMBEDDING_MODELS) {
            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    String url = String.format(
                            "https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s",
                            model, cleanKey);

                    Map<String, Object> body = Map.of(
                            "model", "models/" + model,
                            "content", Map.of("parts", List.of(Map.of("text", cleanText)))
                    );

                    String requestJson = objectMapper.writeValueAsString(body);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .header("Content-Type", "application/json")
                            .header("x-goog-api-key", cleanKey)
                            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                            .timeout(Duration.ofSeconds(30))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    int status = response.statusCode();

                    if (status >= 200 && status < 300) {
                        JsonNode root = objectMapper.readTree(response.body());
                        JsonNode valuesNode = root.at("/embedding/values");

                        if (!valuesNode.isMissingNode() && valuesNode.isArray()) {
                            List<Float> vector = new ArrayList<>(valuesNode.size());
                            for (JsonNode val : valuesNode) {
                                vector.add((float) val.asDouble());
                            }
                            return vector;
                        }
                    }

                    if (status == 429) {
                        log.warn("Gemini Embedding rate limit (429) for model {}. Backing off {} ms (attempt {}/{})...",
                                model, backoffMs, attempt, maxRetries);
                        Thread.sleep(backoffMs);
                        backoffMs *= 2;
                        continue;
                    }

                    log.warn("Gemini Embedding returned status {} for model {}: {}", status, model, response.body());
                    break; // Try fallback model
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return List.of();
                } catch (Exception e) {
                    log.warn("Error calling Gemini embedding model {}: {}", model, e.getMessage());
                    break;
                }
            }
        }

        log.error("Failed to generate embedding after attempting all models.");
        return List.of();
    }

    /**
     * Converts a List of floats into PostgreSQL vector format string: "[0.123, -0.456, ...]"
     */
    public String formatVectorString(List<Float> vector) {
        if (vector == null || vector.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(vector.get(i));
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * Convenience method to generate the vector string directly.
     */
    public String generateEmbeddingString(String text) {
        List<Float> vector = generateEmbedding(text);
        return formatVectorString(vector);
    }
}
