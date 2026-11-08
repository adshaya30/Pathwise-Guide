package com.pathwise.backend.service;

import com.pathwise.backend.entity.Stream;
import com.pathwise.backend.entity.StreamSubject;
import com.pathwise.backend.entity.Subject;
import com.pathwise.backend.repository.StreamRepository;
import com.pathwise.backend.repository.StreamSubjectRepository;
import com.pathwise.backend.repository.SubjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StreamService {

    private final StreamRepository streamRepository;
    private final SubjectRepository subjectRepository;
    private final StreamSubjectRepository streamSubjectRepository;

    public List<Stream> getAllStreams() {
        return streamRepository.findAll();
    }

    public Stream getStreamById(UUID id) {
        return streamRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Stream not found: " + id));
    }

    @Transactional
    public Stream createStream(Stream stream) {
        return streamRepository.save(stream);
    }

    @Transactional
    public Stream updateStream(UUID id, Stream updated) {
        Stream existing = getStreamById(id);
        existing.setCode(updated.getCode());
        existing.setName(updated.getName());
        existing.setDescription(updated.getDescription());
        return streamRepository.save(existing);
    }

    @Transactional
    public void deleteStream(UUID id) {
        streamRepository.deleteById(id);
    }

    public List<Subject> getAllSubjects() {
        return subjectRepository.findAll();
    }

    @Transactional
    public Subject createSubject(Subject subject) {
        return subjectRepository.save(subject);
    }

    public List<StreamSubject> getSubjectsForStream(UUID streamId) {
        return streamSubjectRepository.findByStreamId(streamId);
    }
}

