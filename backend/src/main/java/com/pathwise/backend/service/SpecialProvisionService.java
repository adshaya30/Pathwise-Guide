package com.pathwise.backend.service;

import com.pathwise.backend.entity.SpecialProvision;
import com.pathwise.backend.repository.SpecialProvisionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SpecialProvisionService {

    private final SpecialProvisionRepository specialProvisionRepository;

    public List<SpecialProvision> getAllProvisions() {
        return specialProvisionRepository.findAllByOrderByUniversityNameAscCourseOfStudyAsc();
    }

    public SpecialProvision getProvisionById(UUID id) {
        return specialProvisionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Special provision not found: " + id));
    }

    @Transactional
    public SpecialProvision createProvision(SpecialProvision sp) {
        String uni = sp.getUniversityName() != null ? sp.getUniversityName().trim() : "";
        String course = sp.getCourseOfStudy() != null ? sp.getCourseOfStudy().trim() : "";
        String code = sp.getUniCode() != null ? sp.getUniCode().trim().toUpperCase() : "";

        sp.setUniversityName(uni);
        sp.setCourseOfStudy(course);
        sp.setUniCode(code);
        if (sp.getDifferentlyAbled() == null) sp.setDifferentlyAbled(0);
        if (sp.getBlindBraille() == null) sp.setBlindBraille(0);

        return specialProvisionRepository.save(sp);
    }

    @Transactional
    public List<SpecialProvision> batchCreateOrUpdate(List<SpecialProvision> list) {
        List<SpecialProvision> savedList = new ArrayList<>();
        for (SpecialProvision sp : list) {
            String code = sp.getUniCode() != null ? sp.getUniCode().trim().toUpperCase() : "";
            Optional<SpecialProvision> existing = Optional.empty();
            if (!code.isBlank()) {
                existing = specialProvisionRepository.findByUniCode(code);
            }
            if (existing.isEmpty() && sp.getUniversityName() != null && sp.getCourseOfStudy() != null) {
                existing = specialProvisionRepository.findByUniversityNameAndCourseOfStudyAndUniCode(
                        sp.getUniversityName().trim(), sp.getCourseOfStudy().trim(), code);
            }

            if (existing.isPresent()) {
                SpecialProvision e = existing.get();
                if (sp.getUniversityName() != null && !sp.getUniversityName().isBlank()) {
                    e.setUniversityName(sp.getUniversityName().trim());
                }
                if (sp.getCourseOfStudy() != null && !sp.getCourseOfStudy().isBlank()) {
                    e.setCourseOfStudy(sp.getCourseOfStudy().trim());
                }
                if (sp.getDifferentlyAbled() != null) {
                    e.setDifferentlyAbled(sp.getDifferentlyAbled());
                }
                if (sp.getBlindBraille() != null) {
                    e.setBlindBraille(sp.getBlindBraille());
                }
                savedList.add(specialProvisionRepository.save(e));
            } else {
                savedList.add(createProvision(sp));
            }
        }
        return savedList;
    }

    @Transactional
    public SpecialProvision updateProvision(UUID id, SpecialProvision updated) {
        SpecialProvision existing = getProvisionById(id);
        existing.setUniversityName(updated.getUniversityName());
        existing.setCourseOfStudy(updated.getCourseOfStudy());
        existing.setUniCode(updated.getUniCode());
        existing.setDifferentlyAbled(updated.getDifferentlyAbled());
        existing.setBlindBraille(updated.getBlindBraille());
        return specialProvisionRepository.save(existing);
    }

    @Transactional
    public void deleteProvision(UUID id) {
        specialProvisionRepository.deleteById(id);
    }
}
