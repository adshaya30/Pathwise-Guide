package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.RecordRejectRequest;
import com.pathwise.backend.dto.RecordReviewRequest;
import com.pathwise.backend.entity.*;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
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
    private final StreamRepository streamRepository;
    private final ObjectMapper objectMapper;

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
            case "STREAM_SUBJECT" -> publishStreamSubject(payload);
            default -> throw new UnsupportedOperationException("Unsupported module type: " + moduleType);
        };
    }

    private String publishCourse(JsonNode p) {
        String code = p.path("code").asText(UUID.randomUUID().toString().substring(0, 6));
        String name = p.path("name").asText("Untitled Course");

        Course course = courseRepository.findByCode(code).orElse(new Course());
        course.setCode(code);
        course.setName(name);
        if (p.has("streamName")) course.setStreamName(p.get("streamName").asText());
        if (p.has("durationYears")) course.setDurationYears(BigDecimal.valueOf(p.get("durationYears").asDouble(4.0)));
        if (p.has("degreeTitle")) course.setDegreeTitle(p.get("degreeTitle").asText());
        if (p.has("details")) course.setDetails(p.get("details").toString());
        if (p.has("minimumRequirements")) course.setMinimumRequirements(p.get("minimumRequirements").toString());
        course.setIsActive(true);

        Course saved = courseRepository.save(course);
        return saved.getId().toString();
    }

    private String publishUniCode(JsonNode p) {
        String code = p.path("code").asText();
        String courseName = p.path("courseName").asText("General Course");
        String uniName = p.path("universityName").asText("General University");

        // Lookup or create Course
        Course course = courseRepository.findByNameIgnoreCase(courseName).orElseGet(() -> {
            Course c = Course.builder()
                    .code(code.replaceAll("[^0-9]", ""))
                    .name(courseName)
                    .build();
            if (c.getCode().isBlank()) c.setCode(UUID.randomUUID().toString().substring(0, 4));
            return courseRepository.save(c);
        });

        // Lookup or create University
        University university = universityRepository.findByNameIgnoreCase(uniName).orElseGet(() -> {
            String uCode = uniName.replaceAll("[^A-Za-z]", "").toUpperCase();
            if (uCode.length() > 6) uCode = uCode.substring(0, 6);
            return universityRepository.save(University.builder().code(uCode).name(uniName).build());
        });

        UniCode uniCode = uniCodeRepository.findByCode(code).orElse(new UniCode());
        uniCode.setCode(code);
        uniCode.setCourseId(course.getId());
        uniCode.setCourseName(course.getName());
        uniCode.setUniversityId(university.getId());
        uniCode.setUniversityName(university.getName());
        if (p.has("description")) uniCode.setDescription(p.get("description").asText());

        UniCode saved = uniCodeRepository.save(uniCode);
        return saved.getId().toString();
    }

    private String publishCutoff(JsonNode p) {
        String uniCodeStr = p.path("uniCode").asText("001A");
        String courseName = p.path("courseName").asText("Course");
        String uniName = p.path("universityName").asText("University");
        String academicYear = p.path("academicYear").asText("2023/2024");

        // Ensure UniCode exists
        UniCode uniCode = uniCodeRepository.findByCode(uniCodeStr).orElseGet(() -> {
            Course c = courseRepository.findByNameIgnoreCase(courseName).orElseGet(() ->
                    courseRepository.save(Course.builder().code(uniCodeStr.replaceAll("[^0-9]", "")).name(courseName).build()));
            University u = universityRepository.findByNameIgnoreCase(uniName).orElseGet(() ->
                    universityRepository.save(University.builder().code(uniName.substring(0, Math.min(6, uniName.length())).toUpperCase()).name(uniName).build()));
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

        Cutoff saved = cutoffRepository.save(cutoff);
        return saved.getId().toString();
    }

    private BigDecimal getDecimal(JsonNode p, String... keys) {
        for (String k : keys) {
            if (p.has(k) && !p.get(k).isNull()) {
                try {
                    return BigDecimal.valueOf(p.get(k).asDouble());
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private String publishDistrict(JsonNode p) {
        String code = p.path("code").asText().toUpperCase();
        String name = p.path("name").asText();
        String province = p.path("province").asText("General");
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
        int basketNumber = p.path("basketNumber").asInt(1);
        String basketName = p.path("basketName").asText("Arts Basket " + basketNumber);

        ArtsBasket basket = artsBasketRepository.findByBasketNumber(basketNumber).orElse(new ArtsBasket());
        basket.setBasketNumber(basketNumber);
        basket.setBasketName(basketName);
        basket.setMinSubjectsRequired(p.path("minSubjectsRequired").asInt(1));
        basket.setMaxSubjectsAllowed(p.path("maxSubjectsAllowed").asInt(3));
        if (p.has("rulesDescription")) basket.setRulesDescription(p.get("rulesDescription").asText());

        ArtsBasket saved = artsBasketRepository.save(basket);

        // Process subjects if present
        if (p.has("subjects") && p.get("subjects").isArray()) {
            for (JsonNode subNode : p.get("subjects")) {
                String subName = subNode.isTextual() ? subNode.asText() : subNode.path("name").asText();
                String subCode = subNode.isObject() && subNode.has("code") ? subNode.get("code").asText() :
                        subName.substring(0, Math.min(4, subName.length())).toUpperCase();

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
        String uniName = p.has("universityName") ? p.get("universityName").asText() :
                p.has("university") ? p.get("university").asText() : "University of Colombo";
        String courseOfStudy = p.has("courseOfStudy") ? p.get("courseOfStudy").asText() :
                p.has("courseName") ? p.get("courseName").asText() : "Arts";
        String uniCode = p.has("uniCode") ? p.get("uniCode").asText() :
                p.has("code") ? p.get("code").asText() : "";
        int differentlyAbled = p.has("differentlyAbled") ? p.get("differentlyAbled").asInt() :
                p.has("differently_abled") ? p.get("differently_abled").asInt() : 0;
        int blindBraille = p.has("blindBraille") ? p.get("blindBraille").asInt() :
                p.has("blind_braille") ? p.get("blind_braille").asInt() : 0;

        String cat = p.path("category").asText("BLIND_AND_DIFFERENTLY_ABLED");
        String title = p.path("title").asText(courseOfStudy + " - " + uniName);
        String description = p.path("description").asText("Special Provision for " + courseOfStudy + " (" + uniCode + ")");

        SpecialProvision sp = SpecialProvision.builder()
                .universityName(uniName)
                .courseOfStudy(courseOfStudy)
                .uniCode(uniCode)
                .differentlyAbled(differentlyAbled)
                .blindBraille(blindBraille)
                .category(cat)
                .title(title)
                .description(description)
                .quotaPercentage(p.has("quotaPercentage") ? BigDecimal.valueOf(p.get("quotaPercentage").asDouble()) : null)
                .conditions(p.path("conditions").asText(null))
                .build();

        SpecialProvision saved = specialProvisionRepository.save(sp);
        return saved.getId().toString();
    }

    private String publishAptitude(JsonNode p) {
        String courseOfStudy = p.has("courseOfStudy") ? p.get("courseOfStudy").asText() :
                p.has("courseName") ? p.get("courseName").asText() : "Course of Study";
        String uniName = p.has("universityName") ? p.get("universityName").asText() :
                p.has("university") ? p.get("university").asText() : "Respective University";
        String uniCode = p.has("uniCode") ? p.get("uniCode").asText() :
                p.has("code") ? p.get("code").asText() : "";
        String testName = p.path("testName").asText("Practical / Aptitude Test");

        Course course = courseRepository.findByNameIgnoreCase(courseOfStudy).orElse(null);

        AptitudeRequirement req = AptitudeRequirement.builder()
                .courseId(course != null ? course.getId() : null)
                .courseName(courseOfStudy)
                .courseOfStudy(courseOfStudy)
                .universityName(uniName)
                .uniCode(uniCode)
                .testName(testName)
                .testDescription(p.path("testDescription").asText(null))
                .passingCriteria(p.path("passingCriteria").asText("Pass in practical/aptitude test"))
                .applicationDeadline(p.path("applicationDeadline").asText(null))
                .conductedBy(p.path("conductedBy").asText(uniName))
                .build();

        AptitudeRequirement saved = aptitudeRequirementRepository.save(req);
        return saved.getId().toString();
    }

    private String publishStreamSubject(JsonNode p) {
        String streamName = p.path("streamName").asText("Stream");
        String code = streamName.replaceAll("[^A-Za-z]", "_").toUpperCase();

        Stream stream = streamRepository.findByCode(code).orElseGet(() ->
                streamRepository.save(Stream.builder().code(code).name(streamName).build()));

        return stream.getId().toString();
    }
}

