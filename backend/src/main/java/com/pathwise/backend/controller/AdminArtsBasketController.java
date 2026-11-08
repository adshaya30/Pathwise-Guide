package com.pathwise.backend.controller;

import com.pathwise.backend.entity.ArtsBasket;
import com.pathwise.backend.entity.ArtsBasketSubject;
import com.pathwise.backend.service.ArtsBasketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/arts-baskets")
@RequiredArgsConstructor
@CrossOrigin
public class AdminArtsBasketController {

    private final ArtsBasketService artsBasketService;

    @GetMapping
    public ResponseEntity<List<ArtsBasket>> listBaskets() {
        return ResponseEntity.ok(artsBasketService.getAllBaskets());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ArtsBasket> getBasket(@PathVariable UUID id) {
        return ResponseEntity.ok(artsBasketService.getBasketById(id));
    }

    @GetMapping("/{id}/subjects")
    public ResponseEntity<List<ArtsBasketSubject>> getBasketSubjects(@PathVariable UUID id) {
        return ResponseEntity.ok(artsBasketService.getSubjectsForBasket(id));
    }

    @PostMapping
    public ResponseEntity<ArtsBasket> createBasket(@RequestBody ArtsBasket basket) {
        return ResponseEntity.ok(artsBasketService.createBasket(basket));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ArtsBasket> updateBasket(@PathVariable UUID id, @RequestBody ArtsBasket basket) {
        return ResponseEntity.ok(artsBasketService.updateBasket(id, basket));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBasket(@PathVariable UUID id) {
        artsBasketService.deleteBasket(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/subjects")
    public ResponseEntity<ArtsBasketSubject> addSubjectToBasket(
            @PathVariable UUID id,
            @RequestBody ArtsBasketSubject subject) {
        return ResponseEntity.ok(artsBasketService.addSubjectToBasket(id, subject));
    }

    @DeleteMapping("/subjects/{subjectLinkId}")
    public ResponseEntity<Void> removeSubjectFromBasket(@PathVariable UUID subjectLinkId) {
        artsBasketService.removeSubjectFromBasket(subjectLinkId);
        return ResponseEntity.noContent().build();
    }
}

