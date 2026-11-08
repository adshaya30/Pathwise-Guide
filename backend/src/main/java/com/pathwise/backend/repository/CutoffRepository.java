package com.pathwise.backend.repository;

import com.pathwise.backend.entity.Cutoff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CutoffRepository extends JpaRepository<Cutoff, UUID> {
    List<Cutoff> findByAcademicYearOrderByUniCodeAsc(String academicYear);
    List<Cutoff> findByUniCode(String uniCode);
    Optional<Cutoff> findByUniCodeIdAndAcademicYear(UUID uniCodeId, String academicYear);
    List<Cutoff> findAllByOrderByAcademicYearDescUniCodeAsc();
}
