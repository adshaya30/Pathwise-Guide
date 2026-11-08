package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "aptitude_requirements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AptitudeRequirement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "course_id", nullable = false)
    private UUID courseId;

    @Column(name = "course_name", nullable = false)
    private String courseName;

    @Column(name = "university_id")
    private UUID universityId;

    @Column(name = "university_name")
    private String universityName;

    @Column(name = "test_name", nullable = false)
    private String testName;

    @Column(name = "test_description", columnDefinition = "TEXT")
    private String testDescription;

    @Column(name = "passing_criteria", columnDefinition = "TEXT")
    private String passingCriteria;

    @Column(name = "application_deadline")
    private String applicationDeadline;

    @Column(name = "conducted_by")
    private String conductedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
