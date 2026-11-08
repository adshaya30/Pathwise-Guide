package com.pathwise.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "arts_baskets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ArtsBasket {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "basket_number", nullable = false)
    private Integer basketNumber;

    @Column(name = "basket_name", nullable = false)
    private String basketName;

    @Column(name = "min_subjects_required")
    @Builder.Default
    private Integer minSubjectsRequired = 1;

    @Column(name = "max_subjects_allowed")
    @Builder.Default
    private Integer maxSubjectsAllowed = 3;

    @Column(name = "rules_description", columnDefinition = "TEXT")
    private String rulesDescription;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
