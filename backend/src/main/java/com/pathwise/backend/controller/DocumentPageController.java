package com.pathwise.backend.controller;

import com.pathwise.backend.entity.DocumentPage;
import com.pathwise.backend.repository.DocumentPageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/pages")
@RequiredArgsConstructor
@CrossOrigin
public class DocumentPageController {

    private final DocumentPageRepository documentPageRepository;

    @GetMapping("/{id}")
    public ResponseEntity<DocumentPage> getPage(@PathVariable UUID id) {
        return documentPageRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<DocumentPage> updatePage(
            @PathVariable UUID id,
            @RequestBody DocumentPage updated) {
        return documentPageRepository.findById(id).map(page -> {
            if (updated.getPageType() != null) page.setPageType(updated.getPageType());
            if (updated.getExtractedJson() != null) page.setExtractedJson(updated.getExtractedJson());
            if (updated.getStatus() != null) page.setStatus(updated.getStatus());
            return ResponseEntity.ok(documentPageRepository.save(page));
        }).orElse(ResponseEntity.notFound().build());
    }
}

