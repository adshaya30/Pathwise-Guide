package com.pathwise.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Optional;

@Service
@Slf4j
public class SupabaseStorageService {

    private final RestClient restClient;

    @Value("${pathwise.supabase.url:https://lygsnlknbkochocevupx.supabase.co}")
    private String supabaseUrl;

    @Value("${pathwise.supabase.bucket:handbooks}")
    private String bucketName;

    @Value("${pathwise.supabase.key:}")
    private String supabaseKey;

    public SupabaseStorageService() {
        this.restClient = RestClient.builder().build();
    }

    /**
     * Upload PDF to Supabase Storage bucket.
     * Returns the public URL if successful, or empty if key not configured / upload fails.
     */
    public Optional<String> uploadPdf(String fileName, byte[] fileBytes) {
        if (supabaseKey == null || supabaseKey.isBlank()) {
            log.info("Supabase storage key (SUPABASE_KEY) not provided. Storing file locally only.");
            return Optional.empty();
        }

        try {
            String uploadUrl = String.format("%s/storage/v1/object/%s/%s", supabaseUrl, bucketName, fileName);
            restClient.post()
                    .uri(uploadUrl)
                    .header("apikey", supabaseKey)
                    .header("Authorization", "Bearer " + supabaseKey)
                    .header("x-upsert", "true")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(fileBytes)
                    .retrieve()
                    .toBodilessEntity();

            String publicUrl = String.format("%s/storage/v1/object/public/%s/%s", supabaseUrl, bucketName, fileName);
            log.info("Successfully uploaded PDF to Supabase Storage: {}", publicUrl);
            return Optional.of(publicUrl);
        } catch (Exception e) {
            log.warn("Failed to upload PDF to Supabase Storage bucket '{}': {}. Falling back to local storage.",
                    bucketName, e.getMessage());
            return Optional.empty();
        }
    }

    public String getPublicUrl(String fileName) {
        return String.format("%s/storage/v1/object/public/%s/%s", supabaseUrl, bucketName, fileName);
    }
}

