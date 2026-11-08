package com.pathwise.backend.repository;

import com.pathwise.backend.entity.UniCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UniCodeRepository extends JpaRepository<UniCode, UUID> {
    Optional<UniCode> findByCode(String code);
    List<UniCode> findByCourseId(UUID courseId);
    List<UniCode> findByUniversityId(UUID universityId);
    List<UniCode> findAllByOrderByCodeAsc();
}

