package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

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

    @Column(name = "university_name", nullable = false)
    @Builder.Default
    private String universityName = "";

    @Column(name = "course_of_study", nullable = false)
    @Builder.Default
    private String courseOfStudy = "";

    @Column(name = "uni_code", nullable = false)
    @Builder.Default
    private String uniCode = "";

    @Column(name = "differently_abled")
    @Builder.Default
    private Integer differentlyAbled = 0;

    @Column(name = "blind_braille")
    @Builder.Default
    private Integer blindBraille = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
