package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(name = "academic_year", nullable = false)
    private String academicYear;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "file_type", nullable = false)
    private String fileType;

    @Column(name = "storage_path", nullable = false, length = 500)
    private String storagePath;

    @Column(name = "storage_url", length = 1000)
    private String storageUrl;

    @Column(name = "total_pages")
    @Builder.Default
    private Integer totalPages = 0;

    @Column(name = "processed_pages")
    @Builder.Default
    private Integer processedPages = 0;

    @Column(nullable = false)
    @Builder.Default
    private String status = "UPLOADED";

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}

