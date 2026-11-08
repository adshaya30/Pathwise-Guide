package com.pathwise.backend.controller;

import com.pathwise.backend.entity.AptitudeRequirement;
import com.pathwise.backend.service.AptitudeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/aptitude")
@RequiredArgsConstructor
@CrossOrigin
public class AdminAptitudeController {

    private final AptitudeService aptitudeService;

    @GetMapping
    public ResponseEntity<List<AptitudeRequirement>> listAptitudes() {
        return ResponseEntity.ok(aptitudeService.getAllAptitudes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AptitudeRequirement> getAptitude(@PathVariable UUID id) {
        return ResponseEntity.ok(aptitudeService.getAptitudeById(id));
    }

    @PostMapping
    public ResponseEntity<AptitudeRequirement> createAptitude(@RequestBody AptitudeRequirement req) {
        return ResponseEntity.ok(aptitudeService.createAptitude(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AptitudeRequirement> updateAptitude(@PathVariable UUID id, @RequestBody AptitudeRequirement req) {
        return ResponseEntity.ok(aptitudeService.updateAptitude(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAptitude(@PathVariable UUID id) {
        aptitudeService.deleteAptitude(id);
        return ResponseEntity.noContent().build();
    }
}
