package com.pathwise.backend.repository;

import com.pathwise.backend.entity.AptitudeRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AptitudeRequirementRepository extends JpaRepository<AptitudeRequirement, UUID> {
    List<AptitudeRequirement> findByCourseId(UUID courseId);
    List<AptitudeRequirement> findByUniversityId(UUID universityId);
    List<AptitudeRequirement> findAllByOrderByCourseNameAsc();
}

