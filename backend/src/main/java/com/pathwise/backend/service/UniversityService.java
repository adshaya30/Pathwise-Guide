package com.pathwise.backend.service;

import com.pathwise.backend.entity.University;
import com.pathwise.backend.repository.UniversityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UniversityService {

    private final UniversityRepository universityRepository;

    public List<University> getAllUniversities() {
        return universityRepository.findAll();
    }

    public University getUniversityById(UUID id) {
        return universityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("University not found: " + id));
    }

    @Transactional
    public University createUniversity(University uni) {
        return universityRepository.save(uni);
    }

    @Transactional
    public University updateUniversity(UUID id, University updated) {
        University existing = getUniversityById(id);
        existing.setCode(updated.getCode());
        existing.setName(updated.getName());
        existing.setLocation(updated.getLocation());
        return universityRepository.save(existing);
    }

    @Transactional
    public void deleteUniversity(UUID id) {
        universityRepository.deleteById(id);
    }
}

