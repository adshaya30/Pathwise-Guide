package com.pathwise.backend.service;

import com.pathwise.backend.entity.OlRequirement;
import com.pathwise.backend.repository.OlRequirementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OlRequirementService {

    private final OlRequirementRepository olRequirementRepository;

    public List<OlRequirement> getAllRequirements() {
        return olRequirementRepository.findAllByOrderByCourseOfStudyAsc();
    }

    public OlRequirement getRequirementById(UUID id) {
        return olRequirementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("O/L Requirement not found: " + id));
    }

    @Transactional
    public OlRequirement createRequirement(OlRequirement req) {
        cleanFields(req);
        return olRequirementRepository.save(req);
    }

    @Transactional
    public OlRequirement updateRequirement(UUID id, OlRequirement updated) {
        OlRequirement existing = getRequirementById(id);
        cleanFields(updated);
        existing.setUniCodes(updated.getUniCodes());
        existing.setCourseOfStudy(updated.getCourseOfStudy());
        existing.setSinhalaLanguage(updated.getSinhalaLanguage());
        existing.setEnglish(updated.getEnglish());
        existing.setMathematics(updated.getMathematics());
        existing.setScience(updated.getScience());
        existing.setTamilLanguage(updated.getTamilLanguage());
        existing.setNotes(updated.getNotes());
        return olRequirementRepository.save(existing);
    }

    @Transactional
    public void deleteRequirement(UUID id) {
        olRequirementRepository.deleteById(id);
    }

    @Transactional
    public List<OlRequirement> batchCreateOrUpdate(List<OlRequirement> list) {
        List<OlRequirement> results = new ArrayList<>();
        for (OlRequirement req : list) {
            cleanFields(req);
            Optional<OlRequirement> existing = Optional.empty();
            if (req.getUniCodes() != null && !req.getUniCodes().isBlank()) {
                existing = olRequirementRepository.findByUniCodes(req.getUniCodes().trim());
            }
            if (existing.isEmpty() && req.getCourseOfStudy() != null && !req.getCourseOfStudy().isBlank()) {
                existing = olRequirementRepository.findByCourseOfStudyIgnoreCase(req.getCourseOfStudy().trim());
            }

            if (existing.isPresent()) {
                OlRequirement e = existing.get();
                e.setUniCodes(req.getUniCodes());
                e.setCourseOfStudy(req.getCourseOfStudy());
                e.setSinhalaLanguage(req.getSinhalaLanguage());
                e.setEnglish(req.getEnglish());
                e.setMathematics(req.getMathematics());
                e.setScience(req.getScience());
                e.setTamilLanguage(req.getTamilLanguage());
                if (req.getNotes() != null && !req.getNotes().isBlank()) {
                    e.setNotes(req.getNotes());
                }
                results.add(olRequirementRepository.save(e));
            } else {
                results.add(olRequirementRepository.save(req));
            }
        }
        return results;
    }

    private void cleanFields(OlRequirement req) {
        if (req.getUniCodes() == null) req.setUniCodes("");
        else req.setUniCodes(req.getUniCodes().trim());

        if (req.getCourseOfStudy() == null) req.setCourseOfStudy("");
        else req.setCourseOfStudy(req.getCourseOfStudy().trim());

        if (req.getSinhalaLanguage() == null) req.setSinhalaLanguage("");
        else req.setSinhalaLanguage(req.getSinhalaLanguage().trim());

        if (req.getEnglish() == null) req.setEnglish("");
        else req.setEnglish(req.getEnglish().trim());

        if (req.getMathematics() == null) req.setMathematics("");
        else req.setMathematics(req.getMathematics().trim());

        if (req.getScience() == null) req.setScience("");
        else req.setScience(req.getScience().trim());

        if (req.getTamilLanguage() == null) req.setTamilLanguage("");
        else req.setTamilLanguage(req.getTamilLanguage().trim());

        if (req.getNotes() == null) req.setNotes("");
        else req.setNotes(req.getNotes().trim());
    }
}

