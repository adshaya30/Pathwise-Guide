package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "uni_codes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UniCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "course_id")
    private UUID courseId;

    @Column(name = "course_name", nullable = false)
    private String courseName;

    @Column(name = "university_id")
    private UUID universityId;

    @Column(name = "university_name", nullable = false)
    private String universityName;

    @Column(name = "intake")
    private Integer intake;

    @Column(name = "degree_program")
    private String degreeProgram;

    @Column(name = "duration")
    private String duration;

    @Column(name = "aptitude_test")
    @Builder.Default
    private Boolean aptitudeTest = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
