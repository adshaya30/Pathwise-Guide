package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "courses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Course {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(name = "stream_id")
    private UUID streamId;

    @Column(name = "stream_name")
    private String streamName;

    @Column(name = "total_intake")
    private Integer totalIntake;

    @Column(name = "minimum_eligibility", columnDefinition = "TEXT")
    private String minimumEligibility;

    @Column(name = "duration_years", precision = 3, scale = 1)
    private BigDecimal durationYears;

    @Column(name = "degree_title")
    private String degreeTitle;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private String details = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "minimum_requirements", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private String minimumRequirements = "{}";

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}

