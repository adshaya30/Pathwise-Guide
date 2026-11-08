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
        return artsBasketRepository.save(basket);
    }

    @Transactional
    public ArtsBasket updateBasket(UUID id, ArtsBasket updated) {
        ArtsBasket existing = getBasketById(id);
        existing.setBasketNumber(updated.getBasketNumber());
        existing.setBasketName(updated.getBasketName());
        existing.setMinSubjectsRequired(updated.getMinSubjectsRequired());
        existing.setMaxSubjectsAllowed(updated.getMaxSubjectsAllowed());
        existing.setRulesDescription(updated.getRulesDescription());
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

