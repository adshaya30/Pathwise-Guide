package com.pathwise.backend.repository;

import com.pathwise.backend.entity.ExtractedRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
public interface ExtractedRecordRepository extends JpaRepository<ExtractedRecord, UUID> {
    List<ExtractedRecord> findAllByOrderByCreatedAtDesc();
    List<ExtractedRecord> findByStatusOrderByCreatedAtDesc(String status);
    List<ExtractedRecord> findByModuleTypeOrderByCreatedAtDesc(String moduleType);
    List<ExtractedRecord> findByModuleTypeAndStatusOrderByCreatedAtDesc(String moduleType, String status);
    List<ExtractedRecord> findByDocumentIdOrderByPageNumberAsc(UUID documentId);
    long countByStatus(String status);

    @Modifying
    @Transactional
    @Query("DELETE FROM ExtractedRecord r WHERE r.documentId = :documentId AND r.status = :status")
    void deleteByDocumentIdAndStatus(UUID documentId, String status);
}

