package com.pathwise.backend.repository;

import com.pathwise.backend.entity.ArtsBasketSubject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ArtsBasketSubjectRepository extends JpaRepository<ArtsBasketSubject, UUID> {
    List<ArtsBasketSubject> findByBasketId(UUID basketId);
    Optional<ArtsBasketSubject> findByBasketIdAndSubjectId(UUID basketId, UUID subjectId);
}
