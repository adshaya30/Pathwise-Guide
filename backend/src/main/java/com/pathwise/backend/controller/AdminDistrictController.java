package com.pathwise.backend.controller;

import com.pathwise.backend.entity.District;
import com.pathwise.backend.service.DistrictService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/districts")
@RequiredArgsConstructor
@CrossOrigin
public class AdminDistrictController {

    private final DistrictService districtService;

    @GetMapping
    public ResponseEntity<List<District>> listDistricts() {
        return ResponseEntity.ok(districtService.getAllDistricts());
    }

    @GetMapping("/{id}")
    public ResponseEntity<District> getDistrict(@PathVariable UUID id) {
        return ResponseEntity.ok(districtService.getDistrictById(id));
    }

    @PostMapping
    public ResponseEntity<District> createDistrict(@RequestBody District district) {
        return ResponseEntity.ok(districtService.createDistrict(district));
    }

    @PutMapping("/{id}")
    public ResponseEntity<District> updateDistrict(@PathVariable UUID id, @RequestBody District district) {
        return ResponseEntity.ok(districtService.updateDistrict(id, district));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDistrict(@PathVariable UUID id) {
        districtService.deleteDistrict(id);
        return ResponseEntity.noContent().build();
    }
}
