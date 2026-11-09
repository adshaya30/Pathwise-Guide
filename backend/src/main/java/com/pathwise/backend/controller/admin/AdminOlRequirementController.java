package com.pathwise.backend.controller.admin;

import com.pathwise.backend.entity.OlRequirement;
import com.pathwise.backend.service.OlRequirementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/ol-requirements")
@RequiredArgsConstructor
@CrossOrigin
public class AdminOlRequirementController {

    private final OlRequirementService olRequirementService;

    @GetMapping
    public ResponseEntity<List<OlRequirement>> listRequirements() {
        return ResponseEntity.ok(olRequirementService.getAllRequirements());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OlRequirement> getRequirement(@PathVariable UUID id) {
        return ResponseEntity.ok(olRequirementService.getRequirementById(id));
    }

    @PostMapping
    public ResponseEntity<OlRequirement> createRequirement(@RequestBody OlRequirement req) {
        return ResponseEntity.ok(olRequirementService.createRequirement(req));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<OlRequirement>> batchCreateRequirements(@RequestBody List<OlRequirement> list) {
        return ResponseEntity.ok(olRequirementService.batchCreateOrUpdate(list));
    }

    @PutMapping("/{id}")
    public ResponseEntity<OlRequirement> updateRequirement(@PathVariable UUID id, @RequestBody OlRequirement req) {
        return ResponseEntity.ok(olRequirementService.updateRequirement(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRequirement(@PathVariable UUID id) {
        olRequirementService.deleteRequirement(id);
        return ResponseEntity.noContent().build();
    }
}

