package com.pathwise.backend.service;

import com.pathwise.backend.entity.Course;
import com.pathwise.backend.entity.UniCode;
import com.pathwise.backend.entity.University;
import com.pathwise.backend.repository.CourseRepository;
import com.pathwise.backend.repository.UniCodeRepository;
import com.pathwise.backend.repository.UniversityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UniCodeService {

    private final UniCodeRepository uniCodeRepository;
    private final CourseRepository courseRepository;
    private final UniversityRepository universityRepository;

    public List<UniCode> getAllUniCodes() {
        return uniCodeRepository.findAllByOrderByCodeAsc();
    }

    public UniCode getUniCodeById(UUID id) {
        return uniCodeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("UniCode not found: " + id));
    }

    @Transactional
    public UniCode createUniCode(UniCode uniCode) {
        // Populate course and university names if IDs are given
        if (uniCode.getCourseId() != null) {
            courseRepository.findById(uniCode.getCourseId())
                    .ifPresent(c -> uniCode.setCourseName(c.getName()));
        }
        if (uniCode.getUniversityId() != null) {
            universityRepository.findById(uniCode.getUniversityId())
                    .ifPresent(u -> uniCode.setUniversityName(u.getName()));
        }
        return uniCodeRepository.save(uniCode);
    }

    @Transactional
    public UniCode updateUniCode(UUID id, UniCode updated) {
        UniCode existing = getUniCodeById(id);
        existing.setCode(updated.getCode());
        existing.setCourseId(updated.getCourseId());
        existing.setCourseName(updated.getCourseName());
        existing.setUniversityId(updated.getUniversityId());
        existing.setUniversityName(updated.getUniversityName());

        if (existing.getCourseId() != null) {
            courseRepository.findById(existing.getCourseId())
                    .ifPresent(c -> existing.setCourseName(c.getName()));
        }
        if (existing.getUniversityId() != null) {
            universityRepository.findById(existing.getUniversityId())
                    .ifPresent(u -> existing.setUniversityName(u.getName()));
        }

        return uniCodeRepository.save(existing);
    }

    @Transactional
    public void deleteUniCode(UUID id) {
        uniCodeRepository.deleteById(id);
    }
}

