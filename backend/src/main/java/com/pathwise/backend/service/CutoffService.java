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
            UniCode uc = uniCodeRepository.findByCode(cutoff.getUniCode()).orElseGet(() -> {
                UniCode newUc = new UniCode();
                newUc.setCode(cutoff.getUniCode());
                newUc.setCourseName(cutoff.getCourseName() != null ? cutoff.getCourseName() : "Course " + cutoff.getUniCode());
                newUc.setUniversityName(cutoff.getUniversityName() != null ? cutoff.getUniversityName() : "University");
                return uniCodeRepository.save(newUc);
            });
            cutoff.setUniCodeId(uc.getId());
            if (cutoff.getCourseName() == null || cutoff.getCourseName().isBlank()) {
                cutoff.setCourseName(uc.getCourseName());
            }
            if (cutoff.getUniversityName() == null || cutoff.getUniversityName().isBlank()) {
                cutoff.setUniversityName(uc.getUniversityName());
            }
        }
        return cutoffRepository.save(cutoff);
    }

    @Transactional
    public Cutoff createCutoffFromMap(java.util.Map<String, Object> payload) {
        Cutoff cutoff = new Cutoff();
        applyMetadata(cutoff, payload);
        populateDistrictsAndNvq(cutoff, payload);
        return createCutoff(cutoff);
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
        existing.setNvqDistricts(updated.getNvqDistricts());

        return cutoffRepository.save(existing);
    }

    @Transactional
    public Cutoff updateCutoffFromMap(UUID id, java.util.Map<String, Object> payload) {
        Cutoff existing = getCutoffById(id);
        applyMetadata(existing, payload);
        populateDistrictsAndNvq(existing, payload);
        return cutoffRepository.save(existing);
    }

    private void applyMetadata(Cutoff cutoff, java.util.Map<String, Object> p) {
        if (p.containsKey("academicYear") && p.get("academicYear") != null) {
            cutoff.setAcademicYear(p.get("academicYear").toString().trim());
        }
        if (p.containsKey("uniCode") && p.get("uniCode") != null) {
            cutoff.setUniCode(p.get("uniCode").toString().trim());
        }
        if (p.containsKey("courseName") && p.get("courseName") != null) {
            cutoff.setCourseName(p.get("courseName").toString().trim());
        }
        if (p.containsKey("universityName") && p.get("universityName") != null) {
            cutoff.setUniversityName(p.get("universityName").toString().trim());
        }
        if (p.containsKey("uniCodeId") && p.get("uniCodeId") != null && !p.get("uniCodeId").toString().isBlank()) {
            try {
                cutoff.setUniCodeId(UUID.fromString(p.get("uniCodeId").toString().trim()));
            } catch (Exception ignored) {}
        }

        if (cutoff.getUniCodeId() == null && cutoff.getUniCode() != null && !cutoff.getUniCode().isBlank()) {
            UniCode uc = uniCodeRepository.findByCode(cutoff.getUniCode()).orElseGet(() -> {
                UniCode newUc = new UniCode();
                newUc.setCode(cutoff.getUniCode());
                newUc.setCourseName(cutoff.getCourseName() != null ? cutoff.getCourseName() : "Course " + cutoff.getUniCode());
                newUc.setUniversityName(cutoff.getUniversityName() != null ? cutoff.getUniversityName() : "University");
                return uniCodeRepository.save(newUc);
            });
            cutoff.setUniCodeId(uc.getId());
            if (cutoff.getCourseName() == null || cutoff.getCourseName().isBlank()) {
                cutoff.setCourseName(uc.getCourseName());
            }
            if (cutoff.getUniversityName() == null || cutoff.getUniversityName().isBlank()) {
                cutoff.setUniversityName(uc.getUniversityName());
            }
        }
    }

    private void populateDistrictsAndNvq(Cutoff cutoff, java.util.Map<String, Object> p) {
        java.util.Set<String> nvqSet = new java.util.LinkedHashSet<>();

        // 1. Process explicit nvqDistricts string or collection if present
        Object explicitNvq = p.get("nvqDistricts");
        if (explicitNvq instanceof java.util.Collection<?> coll) {
            for (Object o : coll) {
                if (o != null && !o.toString().isBlank()) nvqSet.add(o.toString().trim().toLowerCase());
            }
        } else if (explicitNvq instanceof String str) {
            for (String s : str.split(",")) {
                if (!s.isBlank()) nvqSet.add(s.trim().toLowerCase());
            }
        }

        // 2. Process each of the 25 districts
        cutoff.setColombo(parseDistrictValue("colombo", p, nvqSet));
        cutoff.setGampaha(parseDistrictValue("gampaha", p, nvqSet));
        cutoff.setKalutara(parseDistrictValue("kalutara", p, nvqSet));
        cutoff.setKandy(parseDistrictValue("kandy", p, nvqSet));
        cutoff.setMatale(parseDistrictValue("matale", p, nvqSet));
        cutoff.setNuwaraEliya(parseDistrictValue("nuwaraEliya", p, nvqSet));
        cutoff.setGalle(parseDistrictValue("galle", p, nvqSet));
        cutoff.setMatara(parseDistrictValue("matara", p, nvqSet));
        cutoff.setHambantota(parseDistrictValue("hambantota", p, nvqSet));
        cutoff.setJaffna(parseDistrictValue("jaffna", p, nvqSet));
        cutoff.setKilinochchi(parseDistrictValue("kilinochchi", p, nvqSet));
        cutoff.setMannar(parseDistrictValue("mannar", p, nvqSet));
        cutoff.setVavuniya(parseDistrictValue("vavuniya", p, nvqSet));
        cutoff.setMullaitivu(parseDistrictValue("mullaitivu", p, nvqSet));
        cutoff.setBatticaloa(parseDistrictValue("batticaloa", p, nvqSet));
        cutoff.setAmpara(parseDistrictValue("ampara", p, nvqSet));
        cutoff.setTrincomalee(parseDistrictValue("trincomalee", p, nvqSet));
        cutoff.setKurunegala(parseDistrictValue("kurunegala", p, nvqSet));
        cutoff.setPuttalam(parseDistrictValue("puttalam", p, nvqSet));
        cutoff.setAnuradhapura(parseDistrictValue("anuradhapura", p, nvqSet));
        cutoff.setPolonnaruwa(parseDistrictValue("polonnaruwa", p, nvqSet));
        cutoff.setBadulla(parseDistrictValue("badulla", p, nvqSet));
        cutoff.setMonaragala(parseDistrictValue("monaragala", p, nvqSet));
        cutoff.setRatnapura(parseDistrictValue("ratnapura", p, nvqSet));
        cutoff.setKegalle(parseDistrictValue("kegalle", p, nvqSet));

        cutoff.setNvqDistricts(nvqSet.isEmpty() ? null : String.join(",", nvqSet));
    }

    private java.math.BigDecimal parseDistrictValue(String districtKey, java.util.Map<String, Object> p, java.util.Set<String> nvqSet) {
        String snake = districtKey.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
        Object raw = p.getOrDefault(districtKey, p.get(snake));
        if (raw == null) {
            return null;
        }

        String str = raw.toString().trim();
        if (str.isEmpty() || str.equals("-") || str.equalsIgnoreCase("null") || str.equalsIgnoreCase("n/a") || str.equalsIgnoreCase("nqc")) {
            return null;
        }

        if (str.toUpperCase().contains("NVQ")) {
            nvqSet.add(districtKey.toLowerCase());
            return null;
        }

        try {
            java.math.BigDecimal bd = new java.math.BigDecimal(str.replaceAll("\\s+", ""));
            // If numerical, remove from NVQ set
            nvqSet.remove(districtKey.toLowerCase());
            return bd;
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional
    public void deleteCutoff(UUID id) {
        cutoffRepository.deleteById(id);
    }
}

