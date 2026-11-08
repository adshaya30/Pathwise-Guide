package com.pathwise.backend.repository;

import com.pathwise.backend.entity.University;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UniversityRepository extends JpaRepository<University, UUID> {
    Optional<University> findByCode(String code);
    Optional<University> findByNameIgnoreCase(String name);
}
