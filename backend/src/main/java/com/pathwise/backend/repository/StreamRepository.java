package com.pathwise.backend.repository;

import com.pathwise.backend.entity.Stream;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StreamRepository extends JpaRepository<Stream, UUID> {
    Optional<Stream> findByCode(String code);
    Optional<Stream> findByNameIgnoreCase(String name);
}

