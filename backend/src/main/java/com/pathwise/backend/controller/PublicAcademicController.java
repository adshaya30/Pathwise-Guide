package com.pathwise.backend.controller;

import com.pathwise.backend.entity.*;
import com.pathwise.backend.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/academic")
@RequiredArgsConstructor
@CrossOrigin
public class PublicAcademicController {

    private final CourseService courseService;
    private final UniCodeService uniCodeService;
    private final CutoffService cutoffService;
    private final DistrictService districtService;
    private final StreamService streamService;
    private final ArtsBasketService artsBasketService;
    private final SpecialProvisionService specialProvisionService;
    private final AptitudeService aptitudeService;
    private final UniversityService universityService;
    private final OlRequirementService olRequirementService;

    @GetMapping("/courses")
    public ResponseEntity<List<Course>> getActiveCourses() {
        return ResponseEntity.ok(courseService.getAllCourses().stream().filter(Course::getIsActive).toList());
    }

    @GetMapping("/uni-codes")
    public ResponseEntity<List<UniCode>> getUniCodes() {
        return ResponseEntity.ok(uniCodeService.getAllUniCodes());
    }

    @GetMapping("/cutoffs")
    public ResponseEntity<List<Cutoff>> getCutoffs(@RequestParam(required = false) String academicYear) {
        return ResponseEntity.ok(cutoffService.getAllCutoffs(academicYear));
    }

    @GetMapping("/districts")
    public ResponseEntity<List<District>> getDistricts() {
        return ResponseEntity.ok(districtService.getAllDistricts());
    }

    @GetMapping("/streams")
    public ResponseEntity<List<Stream>> getStreams() {
        return ResponseEntity.ok(streamService.getAllStreams());
    }

    @GetMapping("/baskets")
    public ResponseEntity<List<ArtsBasket>> getBaskets() {
        return ResponseEntity.ok(artsBasketService.getAllBaskets());
    }

    @GetMapping("/provisions")
    public ResponseEntity<List<SpecialProvision>> getProvisions() {
        return ResponseEntity.ok(specialProvisionService.getAllProvisions());
    }

    @GetMapping("/aptitude")
    public ResponseEntity<List<AptitudeRequirement>> getAptitudeRequirements() {
        return ResponseEntity.ok(aptitudeService.getAllAptitudes());
    }

    @GetMapping("/universities")
    public ResponseEntity<List<University>> getUniversities() {
        return ResponseEntity.ok(universityService.getAllUniversities());
    }

    @GetMapping("/ol-requirements")
    public ResponseEntity<List<OlRequirement>> getOlRequirements() {
        return ResponseEntity.ok(olRequirementService.getAllRequirements());
    }
}

