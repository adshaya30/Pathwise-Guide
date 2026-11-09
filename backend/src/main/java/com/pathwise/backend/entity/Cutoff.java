package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "cutoffs", uniqueConstraints = {
        @UniqueConstraint(name = "uq_cutoff_unicode_year", columnNames = {"uni_code_id", "academic_year"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cutoff {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "uni_code_id", nullable = false)
    private UUID uniCodeId;

    @Column(name = "uni_code", nullable = false)
    private String uniCode;

    @Column(name = "course_name", nullable = false)
    private String courseName;

    @Column(name = "university_name", nullable = false)
    private String universityName;

    @Column(name = "academic_year", nullable = false)
    private String academicYear;

    @Column(precision = 8, scale = 4)
    private BigDecimal colombo;

    @Column(precision = 8, scale = 4)
    private BigDecimal gampaha;

    @Column(precision = 8, scale = 4)
    private BigDecimal kalutara;

    @Column(precision = 8, scale = 4)
    private BigDecimal kandy;

    @Column(precision = 8, scale = 4)
    private BigDecimal matale;

    @Column(name = "nuwara_eliya", precision = 8, scale = 4)
    private BigDecimal nuwaraEliya;

    @Column(precision = 8, scale = 4)
    private BigDecimal galle;

    @Column(precision = 8, scale = 4)
    private BigDecimal matara;

    @Column(precision = 8, scale = 4)
    private BigDecimal hambantota;

    @Column(precision = 8, scale = 4)
    private BigDecimal jaffna;

    @Column(precision = 8, scale = 4)
    private BigDecimal kilinochchi;

    @Column(precision = 8, scale = 4)
    private BigDecimal mannar;

    @Column(precision = 8, scale = 4)
    private BigDecimal vavuniya;

    @Column(precision = 8, scale = 4)
    private BigDecimal mullaitivu;

    @Column(precision = 8, scale = 4)
    private BigDecimal batticaloa;

    @Column(precision = 8, scale = 4)
    private BigDecimal ampara;

    @Column(precision = 8, scale = 4)
    private BigDecimal trincomalee;

    @Column(precision = 8, scale = 4)
    private BigDecimal kurunegala;

    @Column(precision = 8, scale = 4)
    private BigDecimal puttalam;

    @Column(precision = 8, scale = 4)
    private BigDecimal anuradhapura;

    @Column(precision = 8, scale = 4)
    private BigDecimal polonnaruwa;

    @Column(precision = 8, scale = 4)
    private BigDecimal badulla;

    @Column(precision = 8, scale = 4)
    private BigDecimal monaragala;

    @Column(precision = 8, scale = 4)
    private BigDecimal ratnapura;

    @Column(precision = 8, scale = 4)
    private BigDecimal kegalle;

    @Column(name = "nvq_districts", columnDefinition = "TEXT")
    private String nvqDistricts;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}

