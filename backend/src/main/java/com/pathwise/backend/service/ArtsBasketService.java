package com.pathwise.backend.service;

import com.pathwise.backend.entity.ArtsBasket;
import com.pathwise.backend.entity.ArtsBasketSubject;
import com.pathwise.backend.repository.ArtsBasketRepository;
import com.pathwise.backend.repository.ArtsBasketSubjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArtsBasketService {

    private final ArtsBasketRepository artsBasketRepository;
    private final ArtsBasketSubjectRepository artsBasketSubjectRepository;

    public List<ArtsBasket> getAllBaskets() {
        return artsBasketRepository.findAllByOrderByBasketNumberAsc();
    }

    public List<ArtsBasketSubject> getSubjectsForBasket(UUID basketId) {
        return artsBasketSubjectRepository.findByBasketId(basketId);
    }

    public ArtsBasket getBasketById(UUID id) {
        return artsBasketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Basket not found: " + id));
    }

    @Transactional
    public ArtsBasket createBasket(ArtsBasket basket) {
        if (basket.getBasketNumber() == null) {
            int max = artsBasketRepository.findAll().stream()
                    .mapToInt(b -> b.getBasketNumber() != null ? b.getBasketNumber() : 0)
                    .max().orElse(0);
            basket.setBasketNumber(max + 1);
        }
        if (basket.getMinSubjectsRequired() == null) {
            basket.setMinSubjectsRequired(1);
        }
        if (basket.getMaxSubjectsAllowed() == null) {
            basket.setMaxSubjectsAllowed(3);
        }
        return artsBasketRepository.save(basket);
    }

    @Transactional
    public ArtsBasket updateBasket(UUID id, ArtsBasket updated) {
        ArtsBasket existing = getBasketById(id);
        if (updated.getBasketNumber() != null) existing.setBasketNumber(updated.getBasketNumber());
        if (updated.getBasketName() != null) existing.setBasketName(updated.getBasketName());
        if (updated.getAvailableSubjects() != null) existing.setAvailableSubjects(updated.getAvailableSubjects());
        if (updated.getMinSubjectsRequired() != null) existing.setMinSubjectsRequired(updated.getMinSubjectsRequired());
        if (updated.getMaxSubjectsAllowed() != null) existing.setMaxSubjectsAllowed(updated.getMaxSubjectsAllowed());
        if (updated.getRulesDescription() != null) existing.setRulesDescription(updated.getRulesDescription());
        return artsBasketRepository.save(existing);
    }

    @Transactional
    public void deleteBasket(UUID id) {
        artsBasketRepository.deleteById(id);
    }

    @Transactional
    public ArtsBasketSubject addSubjectToBasket(UUID basketId, ArtsBasketSubject subject) {
        subject.setBasketId(basketId);
        return artsBasketSubjectRepository.save(subject);
    }

    @Transactional
    public void removeSubjectFromBasket(UUID subjectLinkId) {
        artsBasketSubjectRepository.deleteById(subjectLinkId);
    }
}

