package com.pathwise.backend.service;

import com.pathwise.backend.entity.Cutoff;
import com.pathwise.backend.entity.UniCode;
import com.pathwise.backend.repository.CutoffRepository;
import com.pathwise.backend.repository.UniCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CutoffService {

    private final CutoffRepository cutoffRepository;
    private final UniCodeRepository uniCodeRepository;

    public List<Cutoff> getAllCutoffs(String academicYear) {
        if (academicYear != null && !academicYear.isBlank()) {
            return cutoffRepository.findByAcademicYearOrderByUniCodeAsc(academicYear);
        }
        return cutoffRepository.findAllByOrderByAcademicYearDescUniCodeAsc();
    }

    public Cutoff getCutoffById(UUID id) {
        return cutoffRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cutoff not found: " + id));
    }

    @Transactional
    public Cutoff createCutoff(Cutoff cutoff) {
        // Auto-fill from UniCode if uniCodeId provided
        if (cutoff.getUniCodeId() != null) {
            UniCode uc = uniCodeRepository.findById(cutoff.getUniCodeId()).orElse(null);
            if (uc != null) {
                cutoff.setUniCode(uc.getCode());
                cutoff.setCourseName(uc.getCourseName());
                cutoff.setUniversityName(uc.getUniversityName());
            }
        } else if (cutoff.getUniCode() != null && !cutoff.getUniCode().isBlank()) {
            UniCode uc = uniCodeRepository.findByCode(cutoff.getUniCode()).orElse(null);
            if (uc != null) {
                cutoff.setUniCodeId(uc.getId());
                cutoff.setCourseName(uc.getCourseName());
                cutoff.setUniversityName(uc.getUniversityName());
            }
        }
        return cutoffRepository.save(cutoff);
    }

    @Transactional
    public Cutoff updateCutoff(UUID id, Cutoff updated) {
        Cutoff existing = getCutoffById(id);
        existing.setUniCodeId(updated.getUniCodeId());
        existing.setUniCode(updated.getUniCode());
        existing.setCourseName(updated.getCourseName());
        existing.setUniversityName(updated.getUniversityName());
        existing.setAcademicYear(updated.getAcademicYear());

        // Update all 25 districts
        existing.setColombo(updated.getColombo());
        existing.setGampaha(updated.getGampaha());
        existing.setKalutara(updated.getKalutara());
        existing.setKandy(updated.getKandy());
        existing.setMatale(updated.getMatale());
        existing.setNuwaraEliya(updated.getNuwaraEliya());
        existing.setGalle(updated.getGalle());
        existing.setMatara(updated.getMatara());
        existing.setHambantota(updated.getHambantota());
        existing.setJaffna(updated.getJaffna());
        existing.setKilinochchi(updated.getKilinochchi());
        existing.setMannar(updated.getMannar());
        existing.setVavuniya(updated.getVavuniya());
        existing.setMullaitivu(updated.getMullaitivu());
        existing.setBatticaloa(updated.getBatticaloa());
        existing.setAmpara(updated.getAmpara());
        existing.setTrincomalee(updated.getTrincomalee());
        existing.setKurunegala(updated.getKurunegala());
        existing.setPuttalam(updated.getPuttalam());
        existing.setAnuradhapura(updated.getAnuradhapura());
        existing.setPolonnaruwa(updated.getPolonnaruwa());
        existing.setBadulla(updated.getBadulla());
        existing.setMonaragala(updated.getMonaragala());
        existing.setRatnapura(updated.getRatnapura());
        existing.setKegalle(updated.getKegalle());

        return cutoffRepository.save(existing);
    }

    @Transactional
    public void deleteCutoff(UUID id) {
        cutoffRepository.deleteById(id);
    }
}
