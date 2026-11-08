package com.pathwise.backend.service;

import com.pathwise.backend.entity.AptitudeRequirement;
import com.pathwise.backend.repository.AptitudeRequirementRepository;
import com.pathwise.backend.repository.CourseRepository;
import com.pathwise.backend.repository.UniversityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AptitudeService {

    private final AptitudeRequirementRepository aptitudeRequirementRepository;
    private final CourseRepository courseRepository;
    private final UniversityRepository universityRepository;

    public List<AptitudeRequirement> getAllAptitudes() {
        return aptitudeRequirementRepository.findAllByOrderByCourseNameAsc();
    }

    public AptitudeRequirement getAptitudeById(UUID id) {
        return aptitudeRequirementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Aptitude requirement not found: " + id));
    }

    @Transactional
    public AptitudeRequirement createAptitude(AptitudeRequirement req) {
        if (req.getCourseId() != null) {
            courseRepository.findById(req.getCourseId())
                    .ifPresent(c -> req.setCourseName(c.getName()));
        }
        if (req.getUniversityId() != null) {
            universityRepository.findById(req.getUniversityId())
                    .ifPresent(u -> req.setUniversityName(u.getName()));
        }
        return aptitudeRequirementRepository.save(req);
    }

    @Transactional
    public AptitudeRequirement updateAptitude(UUID id, AptitudeRequirement updated) {
        AptitudeRequirement existing = getAptitudeById(id);
        existing.setCourseId(updated.getCourseId());
        existing.setCourseName(updated.getCourseName());
        existing.setUniversityId(updated.getUniversityId());
        existing.setUniversityName(updated.getUniversityName());
        existing.setTestName(updated.getTestName());
        existing.setTestDescription(updated.getTestDescription());
        existing.setPassingCriteria(updated.getPassingCriteria());
        existing.setApplicationDeadline(updated.getApplicationDeadline());
        existing.setConductedBy(updated.getConductedBy());

        if (existing.getCourseId() != null) {
            courseRepository.findById(existing.getCourseId())
                    .ifPresent(c -> existing.setCourseName(c.getName()));
        }
        if (existing.getUniversityId() != null) {
            universityRepository.findById(existing.getUniversityId())
                    .ifPresent(u -> existing.setUniversityName(u.getName()));
        }

        return aptitudeRequirementRepository.save(existing);
    }

    @Transactional
    public void deleteAptitude(UUID id) {
        aptitudeRequirementRepository.deleteById(id);
    }
}
