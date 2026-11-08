package com.pathwise.backend.repository;

import com.pathwise.backend.entity.SpecialProvision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpecialProvisionRepository extends JpaRepository<SpecialProvision, UUID> {
    List<SpecialProvision> findByCategory(String category);
    List<SpecialProvision> findAllByOrderByUniversityNameAscCourseOfStudyAsc();
    Optional<SpecialProvision> findByUniCode(String uniCode);
    Optional<SpecialProvision> findByUniversityNameAndCourseOfStudyAndUniCode(String universityName, String courseOfStudy, String uniCode);
}

