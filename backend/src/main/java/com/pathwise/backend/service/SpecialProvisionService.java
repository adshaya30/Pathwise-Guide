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
        return specialProvisionRepository.findAllByOrderByUniversityNameAscCourseOfStudyAsc();
    }

    public SpecialProvision getProvisionById(UUID id) {
        return specialProvisionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Special provision not found: " + id));
    }

    @Transactional
    public SpecialProvision createProvision(SpecialProvision sp) {
        if (sp.getTitle() == null || sp.getTitle().isBlank()) {
            sp.setTitle((sp.getCourseOfStudy() != null ? sp.getCourseOfStudy() : "Admission") + " - " + (sp.getUniversityName() != null ? sp.getUniversityName() : "University"));
        }
        if (sp.getDescription() == null || sp.getDescription().isBlank()) {
            sp.setDescription("UGC Special Provision for " + sp.getCourseOfStudy() + " (" + sp.getUniCode() + ")");
        }
        if (sp.getCategory() == null || sp.getCategory().isBlank()) {
            sp.setCategory("BLIND_AND_DIFFERENTLY_ABLED");
        }
        return specialProvisionRepository.save(sp);
    }

    @Transactional
    public SpecialProvision updateProvision(UUID id, SpecialProvision updated) {
        SpecialProvision existing = getProvisionById(id);
        existing.setUniversityName(updated.getUniversityName());
        existing.setCourseOfStudy(updated.getCourseOfStudy());
        existing.setUniCode(updated.getUniCode());
        existing.setDifferentlyAbled(updated.getDifferentlyAbled());
        existing.setBlindBraille(updated.getBlindBraille());
        if (updated.getCategory() != null) existing.setCategory(updated.getCategory());
        if (updated.getTitle() != null) existing.setTitle(updated.getTitle());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getEligibleCourses() != null) existing.setEligibleCourses(updated.getEligibleCourses());
        if (updated.getQuotaPercentage() != null) existing.setQuotaPercentage(updated.getQuotaPercentage());
        if (updated.getConditions() != null) existing.setConditions(updated.getConditions());
        return specialProvisionRepository.save(existing);
    }

    @Transactional
    public void deleteProvision(UUID id) {
        specialProvisionRepository.deleteById(id);
    }
}

