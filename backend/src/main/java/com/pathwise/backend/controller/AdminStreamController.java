package com.pathwise.backend.controller;

import com.pathwise.backend.entity.Stream;
import com.pathwise.backend.entity.StreamSubject;
import com.pathwise.backend.entity.Subject;
import com.pathwise.backend.service.StreamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/streams")
@RequiredArgsConstructor
@CrossOrigin
public class AdminStreamController {

    private final StreamService streamService;

    @GetMapping
    public ResponseEntity<List<Stream>> listStreams() {
        return ResponseEntity.ok(streamService.getAllStreams());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Stream> getStream(@PathVariable UUID id) {
        return ResponseEntity.ok(streamService.getStreamById(id));
    }

    @PostMapping
    public ResponseEntity<Stream> createStream(@RequestBody Stream stream) {
        return ResponseEntity.ok(streamService.createStream(stream));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Stream> updateStream(@PathVariable UUID id, @RequestBody Stream stream) {
        return ResponseEntity.ok(streamService.updateStream(id, stream));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStream(@PathVariable UUID id) {
        streamService.deleteStream(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/subjects")
    public ResponseEntity<List<Subject>> listSubjects() {
        return ResponseEntity.ok(streamService.getAllSubjects());
    }

    @PostMapping("/subjects")
    public ResponseEntity<Subject> createSubject(@RequestBody Subject subject) {
        return ResponseEntity.ok(streamService.createSubject(subject));
    }

    @GetMapping("/{id}/subjects")
    public ResponseEntity<List<StreamSubject>> getStreamSubjects(@PathVariable UUID id) {
        return ResponseEntity.ok(streamService.getSubjectsForStream(id));
    }
}

