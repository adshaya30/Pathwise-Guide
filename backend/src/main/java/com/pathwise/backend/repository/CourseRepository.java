package com.pathwise.backend.repository;

import com.pathwise.backend.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CourseRepository extends JpaRepository<Course, UUID> {
    Optional<Course> findByCode(String code);
    Optional<Course> findByNameIgnoreCase(String name);
    List<Course> findByIsActiveTrue();
    List<Course> findByStreamId(UUID streamId);
}

