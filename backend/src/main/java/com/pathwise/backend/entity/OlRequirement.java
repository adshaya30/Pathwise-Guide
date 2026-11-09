package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ol_requirements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OlRequirement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "uni_codes", nullable = false)
    private String uniCodes;

    @Column(name = "course_of_study", nullable = false)
    private String courseOfStudy;

    @Column(name = "sinhala_language")
    @Builder.Default
    private String sinhalaLanguage = "";

    @Column(name = "english")
    @Builder.Default
    private String english = "";

    @Column(name = "mathematics")
    @Builder.Default
    private String mathematics = "";

    @Column(name = "science")
    @Builder.Default
    private String science = "";

    @Column(name = "tamil_language")
    @Builder.Default
    private String tamilLanguage = "";

    @Column(columnDefinition = "TEXT")
    @Builder.Default
    private String notes = "";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}

