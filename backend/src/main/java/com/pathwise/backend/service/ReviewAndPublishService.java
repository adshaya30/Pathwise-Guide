package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.BulkApproveRequest;
import com.pathwise.backend.dto.BulkApproveResponse;
import com.pathwise.backend.dto.RecordRejectRequest;
import com.pathwise.backend.dto.RecordReviewRequest;
import com.pathwise.backend.entity.*;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewAndPublishService {

    private final ExtractedRecordRepository extractedRecordRepository;
    private final CourseRepository courseRepository;
    private final UniCodeRepository uniCodeRepository;
    private final UniversityRepository universityRepository;
    private final CutoffRepository cutoffRepository;
    private final DistrictRepository districtRepository;
    private final ArtsBasketRepository artsBasketRepository;
    private final ArtsBasketSubjectRepository artsBasketSubjectRepository;
    private final SubjectRepository subjectRepository;
    private final SpecialProvisionRepository specialProvisionRepository;
    private final AptitudeRequirementRepository aptitudeRequirementRepository;
    private final OlRequirementRepository olRequirementRepository;
    private final StreamRepository streamRepository;
    private final ObjectMapper objectMapper;
    private final PlatformTransactionManager transactionManager;

    @Transactional
    public ExtractedRecord approveAndPublish(UUID recordId, RecordReviewRequest request) {
        ExtractedRecord record = extractedRecordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("Record not found with ID: " + recordId));

        if ("APPROVED".equals(record.getStatus())) {
            throw new IllegalStateException("Record has already been approved and published.");
        }

        // If the admin supplied updated rawPayload, use it
        if (request != null && request.getRawPayload() != null && !request.getRawPayload().isBlank()) {
            record.setRawPayload(request.getRawPayload());
        }

        String publishedId = null;

        try {
            JsonNode payload = objectMapper.readTree(record.getRawPayload());
            publishedId = publishPayloadToModule(record.getModuleType(), payload);
        } catch (Exception e) {
            log.error("Failed to publish record {}: {}", recordId, e.getMessage(), e);
            throw new RuntimeException("Publication failed: " + e.getMessage(), e);
        }

        record.setStatus("APPROVED");
        record.setPublishedRecordId(publishedId);
        record.setReviewedBy(request != null && request.getReviewedBy() != null ? request.getReviewedBy() : "Admin");
        record.setValidationNotes(request != null ? request.getValidationNotes() : null);
        record.setReviewedAt(OffsetDateTime.now());

        return extractedRecordRepository.save(record);
    }

    public BulkApproveResponse bulkApprove(BulkApproveRequest request) {
        String reviewer = (request != null && request.getReviewedBy() != null && !request.getReviewedBy().isBlank())
                ? request.getReviewedBy()
                : "Chief Admissions Admin";

        List<ExtractedRecord> targetRecords;
        if (request != null && request.getRecordIds() != null && !request.getRecordIds().isEmpty()) {
            targetRecords = extractedRecordRepository.findAllById(request.getRecordIds());
        } else if (request != null && request.getModuleType() != null && !request.getModuleType().isBlank()) {
            targetRecords = extractedRecordRepository.findByModuleTypeAndStatusOrderByCreatedAtDesc(request.getModuleType(), "PENDING");
        } else {
            targetRecords = extractedRecordRepository.findByStatusOrderByCreatedAtDesc("PENDING");
        }

        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        int approvedCount = 0;
        int failedCount = 0;
        List<String> errors = new ArrayList<>();

        for (ExtractedRecord record : targetRecords) {
            if ("APPROVED".equals(record.getStatus())) {
                continue;
            }
            try {
                txTemplate.executeWithoutResult(status -> {
                    ExtractedRecord currentRec = extractedRecordRepository.findById(record.getId())
                            .orElseThrow(() -> new IllegalArgumentException("Record not found: " + record.getId()));
                    if ("APPROVED".equals(currentRec.getStatus())) {
                        return;
                    }
                    try {
                        JsonNode payload = objectMapper.readTree(currentRec.getRawPayload());
                        String publishedId = publishPayloadToModule(currentRec.getModuleType(), payload);

                        currentRec.setStatus("APPROVED");
                        currentRec.setPublishedRecordId(publishedId);
                        currentRec.setReviewedBy(reviewer);
                        currentRec.setReviewedAt(OffsetDateTime.now());
                        extractedRecordRepository.save(currentRec);
                    } catch (Exception e) {
                        throw new RuntimeException(e.getMessage(), e);
                    }
                });
                approvedCount++;
            } catch (Exception e) {
                failedCount++;
                String detail = e.getCause() != null ? e.getCause().getMessage() : e.getMessage();
                String err = String.format("Record %s (Page %d, %s): %s",
                        record.getId(), record.getPageNumber(), record.getModuleType(), detail);
                log.warn("Bulk approval failed for record {}: {}", record.getId(), detail);
                errors.add(err);
            }
        }

        log.info("Bulk approve completed: {} approved, {} failed out of {} total",
                approvedCount, failedCount, targetRecords.size());

        return BulkApproveResponse.builder()
                .totalRequested(targetRecords.size())
                .approvedCount(approvedCount)
                .failedCount(failedCount)
                .errors(errors)
                .build();
    }

    @Transactional
    public ExtractedRecord rejectRecord(UUID recordId, RecordRejectRequest request) {
        ExtractedRecord record = extractedRecordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("Record not found with ID: " + recordId));

        record.setStatus("REJECTED");
        record.setRejectionReason(request != null ? request.getRejectionReason() : "Rejected by administrator");
        record.setReviewedBy(request != null && request.getReviewedBy() != null ? request.getReviewedBy() : "Admin");
        record.setReviewedAt(OffsetDateTime.now());

        return extractedRecordRepository.save(record);
    }

    @Transactional
    public ExtractedRecord updateRecordPayload(UUID recordId, String newPayload, String notes) {
        ExtractedRecord record = extractedRecordRepository.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("Record not found with ID: " + recordId));

        if ("APPROVED".equals(record.getStatus())) {
            throw new IllegalStateException("Cannot edit an already approved record.");
        }

        record.setRawPayload(newPayload);
        if (notes != null) {
            record.setValidationNotes(notes);
        }
        return extractedRecordRepository.save(record);
    }

    private String publishPayloadToModule(String moduleType, JsonNode payload) throws Exception {
        return switch (moduleType.toUpperCase()) {
            case "COURSE" -> publishCourse(payload);
            case "UNI_CODE" -> publishUniCode(payload);
            case "CUTOFF" -> publishCutoff(payload);
            case "DISTRICT" -> publishDistrict(payload);
            case "ARTS_BASKET" -> publishArtsBasket(payload);
            case "SPECIAL_PROVISION" -> publishSpecialProvision(payload);
            case "APTITUDE" -> publishAptitude(payload);
            case "OL_REQUIREMENT", "GCE_OL_REQUIREMENT", "OL" -> publishOlRequirement(payload);
            case "STREAM_SUBJECT" -> publishStreamSubject(payload);
            default -> throw new UnsupportedOperationException("Unsupported module type: " + moduleType);
        };
    }

    private String publishCourse(JsonNode p) {
        String code = p.path("code").asText("").trim();
        String name = p.path("name").asText("").trim();
        if (code.isBlank()) {
            code = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        }

        Course course = courseRepository.findByCode(code)
                .or(() -> !name.isBlank() ? courseRepository.findByNameIgnoreCase(name) : Optional.empty())
                .orElse(new Course());
        course.setCode(code);
        course.setName(name);
        if (p.has("streamName")) course.setStreamName(p.get("streamName").asText("").trim());
        if (p.has("totalIntake")) course.setTotalIntake(p.get("totalIntake").asInt());
        if (p.has("minimumEligibility")) course.setMinimumEligibility(p.get("minimumEligibility").asText("").trim());
        if (p.has("durationYears") && !p.get("durationYears").isNull()) {
            course.setDurationYears(BigDecimal.valueOf(p.get("durationYears").asDouble()));
        }
        if (p.has("degreeTitle")) course.setDegreeTitle(p.get("degreeTitle").asText("").trim());
        if (p.has("details")) course.setDetails(p.get("details").toString());
        if (p.has("minimumRequirements")) course.setMinimumRequirements(p.get("minimumRequirements").toString());
        course.setIsActive(true);

        Course saved = courseRepository.save(course);
        return saved.getId().toString();
    }

    private String publishUniCode(JsonNode p) {
        String code = p.path("code").asText("").trim().toUpperCase();
        String courseName = p.path("courseName").asText("").trim();
        String uniName = p.path("universityName").asText("").trim();

        // Lookup or create Course
        Course course = courseRepository.findByNameIgnoreCase(courseName).orElseGet(() -> {
            String cCode = code.replaceAll("[^0-9]", "");
            if (cCode.isBlank() || courseRepository.findByCode(cCode).isPresent()) {
                cCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            }
            return courseRepository.save(Course.builder()
                    .code(cCode)
                    .name(courseName)
                    .build());
        });

        // Lookup or create University
        University university = universityRepository.findByNameIgnoreCase(uniName).orElseGet(() -> {
            String uCode = uniName.replaceAll("[^A-Za-z]", "").toUpperCase();
            if (uCode.length() > 6) uCode = uCode.substring(0, 6);
            if (uCode.isBlank() || universityRepository.findByCode(uCode).isPresent()) {
                uCode = (uCode.length() > 3 ? uCode.substring(0, 3) : "U") + UUID.randomUUID().toString().substring(0, 3).toUpperCase();
            }
            return universityRepository.save(University.builder().code(uCode).name(uniName).build());
        });

        UniCode uniCode = uniCodeRepository.findByCode(code).orElse(new UniCode());
        uniCode.setCode(code);
        uniCode.setCourseId(course.getId());
        uniCode.setCourseName(course.getName());
        uniCode.setUniversityId(university.getId());
        uniCode.setUniversityName(university.getName());

        UniCode saved = uniCodeRepository.save(uniCode);
        return saved.getId().toString();
    }

    private String publishCutoff(JsonNode p) {
        String uniCodeStr = p.path("uniCode").asText("").trim().toUpperCase();
        String courseName = p.path("courseName").asText("").trim();
        String uniName = p.path("universityName").asText("").trim();
        String academicYear = p.path("academicYear").asText("").trim();
        if (academicYear.isBlank() && p.hasNonNull("handbookAcademicYear")) {
            academicYear = DocumentProcessingService.deriveCutoffAcademicYear(p.get("handbookAcademicYear").asText());
        }

        // Ensure UniCode exists
        UniCode uniCode = uniCodeRepository.findByCode(uniCodeStr).orElseGet(() -> {
            Course c = courseRepository.findByNameIgnoreCase(courseName).orElseGet(() -> {
                String cCode = uniCodeStr.replaceAll("[^0-9]", "");
                if (cCode.isBlank() || courseRepository.findByCode(cCode).isPresent()) {
                    cCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
                }
                return courseRepository.save(Course.builder().code(cCode).name(courseName).build());
            });
            University u = universityRepository.findByNameIgnoreCase(uniName).orElseGet(() -> {
                String uCode = uniName.replaceAll("[^A-Za-z]", "").toUpperCase();
                if (uCode.length() > 6) uCode = uCode.substring(0, 6);
                if (uCode.isBlank() || universityRepository.findByCode(uCode).isPresent()) {
                    uCode = (uCode.length() > 3 ? uCode.substring(0, 3) : "U") + UUID.randomUUID().toString().substring(0, 3).toUpperCase();
                }
                return universityRepository.save(University.builder().code(uCode).name(uniName).build());
            });
            return uniCodeRepository.save(UniCode.builder()
                    .code(uniCodeStr)
                    .courseId(c.getId())
                    .courseName(c.getName())
                    .universityId(u.getId())
                    .universityName(u.getName())
                    .build());
        });

        Cutoff cutoff = cutoffRepository.findByUniCodeIdAndAcademicYear(uniCode.getId(), academicYear)
                .orElse(new Cutoff());

        cutoff.setUniCodeId(uniCode.getId());
        cutoff.setUniCode(uniCode.getCode());
        cutoff.setCourseName(uniCode.getCourseName());
        cutoff.setUniversityName(uniCode.getUniversityName());
        cutoff.setAcademicYear(academicYear);

        // Map district values
        cutoff.setColombo(getDecimal(p, "colombo"));
        cutoff.setGampaha(getDecimal(p, "gampaha"));
        cutoff.setKalutara(getDecimal(p, "kalutara"));
        cutoff.setKandy(getDecimal(p, "kandy"));
        cutoff.setMatale(getDecimal(p, "matale"));
        cutoff.setNuwaraEliya(getDecimal(p, "nuwaraEliya", "nuwara_eliya"));
        cutoff.setGalle(getDecimal(p, "galle"));
        cutoff.setMatara(getDecimal(p, "matara"));
        cutoff.setHambantota(getDecimal(p, "hambantota"));
        cutoff.setJaffna(getDecimal(p, "jaffna"));
        cutoff.setKilinochchi(getDecimal(p, "kilinochchi"));
        cutoff.setMannar(getDecimal(p, "mannar"));
        cutoff.setVavuniya(getDecimal(p, "vavuniya"));
        cutoff.setMullaitivu(getDecimal(p, "mullaitivu"));
        cutoff.setBatticaloa(getDecimal(p, "batticaloa"));
        cutoff.setAmpara(getDecimal(p, "ampara"));
        cutoff.setTrincomalee(getDecimal(p, "trincomalee"));
        cutoff.setKurunegala(getDecimal(p, "kurunegala"));
        cutoff.setPuttalam(getDecimal(p, "puttalam"));
        cutoff.setAnuradhapura(getDecimal(p, "anuradhapura"));
        cutoff.setPolonnaruwa(getDecimal(p, "polonnaruwa"));
        cutoff.setBadulla(getDecimal(p, "badulla"));
        cutoff.setMonaragala(getDecimal(p, "monaragala"));
        cutoff.setRatnapura(getDecimal(p, "ratnapura"));
        cutoff.setKegalle(getDecimal(p, "kegalle"));

        // Detect and store NVQ districts
        List<String> nvqList = new ArrayList<>();
        for (String districtKey : GeminiExtractionService.DISTRICT_KEYS) {
            if (p.has(districtKey)) {
                String valStr = p.get(districtKey).asText();
                if (valStr != null && valStr.toUpperCase().contains("NVQ")) {
                    nvqList.add(districtKey.toLowerCase());
                }
            }
        }
        if (p.has("nvqDistricts")) {
            JsonNode nvqNode = p.get("nvqDistricts");
            if (nvqNode.isArray()) {
                for (JsonNode n : nvqNode) {
                    String dName = n.asText().toLowerCase().trim();
                    if (!dName.isEmpty() && !nvqList.contains(dName)) {
                        nvqList.add(dName);
                    }
                }
            } else if (nvqNode.isTextual()) {
                for (String part : nvqNode.asText().split(",")) {
                    String dName = part.toLowerCase().trim();
                    if (!dName.isEmpty() && !nvqList.contains(dName)) {
                        nvqList.add(dName);
                    }
                }
            }
        }
        cutoff.setNvqDistricts(nvqList.isEmpty() ? null : String.join(",", nvqList));

        Cutoff saved = cutoffRepository.save(cutoff);
        return saved.getId().toString();
    }

    private BigDecimal getDecimal(JsonNode p, String... keys) {
        for (String k : keys) {
            if (p.has(k) && !p.get(k).isNull()) {
                try {
                    String text = p.get(k).asText().trim();
                    if (text.isEmpty() || text.equals("-") || text.equalsIgnoreCase("null") || text.equalsIgnoreCase("n/a") || text.toUpperCase().contains("NVQ")) {
                        return null;
                    }
                    return new BigDecimal(text);
                } catch (Exception ignored) {}
            }
            // Case-insensitive / snake_case check
            String snake = k.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
            if (!snake.equals(k) && p.has(snake) && !p.get(snake).isNull()) {
                try {
                    String text = p.get(snake).asText().trim();
                    if (text.isEmpty() || text.equals("-") || text.equalsIgnoreCase("null") || text.equalsIgnoreCase("n/a") || text.toUpperCase().contains("NVQ")) {
                        return null;
                    }
                    return new BigDecimal(text);
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private String publishDistrict(JsonNode p) {
        String code = p.path("code").asText("").trim().toUpperCase();
        String name = p.path("name").asText("").trim();
        String province = p.path("province").asText("").trim();
        boolean hasDisadvantage = p.path("hasDisadvantage").asBoolean(false);

        District district = districtRepository.findByCode(code).orElse(new District());
        district.setCode(code);
        district.setName(name);
        district.setProvince(province);
        district.setHasDisadvantage(hasDisadvantage);

        District saved = districtRepository.save(district);
        return saved.getId().toString();
    }

    private String publishArtsBasket(JsonNode p) {
        int basketNumber = p.path("basketNumber").asInt(0);
        String basketName = p.path("basketName").asText("").trim();
        if (basketName.isBlank() && basketNumber > 0) {
            basketName = "Basket " + basketNumber;
        }

        ArtsBasket basket = artsBasketRepository.findByBasketNumber(basketNumber).orElse(new ArtsBasket());
        basket.setBasketNumber(basketNumber);
        basket.setBasketName(basketName);
        basket.setMinSubjectsRequired(p.path("minSubjectsRequired").asInt(1));
        basket.setMaxSubjectsAllowed(p.path("maxSubjectsAllowed").asInt(3));
        if (p.has("rulesDescription")) basket.setRulesDescription(p.get("rulesDescription").asText("").trim());

        ArtsBasket saved = artsBasketRepository.save(basket);

        // Process subjects if present
        if (p.has("subjects") && p.get("subjects").isArray()) {
            for (JsonNode subNode : p.get("subjects")) {
                String subName = subNode.isTextual() ? subNode.asText().trim() : subNode.path("name").asText("").trim();
                String subCode = subNode.isObject() && subNode.has("code") ? subNode.get("code").asText().trim() :
                        (subName.length() > 4 ? subName.substring(0, 4).toUpperCase() : subName.toUpperCase());

                Subject sub = subjectRepository.findByNameIgnoreCase(subName).orElseGet(() ->
                        subjectRepository.save(Subject.builder().code(subCode).name(subName).basketCategory("ARTS").build()));

                if (artsBasketSubjectRepository.findByBasketIdAndSubjectId(saved.getId(), sub.getId()).isEmpty()) {
                    artsBasketSubjectRepository.save(ArtsBasketSubject.builder()
                            .basketId(saved.getId())
                            .subjectId(sub.getId())
                            .subjectName(sub.getName())
                            .subjectCode(sub.getCode())
                            .build());
                }
            }
        }

        return saved.getId().toString();
    }

    private String publishSpecialProvision(JsonNode p) {
        String uniName = p.hasNonNull("universityName") ? p.get("universityName").asText().trim() :
                p.hasNonNull("university") ? p.get("university").asText().trim() : "";
        String courseOfStudy = p.hasNonNull("courseOfStudy") ? p.get("courseOfStudy").asText().trim() :
                p.hasNonNull("courseName") ? p.get("courseName").asText().trim() : "";
        String uniCode = p.hasNonNull("uniCode") ? p.get("uniCode").asText().trim().toUpperCase() :
                p.hasNonNull("code") ? p.get("code").asText().trim().toUpperCase() : "";
        int differentlyAbled = p.has("differentlyAbled") ? p.get("differentlyAbled").asInt() :
                p.has("differently_abled") ? p.get("differently_abled").asInt() : 0;
        int blindBraille = p.has("blindBraille") ? p.get("blindBraille").asInt() :
                p.has("blind_braille") ? p.get("blind_braille").asInt() : 0;

        // Check if record already exists by uniCode or (universityName, courseOfStudy, uniCode)
        SpecialProvision sp = null;
        if (!uniCode.isBlank()) {
            sp = specialProvisionRepository.findByUniCode(uniCode).orElse(null);
        }
        if (sp == null && !uniName.isBlank() && !courseOfStudy.isBlank()) {
            sp = specialProvisionRepository.findByUniversityNameAndCourseOfStudyAndUniCode(uniName, courseOfStudy, uniCode).orElse(null);
        }

        if (sp == null) {
            sp = SpecialProvision.builder()
                    .universityName(uniName)
                    .courseOfStudy(courseOfStudy)
                    .uniCode(uniCode)
                    .differentlyAbled(differentlyAbled)
                    .blindBraille(blindBraille)
                    .build();
        } else {
            sp.setUniversityName(uniName);
            sp.setCourseOfStudy(courseOfStudy);
            sp.setDifferentlyAbled(differentlyAbled);
            sp.setBlindBraille(blindBraille);
        }

        SpecialProvision saved = specialProvisionRepository.save(sp);
        return saved.getId().toString();
    }

    private String publishAptitude(JsonNode p) {
        String courseOfStudy = p.hasNonNull("courseOfStudy") ? p.get("courseOfStudy").asText().trim() :
                p.hasNonNull("courseName") ? p.get("courseName").asText().trim() : "";
        String uniName = p.hasNonNull("universityName") ? p.get("universityName").asText().trim() :
                p.hasNonNull("university") ? p.get("university").asText().trim() : "";
        String uniCode = p.hasNonNull("uniCode") ? p.get("uniCode").asText().trim().toUpperCase() :
                p.hasNonNull("code") ? p.get("code").asText().trim().toUpperCase() : "";
        Course course = !courseOfStudy.isBlank() ? courseRepository.findByNameIgnoreCase(courseOfStudy).orElse(null) : null;

        AptitudeRequirement req = AptitudeRequirement.builder()
                .courseId(course != null ? course.getId() : null)
                .courseName(courseOfStudy)
                .courseOfStudy(courseOfStudy)
                .universityName(uniName)
                .uniCode(uniCode)
                .conductedBy(p.path("conductedBy").asText(uniName).trim())
                .build();

        AptitudeRequirement saved = aptitudeRequirementRepository.save(req);
        return saved.getId().toString();
    }

    private String publishOlRequirement(JsonNode p) {
        String uniCodes = p.has("uniCodes") ? p.get("uniCodes").asText().trim() :
                p.has("uniCode") ? p.get("uniCode").asText().trim() : "";
        String courseOfStudy = p.has("courseOfStudy") ? p.get("courseOfStudy").asText().trim() :
                p.has("courseName") ? p.get("courseName").asText().trim() : "";

        String sinLang = p.has("sinhalaLanguage") ? p.get("sinhalaLanguage").asText().trim() :
                p.has("sinLang") ? p.get("sinLang").asText().trim() : "";
        String eng = p.has("english") ? p.get("english").asText().trim() :
                p.has("eng") ? p.get("eng").asText().trim() : "";
        String mat = p.has("mathematics") ? p.get("mathematics").asText().trim() :
                p.has("mat") ? p.get("mat").asText().trim() : "";
        String sci = p.has("science") ? p.get("science").asText().trim() :
                p.has("sci") ? p.get("sci").asText().trim() : "";
        String tamLang = p.has("tamilLanguage") ? p.get("tamilLanguage").asText().trim() :
                p.has("tamLang") ? p.get("tamLang").asText().trim() : "";
        String notes = p.path("notes").asText("").trim();

        OlRequirement req = null;
        if (!uniCodes.isBlank()) {
            req = olRequirementRepository.findByUniCodes(uniCodes).orElse(null);
        }
        if (req == null && !courseOfStudy.isBlank()) {
            req = olRequirementRepository.findByCourseOfStudyIgnoreCase(courseOfStudy).orElse(null);
        }

        if (req == null) {
            req = OlRequirement.builder()
                    .uniCodes(uniCodes)
                    .courseOfStudy(courseOfStudy)
                    .sinhalaLanguage(sinLang)
                    .english(eng)
                    .mathematics(mat)
                    .science(sci)
                    .tamilLanguage(tamLang)
                    .notes(notes)
                    .build();
        } else {
            req.setUniCodes(uniCodes);
            req.setCourseOfStudy(courseOfStudy);
            req.setSinhalaLanguage(sinLang);
            req.setEnglish(eng);
            req.setMathematics(mat);
            req.setScience(sci);
            req.setTamilLanguage(tamLang);
            if (!notes.isBlank()) req.setNotes(notes);
        }

        OlRequirement saved = olRequirementRepository.save(req);
        return saved.getId().toString();
    }

    private String publishStreamSubject(JsonNode p) {
        String streamName = p.path("streamName").asText("").trim();
        if (streamName.isBlank()) {
            throw new IllegalArgumentException("Stream name cannot be blank.");
        }
        String rawCode = streamName.replaceAll("[^A-Za-z0-9]", "_").toUpperCase();
        final String streamCode = rawCode.isBlank() ? "STREAM_" + UUID.randomUUID().toString().substring(0, 4).toUpperCase() : rawCode;

        Stream stream = streamRepository.findByCode(streamCode)
                .or(() -> streamRepository.findByNameIgnoreCase(streamName))
                .orElseGet(() -> streamRepository.save(Stream.builder().code(streamCode).name(streamName).build()));

        return stream.getId().toString();
    }
}

