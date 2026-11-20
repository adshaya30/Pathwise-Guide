package com.pathwise.backend.service;

import com.pathwise.backend.entity.Course;
import com.pathwise.backend.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;

    public List<Course> getAllCourses() {
        return courseRepository.findAllByOrderByCodeAsc().stream()
                .sorted((a, b) -> compareCourseCodes(a.getCode(), b.getCode()))
                .toList();
    }

    public static int compareCourseCodes(String a, String b) {
        String codeA = a != null ? a.trim() : "";
        String codeB = b != null ? b.trim() : "";

        boolean isStdA = codeA.matches("^\\d{3}[A-Za-z]?$");
        boolean isStdB = codeB.matches("^\\d{3}[A-Za-z]?$");

        if (isStdA && !isStdB) return -1;
        if (!isStdA && isStdB) return 1;

        if (isStdA && isStdB) {
            int numA = Integer.parseInt(codeA.substring(0, 3));
            int numB = Integer.parseInt(codeB.substring(0, 3));
            if (numA != numB) return Integer.compare(numA, numB);
            return codeA.compareToIgnoreCase(codeB);
        }

        return codeA.compareToIgnoreCase(codeB);
    }

    public Course getCourseById(UUID id) {
        return courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + id));
    }

    @Transactional
    public Course createCourse(Course course) {
        return courseRepository.save(course);
    }

    @Transactional
    public Course updateCourse(UUID id, Course updated) {
        Course existing = getCourseById(id);
        existing.setCode(updated.getCode());
        existing.setName(updated.getName());
        existing.setStreamId(updated.getStreamId());
        existing.setStreamName(updated.getStreamName());
        existing.setTotalIntake(updated.getTotalIntake());
        existing.setMinimumEligibility(updated.getMinimumEligibility());
        existing.setDurationYears(updated.getDurationYears());
        existing.setDegreeTitle(updated.getDegreeTitle());
        existing.setDetails(updated.getDetails());
        existing.setMinimumRequirements(updated.getMinimumRequirements());
        existing.setIsActive(updated.getIsActive());
        return courseRepository.save(existing);
    }

    @Transactional
    public void deleteCourse(UUID id) {
        courseRepository.deleteById(id);
    }
}

