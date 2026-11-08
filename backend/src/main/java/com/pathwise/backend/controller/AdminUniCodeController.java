package com.pathwise.backend.controller;

import com.pathwise.backend.entity.UniCode;
import com.pathwise.backend.service.UniCodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/uni-codes")
@RequiredArgsConstructor
@CrossOrigin
public class AdminUniCodeController {

    private final UniCodeService uniCodeService;

    @GetMapping
    public ResponseEntity<List<UniCode>> listUniCodes() {
        return ResponseEntity.ok(uniCodeService.getAllUniCodes());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UniCode> getUniCode(@PathVariable UUID id) {
        return ResponseEntity.ok(uniCodeService.getUniCodeById(id));
    }

    @PostMapping
    public ResponseEntity<UniCode> createUniCode(@RequestBody UniCode uniCode) {
        return ResponseEntity.ok(uniCodeService.createUniCode(uniCode));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UniCode> updateUniCode(@PathVariable UUID id, @RequestBody UniCode uniCode) {
        return ResponseEntity.ok(uniCodeService.updateUniCode(id, uniCode));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUniCode(@PathVariable UUID id) {
        uniCodeService.deleteUniCode(id);
        return ResponseEntity.noContent().build();
    }
}

