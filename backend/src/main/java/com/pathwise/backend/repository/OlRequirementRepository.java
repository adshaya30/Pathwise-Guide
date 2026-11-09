package com.pathwise.backend.repository;

import com.pathwise.backend.entity.OlRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OlRequirementRepository extends JpaRepository<OlRequirement, UUID> {
    List<OlRequirement> findAllByOrderByCourseOfStudyAsc();
    Optional<OlRequirement> findByUniCodes(String uniCodes);
    Optional<OlRequirement> findByCourseOfStudyIgnoreCase(String courseOfStudy);
    Optional<OlRequirement> findByUniCodesAndCourseOfStudyIgnoreCase(String uniCodes, String courseOfStudy);
}

