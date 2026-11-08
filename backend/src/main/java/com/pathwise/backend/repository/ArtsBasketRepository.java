package com.pathwise.backend.repository;

import com.pathwise.backend.entity.ArtsBasket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ArtsBasketRepository extends JpaRepository<ArtsBasket, UUID> {
    List<ArtsBasket> findAllByOrderByBasketNumberAsc();
    Optional<ArtsBasket> findByBasketNumber(Integer basketNumber);
}
