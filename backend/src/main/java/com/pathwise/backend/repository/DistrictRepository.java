package com.pathwise.backend.repository;

import com.pathwise.backend.entity.District;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DistrictRepository extends JpaRepository<District, UUID> {
    Optional<District> findByCode(String code);
    Optional<District> findByNameIgnoreCase(String name);
    List<District> findAllByOrderByNameAsc();
    List<District> findByHasDisadvantageTrue();
}

