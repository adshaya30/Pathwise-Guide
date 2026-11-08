package com.pathwise.backend.service;

import com.pathwise.backend.entity.SpecialProvision;
import com.pathwise.backend.repository.SpecialProvisionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SpecialProvisionService {

    private final SpecialProvisionRepository specialProvisionRepository;

    public List<SpecialProvision> getAllProvisions(String category) {
        if (category != null && !category.isBlank()) {
            return specialProvisionRepository.findByCategory(category);
        }
        return specialProvisionRepository.findAll();
    }

    public SpecialProvision getProvisionById(UUID id) {
        return specialProvisionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Special provision not found: " + id));
    }

    @Transactional
    public SpecialProvision createProvision(SpecialProvision sp) {
        return specialProvisionRepository.save(sp);
    }

    @Transactional
    public SpecialProvision updateProvision(UUID id, SpecialProvision updated) {
        SpecialProvision existing = getProvisionById(id);
        existing.setCategory(updated.getCategory());
        existing.setTitle(updated.getTitle());
        existing.setDescription(updated.getDescription());
        existing.setEligibleCourses(updated.getEligibleCourses());
        existing.setQuotaPercentage(updated.getQuotaPercentage());
        existing.setConditions(updated.getConditions());
        return specialProvisionRepository.save(existing);
    }

    @Transactional
    public void deleteProvision(UUID id) {
        specialProvisionRepository.deleteById(id);
    }
}
