package com.pathwise.backend.controller;

import com.pathwise.backend.entity.University;
import com.pathwise.backend.service.UniversityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/universities")
@RequiredArgsConstructor
@CrossOrigin
public class AdminUniversityController {

    private final UniversityService universityService;

    @GetMapping
    public ResponseEntity<List<University>> listUniversities() {
        return ResponseEntity.ok(universityService.getAllUniversities());
    }

    @GetMapping("/{id}")
    public ResponseEntity<University> getUniversity(@PathVariable UUID id) {
        return ResponseEntity.ok(universityService.getUniversityById(id));
    }

    @PostMapping
    public ResponseEntity<University> createUniversity(@RequestBody University university) {
        return ResponseEntity.ok(universityService.createUniversity(university));
    }

    @PutMapping("/{id}")
    public ResponseEntity<University> updateUniversity(@PathVariable UUID id, @RequestBody University university) {
        return ResponseEntity.ok(universityService.updateUniversity(id, university));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUniversity(@PathVariable UUID id) {
        universityService.deleteUniversity(id);
        return ResponseEntity.noContent().build();
    }
}

