package com.pathwise.backend.repository;

import com.pathwise.backend.entity.StreamSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StreamSubjectRepository extends JpaRepository<StreamSubject, UUID> {
    List<StreamSubject> findByStreamId(UUID streamId);
    Optional<StreamSubject> findByStreamIdAndSubjectId(UUID streamId, UUID subjectId);
}
