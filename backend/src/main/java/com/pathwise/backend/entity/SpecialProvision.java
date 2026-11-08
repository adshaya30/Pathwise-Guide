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
@Table(name = "special_provisions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpecialProvision {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "university_name")
    private String universityName;

    @Column(name = "course_of_study")
    private String courseOfStudy;

    @Column(name = "uni_code")
    private String uniCode;

    @Column(name = "differently_abled")
    @Builder.Default
    private Integer differentlyAbled = 0;

    @Column(name = "blind_braille")
    @Builder.Default
    private Integer blindBraille = 0;

    @Column
    @Builder.Default
    private String category = "BLIND_AND_DIFFERENTLY_ABLED";

    @Column
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "eligible_courses", columnDefinition = "jsonb")
    @Builder.Default
    private String eligibleCourses = "[]";

    @Column(name = "quota_percentage", precision = 5, scale = 2)
    private BigDecimal quotaPercentage;

    @Column(columnDefinition = "TEXT")
    private String conditions;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}

