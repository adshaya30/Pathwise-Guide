package com.pathwise.backend.controller.admin;

import com.pathwise.backend.entity.Cutoff;
import com.pathwise.backend.service.CutoffService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/cutoffs")
@RequiredArgsConstructor
@CrossOrigin
public class AdminCutoffController {

    private final CutoffService cutoffService;

    @GetMapping
    public ResponseEntity<List<Cutoff>> listCutoffs(@RequestParam(required = false) String academicYear) {
        return ResponseEntity.ok(cutoffService.getAllCutoffs(academicYear));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Cutoff> getCutoff(@PathVariable UUID id) {
        return ResponseEntity.ok(cutoffService.getCutoffById(id));
    }

    @PostMapping
    public ResponseEntity<Cutoff> createCutoff(@RequestBody Cutoff cutoff) {
        return ResponseEntity.ok(cutoffService.createCutoff(cutoff));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Cutoff> updateCutoff(@PathVariable UUID id, @RequestBody Cutoff cutoff) {
        return ResponseEntity.ok(cutoffService.updateCutoff(id, cutoff));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCutoff(@PathVariable UUID id) {
        cutoffService.deleteCutoff(id);
        return ResponseEntity.noContent().build();
    }
}

