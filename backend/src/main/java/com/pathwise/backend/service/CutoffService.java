package com.pathwise.backend.service;

import com.pathwise.backend.entity.Cutoff;
import com.pathwise.backend.entity.UniCode;
import com.pathwise.backend.repository.CourseRepository;
import com.pathwise.backend.repository.CutoffRepository;
import com.pathwise.backend.repository.UniCodeRepository;
import com.pathwise.backend.repository.UniversityRepository;
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
    private final CourseRepository courseRepository;
    private final UniversityRepository universityRepository;

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
            UniCode uc = resolveOrCreateUniCode(cutoff.getUniCode(), cutoff.getCourseName(), cutoff.getUniversityName());
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
            UniCode uc = resolveOrCreateUniCode(cutoff.getUniCode(), cutoff.getCourseName(), cutoff.getUniversityName());
            cutoff.setUniCodeId(uc.getId());
            if (cutoff.getCourseName() == null || cutoff.getCourseName().isBlank()) {
                cutoff.setCourseName(uc.getCourseName());
            }
            if (cutoff.getUniversityName() == null || cutoff.getUniversityName().isBlank()) {
                cutoff.setUniversityName(uc.getUniversityName());
            }
        }
    }

    private UniCode resolveOrCreateUniCode(String code, String courseName, String uniName) {
        return uniCodeRepository.findByCode(code).orElseGet(() -> {
            String cName = (courseName != null && !courseName.isBlank()) ? courseName : "Course " + code;
            String uName = (uniName != null && !uniName.isBlank()) ? uniName : "University";

            com.pathwise.backend.entity.Course course = courseRepository.findByNameIgnoreCase(cName).orElseGet(() -> {
                String cCode = code.replaceAll("[^0-9]", "");
                if (cCode.isBlank() || courseRepository.findByCode(cCode).isPresent()) {
                    cCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
                }
                return courseRepository.save(com.pathwise.backend.entity.Course.builder().code(cCode).name(cName).build());
            });

            com.pathwise.backend.entity.University university = universityRepository.findByNameIgnoreCase(uName).orElseGet(() -> {
                String uCode = uName.replaceAll("[^A-Za-z]", "").toUpperCase();
                if (uCode.length() > 6) uCode = uCode.substring(0, 6);
                if (uCode.isBlank() || universityRepository.findByCode(uCode).isPresent()) {
                    uCode = (uCode.length() > 3 ? uCode.substring(0, 3) : "U") + UUID.randomUUID().toString().substring(0, 3).toUpperCase();
                }
                return universityRepository.save(com.pathwise.backend.entity.University.builder().code(uCode).name(uName).build());
            });

            UniCode newUc = new UniCode();
            newUc.setCode(code);
            newUc.setCourseName(course.getName());
            newUc.setCourseId(course.getId());
            newUc.setUniversityName(university.getName());
            newUc.setUniversityId(university.getId());
            return uniCodeRepository.save(newUc);
        });
    }

    private void populateDistrictsAndNvq(Cutoff cutoff, java.util.Map<String, Object> p) {
        java.util.Set<String> nvqSet = new java.util.LinkedHashSet<>();
        if (cutoff.getNvqDistricts() != null && !cutoff.getNvqDistricts().isBlank()) {
            for (String s : cutoff.getNvqDistricts().split(",")) {
                if (!s.isBlank()) nvqSet.add(s.trim().toLowerCase());
            }
        }

        // 1. Process explicit nvqDistricts string or collection if present
        if (p.containsKey("nvqDistricts")) {
            Object explicitNvq = p.get("nvqDistricts");
            nvqSet.clear();
            if (explicitNvq instanceof java.util.Collection<?> coll) {
                for (Object o : coll) {
                    if (o != null && !o.toString().isBlank()) nvqSet.add(o.toString().trim().toLowerCase());
                }
            } else if (explicitNvq instanceof String str) {
                for (String s : str.split(",")) {
                    if (!s.isBlank()) nvqSet.add(s.trim().toLowerCase());
                }
            }
        }

        // 2. Process each of the 25 districts if present in p
        updateDistrictIfPresent("colombo", p, nvqSet, cutoff::setColombo);
        updateDistrictIfPresent("gampaha", p, nvqSet, cutoff::setGampaha);
        updateDistrictIfPresent("kalutara", p, nvqSet, cutoff::setKalutara);
        updateDistrictIfPresent("kandy", p, nvqSet, cutoff::setKandy);
        updateDistrictIfPresent("matale", p, nvqSet, cutoff::setMatale);
        updateDistrictIfPresent("nuwaraEliya", p, nvqSet, cutoff::setNuwaraEliya);
        updateDistrictIfPresent("galle", p, nvqSet, cutoff::setGalle);
        updateDistrictIfPresent("matara", p, nvqSet, cutoff::setMatara);
        updateDistrictIfPresent("hambantota", p, nvqSet, cutoff::setHambantota);
        updateDistrictIfPresent("jaffna", p, nvqSet, cutoff::setJaffna);
        updateDistrictIfPresent("kilinochchi", p, nvqSet, cutoff::setKilinochchi);
        updateDistrictIfPresent("mannar", p, nvqSet, cutoff::setMannar);
        updateDistrictIfPresent("vavuniya", p, nvqSet, cutoff::setVavuniya);
        updateDistrictIfPresent("mullaitivu", p, nvqSet, cutoff::setMullaitivu);
        updateDistrictIfPresent("batticaloa", p, nvqSet, cutoff::setBatticaloa);
        updateDistrictIfPresent("ampara", p, nvqSet, cutoff::setAmpara);
        updateDistrictIfPresent("trincomalee", p, nvqSet, cutoff::setTrincomalee);
        updateDistrictIfPresent("kurunegala", p, nvqSet, cutoff::setKurunegala);
        updateDistrictIfPresent("puttalam", p, nvqSet, cutoff::setPuttalam);
        updateDistrictIfPresent("anuradhapura", p, nvqSet, cutoff::setAnuradhapura);
        updateDistrictIfPresent("polonnaruwa", p, nvqSet, cutoff::setPolonnaruwa);
        updateDistrictIfPresent("badulla", p, nvqSet, cutoff::setBadulla);
        updateDistrictIfPresent("monaragala", p, nvqSet, cutoff::setMonaragala);
        updateDistrictIfPresent("ratnapura", p, nvqSet, cutoff::setRatnapura);
        updateDistrictIfPresent("kegalle", p, nvqSet, cutoff::setKegalle);

        cutoff.setNvqDistricts(nvqSet.isEmpty() ? null : String.join(",", nvqSet));
    }

    private void updateDistrictIfPresent(String districtKey, java.util.Map<String, Object> p, java.util.Set<String> nvqSet, java.util.function.Consumer<java.math.BigDecimal> setter) {
        String snake = districtKey.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
        if (p.containsKey(districtKey) || p.containsKey(snake)) {
            setter.accept(parseDistrictValue(districtKey, p, nvqSet));
        }
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

