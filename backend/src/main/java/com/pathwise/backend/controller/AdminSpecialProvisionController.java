package com.pathwise.backend.controller;

import com.pathwise.backend.entity.SpecialProvision;
import com.pathwise.backend.service.SpecialProvisionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/special-provisions")
@RequiredArgsConstructor
@CrossOrigin
public class AdminSpecialProvisionController {

    private final SpecialProvisionService specialProvisionService;

    @GetMapping
    public ResponseEntity<List<SpecialProvision>> listProvisions(@RequestParam(required = false) String category) {
        return ResponseEntity.ok(specialProvisionService.getAllProvisions(category));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SpecialProvision> getProvision(@PathVariable UUID id) {
        return ResponseEntity.ok(specialProvisionService.getProvisionById(id));
    }

    @PostMapping
    public ResponseEntity<SpecialProvision> createProvision(@RequestBody SpecialProvision sp) {
        return ResponseEntity.ok(specialProvisionService.createProvision(sp));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<SpecialProvision>> batchCreateProvisions(@RequestBody List<SpecialProvision> list) {
        return ResponseEntity.ok(specialProvisionService.batchCreateOrUpdate(list));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SpecialProvision> updateProvision(@PathVariable UUID id, @RequestBody SpecialProvision sp) {
        return ResponseEntity.ok(specialProvisionService.updateProvision(id, sp));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProvision(@PathVariable UUID id) {
        specialProvisionService.deleteProvision(id);
        return ResponseEntity.noContent().build();
    }
}

