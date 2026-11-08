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

    @Column(name = "course_id")
    private UUID courseId;

    @Column(name = "course_name")
    private String courseName;

    @Column(name = "course_of_study")
    private String courseOfStudy;

    @Column(name = "university_id")
    private UUID universityId;

    @Column(name = "university_name")
    private String universityName;

    @Column(name = "uni_code")
    private String uniCode;

    @Column(name = "conducted_by")
    private String conductedBy;

    public String getCourseOfStudy() {
        if (courseOfStudy != null && !courseOfStudy.isBlank()) {
            return courseOfStudy;
        }
        return courseName;
    }

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}

