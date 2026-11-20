package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.entity.UniCode;
import com.pathwise.backend.entity.University;
import com.pathwise.backend.repository.UniCodeRepository;
import com.pathwise.backend.repository.UniversityRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
public class GeminiExtractionService {

    private final ObjectMapper objectMapper;
    private final UniversityRepository universityRepository;
    private final UniCodeRepository uniCodeRepository;
    private final HttpClient httpClient;

    @Value("${pathwise.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${pathwise.gemini.model:gemini-3.5-flash}")
    private String geminiModel;

    public static final List<String> DISTRICT_KEYS = List.of(
            "colombo", "gampaha", "kalutara", "kandy", "matale", "nuwaraEliya",
            "galle", "matara", "hambantota", "jaffna", "kilinochchi", "mannar",
            "vavuniya", "mullaitivu", "batticaloa", "ampara", "trincomalee",
            "kurunegala", "puttalam", "anuradhapura", "polonnaruwa", "badulla",
            "monaragala", "ratnapura", "kegalle"
    );

    public static final List<String> ALL_EXPECTED_DISTRICTS = List.of(
            "COLOMBO", "GAMPAHA", "KALUTARA", "MATALE", "KANDY", "NUWARA ELIYA",
            "GALLE", "MATARA", "HAMBANTOTA", "JAFFNA", "KILINOCHCHI", "MANNAR",
            "MULLAITIVU", "VAVUNIYA", "TRINCOMALEE", "BATTICALOA", "AMPARA",
            "PUTTALAM", "KURUNEGALA", "ANURADHAPURA", "POLONNARUWA",
            "BADULLA", "MONARAGALA", "KEGALLE", "RATNAPURA"
    );

    public static final List<List<String>> DISTRICT_GROUPS = List.of(
            // Chunk 1/5: Western + Central (5 Districts)
            List.of("COLOMBO", "GAMPAHA", "KALUTARA", "MATALE", "KANDY"),

            // Chunk 2/5: Central + Southern (5 Districts)
            List.of("NUWARA ELIYA", "GALLE", "MATARA", "HAMBANTOTA", "JAFFNA"),

            // Chunk 3/5: Northern + Eastern (5 Districts)
            List.of("KILINOCHCHI", "MANNAR", "MULLAITIVU", "VAVUNIYA", "TRINCOMALEE"),

            // Chunk 4/5: Eastern + North Western + North Central (5 Districts)
            List.of("BATTICALOA", "AMPARA", "PUTTALAM", "KURUNEGALA", "ANURADHAPURA"),

            // Chunk 5/5: North Central + Uva + Sabaragamuwa (5 Districts)
            List.of("POLONNARUWA", "BADULLA", "MONARAGALA", "KEGALLE", "RATNAPURA")
    );

    private static final List<String> NON_UNIVERSITY_DISTRICT_NAMES = List.of(
            "GAMPAHA", "KALUTARA", "MATALE", "NUWARA ELIYA", "GALLE", "MATARA",
            "HAMBANTOTA", "KILINOCHCHI", "MANNAR", "MULLAITIVU", "PUTTALAM",
            "KURUNEGALA", "ANURADHAPURA", "POLONNARUWA", "BADULLA", "MONARAGALA",
            "KEGALLE", "RATNAPURA"
    );

    public static final List<String> KNOWN_UNIVERSITIES = List.of(
            "UNIVERSITY OF COLOMBO SCHOOL OF COMPUTING",
            "UNIVERSITY OF COLOMBO",
            "UNIVERSITY OF PERADENIYA",
            "UNIVERSITY OF SRI JAYEWARDENEPURA",
            "UNIVERSITY OF KELANIYA",
            "UNIVERSITY OF MORATUWA",
            "UNIVERSITY OF JAFFNA",
            "UNIVERSITY OF RUHUNA",
            "EASTERN UNIVERSITY, SRI LANKA",
            "EASTERN UNIVERSITY",
            "SOUTH EASTERN UNIVERSITY OF SRI LANKA",
            "SOUTH EASTERN UNIVERSITY",
            "RAJARATA UNIVERSITY OF SRI LANKA",
            "RAJARATA UNIVERSITY",
            "WAYAMBA UNIVERSITY OF SRI LANKA",
            "WAYAMBA UNIVERSITY",
            "SABARAGAMUWA UNIVERSITY OF SRI LANKA",
            "SABARAGAMUWA UNIVERSITY",
            "UVA WELLASSA UNIVERSITY OF SRI LANKA",
            "UVA WELLASSA UNIVERSITY",
            "UNIVERSITY OF THE VISUAL AND PERFORMING ARTS",
            "GAMPAHA WICKRAMARACHCHI UNIVERSITY OF INDIGENOUS MEDICINE",
            "GAMPAHA WICKRAMARACHCHI UNIVERSITY",
            "OPEN UNIVERSITY OF SRI LANKA",
            "UNIVERSITY OF VAVUNIYA, SRI LANKA",
            "UNIVERSITY OF VAVUNIYA",
            "SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA",
            "SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES",
            "SWAMY VIPULANANDA INSTITUTE",
            "TRINCOMALEE CAMPUS, EASTERN UNIVERSITY, SRI LANKA",
            "TRINCOMALEE CAMPUS, EASTERN UNIVERSITY",
            "TRINCOMALEE CAMPUS",
            "SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO",
            "SRIPALEE CAMPUS",
            "INSTITUTE OF INDIGENOUS MEDICINE"
    );

    private static final List<String> APPROVED_MODELS = List.of(
            "gemini-3.5-flash",
            "gemini-flash-lite-latest",
            "gemini-3.8-flash",
            "gemini-flash-latest"
    );

    public GeminiExtractionService(
            ObjectMapper objectMapper,
            @Autowired(required = false) UniversityRepository universityRepository,
            @Autowired(required = false) UniCodeRepository uniCodeRepository) {
        this.objectMapper = objectMapper;
        this.universityRepository = universityRepository;
        this.uniCodeRepository = uniCodeRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public static class ExtractionResult {
        public String pageType;
        public Double confidence;
        public List<Map<String, Object>> items = new ArrayList<>();
        public String rawJson;
    }

    /**
     * Primary entry point: extracts structured records from page using Vision if available,
     * falling back to text analysis and rule-based extraction.
     */
    public ExtractionResult extractFromPage(String base64Image, String pageText, int pageNumber) {
        if ((base64Image == null || base64Image.isBlank()) && (pageText == null || pageText.isBlank())) {
            ExtractionResult empty = new ExtractionResult();
            empty.pageType = "EMPTY";
            empty.confidence = 1.0;
            empty.rawJson = "{}";
            return empty;
        }

        // Check if Gemini Vision can be invoked
        if (geminiApiKey != null && !geminiApiKey.isBlank() && base64Image != null && !base64Image.isBlank()) {
            try {
                boolean isCutoff = isCutoffMarksPage(pageText, pageNumber);
                if (isCutoff) {
                    log.info("Page {} identified as Cutoff Marks table. Running 5-chunk partitioned Vision extraction.", pageNumber);
                    return extractCutoffsWithChunkingVision(base64Image, pageNumber);
                } else if (isHandbookTableContent(pageText)) {
                    log.info("Page {} identified as UGC Handbook table/content. Running targeted Vision extraction.", pageNumber);
                    return extractHandbookPageTableVision(base64Image, pageNumber);
                } else {
                    log.info("Page {} has no recognized handbook table structure. Using fast text classification.", pageNumber);
                }
            } catch (Exception e) {
                log.warn("Gemini Vision extraction failed on page {}: {}. Falling back to rule-based extractor.", pageNumber, e.getMessage());
            }
        }

        // Fallback: rule-based extraction from page text
        return ruleBasedExtraction(pageText != null ? pageText : "", pageNumber);
    }

    /**
     * Compatibility overload for callers passing text only.
     */
    public ExtractionResult extractFromPageText(String pageText, int pageNumber) {
        return extractFromPage(null, pageText, pageNumber);
    }

    // ─── CUTOFF TABLE EXTRACTION (5-CHUNK PARTITIONING) ──────────────────────────

    /**
     * Extracts dense landscape Cutoff Marks table by querying Gemini Vision in 5 district groups.
     * Unpivots each group into standard rows and combines them into 25-district records.
     */
    private ExtractionResult extractCutoffsWithChunkingVision(String base64Image, int pageNumber) {
        List<String> extractedParts = new ArrayList<>();
        Set<String> foundDistricts = new HashSet<>();

        for (int i = 0; i < DISTRICT_GROUPS.size(); i++) {
            List<String> group = DISTRICT_GROUPS.get(i);
            int part = i + 1;
            int totalParts = DISTRICT_GROUPS.size();

            String prompt = String.format("""
                You are an expert OCR table extractor specialized in UGC Sri Lanka University Admission Handbooks and Cutoff Documents.

                This page contains:
                "UNIVERSITY ADMISSION - ACADEMIC YEAR ...
                [Based on the results of the G.C.E. (Advanced Level) Examination ... (after re- scrutiny)]
                Minimum \\"Z\\" Scores for selection to various Courses of Study of Universities, in respect of each district"

                CRITICAL PROVINCE GROUP EXTRACTION (Part %d of %d):
                You MUST extract ALL course and university rows visible on this page ONLY for the following specific districts:
                %s

                Format as standard 4-column Markdown rows:
                `| District | Course of Study | University | Minimum Z-Score / Cutoff |`

                Rules:
                1. Extract ALL courses & universities on this page for EVERY one of the listed districts (%s).
                2. Score specifications:
                   - Minimum Z-scores must be decimal values strictly within the range 0.0000 to 3.0000 (e.g. 1.8492, 0.9541, 2.1500).
                   - If a cutoff is designated as 'NVQ', output exactly 'NVQ'.
                   - If a cutoff is 'NQC', output 'NQC'.
                   - If not offered, absent, or represented as a dash, output '-'.
                   - If blank or empty, output '-'.
                3. Special column aliases:
                   - For RATNAPURA: Column header may be printed as 'RATNAPURA' / 'RATHNAPURA' / 'RATNA.'. Output district as 'RATNAPURA'.
                   - For KURUNEGALA: Column header may be printed as 'KURUNEGALA' / 'KURU.' / 'KURUN.'. Output district as 'KURUNEGALA'.
                   - For KEGALLE: Column header may be printed as 'KEGALLA' / 'KEGALLE' / 'KEG.'. Output district as 'KEGALLE'.
                4. Do NOT include table headers, markdown code fences (no ```), or intro text.
                5. Return ONLY data rows starting with `|`.
                6. Do NOT skip 'NVQ' entries.
                7. Do NOT extract districts that are not in this group.
                """, part, totalParts, String.join(", ", group), String.join(", ", group));

            try {
                String chunkResult = callGeminiVisionWithRetry(base64Image, pageNumber, prompt);
                extractedParts.add(chunkResult);
                extractDistrictsFromMarkdown(chunkResult).forEach(foundDistricts::add);
                try {
                    Thread.sleep(500);
                } catch (InterruptedException ignored) {}
            } catch (Exception e) {
                log.warn("Chunk {}/{} failed for cutoff page {}: {}", part, totalParts, pageNumber, e.getMessage());
                extractedParts.add("");
            }
        }

        // Combine all chunks into unified unpivoted markdown
        String combinedMarkdown = combineExtractedCutoffParts(extractedParts);

        // Convert the unpivoted Markdown table to our schema Cutoff records
        List<Map<String, Object>> cutoffRecords = parseMarkdownToCutoffRecords(combinedMarkdown);

        ExtractionResult result = new ExtractionResult();
        result.pageType = "CUTOFF";
        result.confidence = 0.98;
        result.items = cutoffRecords;

        try {
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("pageType", "CUTOFF");
            wrapper.put("confidence", result.confidence);
            wrapper.put("items", result.items);
            result.rawJson = objectMapper.writeValueAsString(wrapper);
        } catch (Exception e) {
            result.rawJson = "{}";
        }

        return result;
    }

    private String combineExtractedCutoffParts(List<String> parts) {
        StringBuilder sb = new StringBuilder();
        sb.append("| District | Course of Study | University | Minimum Z-Score / Cutoff |\n");
        sb.append("|---|---|---|---|\n");

        for (String part : parts) {
            if (part == null || part.isBlank()) continue;
            String cleaned = cleanMarkdownFences(part);
            for (String line : cleaned.split("\\r?\\n")) {
                String trimmed = line.trim();
                if (trimmed.startsWith("|") && !trimmed.toLowerCase().contains("district |") && !trimmed.contains("---")) {
                    sb.append(trimmed).append("\n");
                }
            }
        }
        return sb.toString();
    }

    /**
     * Aggregates unpivoted rows (| District | Course | University | Score |)
     * into 25-district records matching PathWise Cutoff entity schema.
     */
    private List<Map<String, Object>> parseMarkdownToCutoffRecords(String markdown) {
        // Group: (courseName + "|||" + universityName) -> Map<DistrictKey, Score>
        Map<String, Map<String, Object>> courseGroups = new LinkedHashMap<>();
        Map<String, List<String>> nvqGroups = new LinkedHashMap<>();

        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.toLowerCase().contains("district |") || trimmed.contains("---")) {
                continue;
            }

            String[] cells = trimmed.split("\\|");
            if (cells.length >= 5) {
                String rawDistrict = cells[1].trim();
                String course = cells[2].trim();
                String uni = cells[3].trim();
                String scoreStr = cells[4].trim();

                String normDistrict = normalizeDistrictName(rawDistrict);
                String districtKey = toDistrictCamelCase(normDistrict);
                if (districtKey == null || course.isBlank() || uni.isBlank()) {
                    continue;
                }

                String groupKey = course.toUpperCase() + "|||" + uni.toUpperCase();
                Map<String, Object> districtMap = courseGroups.computeIfAbsent(groupKey, k -> new HashMap<>());

                if (scoreStr.toUpperCase().contains("NVQ")) {
                    districtMap.put(districtKey, null);
                    nvqGroups.computeIfAbsent(groupKey, k -> new ArrayList<>()).add(districtKey);
                } else if (scoreStr.equalsIgnoreCase("NQC") || scoreStr.equals("-") || scoreStr.equalsIgnoreCase("N/A") || scoreStr.isBlank()) {
                    districtMap.put(districtKey, null);
                } else {
                    try {
                        // Clean any spacing inside decimals e.g. "2. 3517"
                        String cleanedNum = scoreStr.replaceAll("\\s+", "");
                        double score = Double.parseDouble(cleanedNum);
                        if (score >= 0.0 && score <= 3.0) {
                            districtMap.put(districtKey, score);
                        } else {
                            log.warn("Cutoff score out of valid range [0.0000 - 3.0000]: {} for {} in {}", score, groupKey, districtKey);
                            districtMap.put(districtKey, null);
                        }
                    } catch (NumberFormatException e) {
                        districtMap.put(districtKey, null);
                    }
                }
            }
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : courseGroups.entrySet()) {
            String[] parts = entry.getKey().split("\\|\\|\\|");
            String course = parts[0];
            String uni = parts.length > 1 ? parts[1] : "";
            Map<String, Object> scores = entry.getValue();

            Map<String, Object> item = new HashMap<>();
            item.put("courseName", course);
            item.put("universityName", uni);

            // Attempt to look up uniCode from repository
            String uniCode = findUniCode(course, uni);
            item.put("uniCode", uniCode != null ? uniCode : "");

            // Populate all 25 districts
            for (String key : DISTRICT_KEYS) {
                item.put(key, scores.get(key));
            }

            List<String> nvqs = nvqGroups.get(entry.getKey());
            if (nvqs != null && !nvqs.isEmpty()) {
                item.put("nvqDistricts", nvqs);
            }

            item.put("validationNotes", validateCutoffDistricts(item));
            results.add(item);
        }

        return results;
    }

    // ─── UGC HANDBOOK TARGETED TABLE EXTRACTION ──────────────────────────────────

    /**
     * Executes single-pass Vision extraction for all UGC Handbook domain tables
     * using the 8 canonical UGC Markdown table specifications.
     */
    private ExtractionResult extractHandbookPageTableVision(String base64Image, int pageNumber) {
        String prompt = """
            You are an expert OCR table extractor specialized in UGC Sri Lanka University Admission Handbooks.
            Carefully inspect this page image and extract ANY structured table present into clean Markdown format.

            UGC TABLE SPECIFICATIONS:
            1. PLACES AVAILABLE FOR ADMISSION (Annex A - Total Proposed Intake per Course):
               `| Course Code | Course of Study | Proposed Intake |`
            2. DISTRIBUTION OF PLACES PROPOSED FOR ADMISSION (Annex B - University-Wise Intake):
               `| University | Course of Study | Proposed Intake |`
               CRITICAL UNPIVOTING RULE FOR ANNEX B:
               - When this page contains side-by-side University boxes (e.g. 'University of Colombo', 'University of Peradeniya', etc.), unpivot every box into standard rows:
                 | University | Course of Study | Proposed Intake |
                 | University of Colombo | Medicine | 224 |
                 | University of Colombo | Biological Science | 155 |
               - Do NOT make university names separate column headers. Always standardize to: `University | Course of Study | Proposed Intake`.
            3. UNI-CODES ASSIGNED FOR EACH COURSE OF STUDY:
               `| Course of Study | University | Uni - Code |`
            4. MEDIUM OF INSTRUCTION:
               `| No | University | Medium of Instruction |`
            5. SPECIAL ADMISSION / DIFFERENTLY ABLED CATEGORIES (UGC Section 6.1):
               `| University | Course of Study | Uni-Codes | Differently Abled | Blind (Braille) |`
            6. G.C.E. (O/L) EXAMINATION REQUIREMENTS:
               `| Uni-Codes | Course of Study | Sin. Lang. | Eng. | Mat. | Sci. | Tam. Lang. |`
            7. REQUIREMENT TO PASS THE PRACTICAL/ APTITUDE TEST:
               `| Course of Study | University / Campus / Institute | Uni-Code |`
            8. DISTRICT CUTOFF MARKS TABLE (if present on this page):
               - Unpivot each course & university column into standard 4-column rows:
                 `| District | Course of Study | University | Minimum Z-Score / Cutoff |`
            9. ARTS SUBJECT BASKETS & GUIDANCE (UGC Section 2.2.1 Arts Stream):
               When the page contains '2.2.1 ARTS STREAM' or 'Basket' with 'Guidance for selection of subjects from basket', extract the baskets into standard rows:
               `| Basket Number | Basket Name | Subject | Guidance / Selection Rule |`
               Rules:
               - 'Basket Number': integer (e.g., 1, 2, 3, 4).
               - 'Basket Name': name of the basket (e.g., 'Social Sciences', 'Humanities', 'Aesthetic Studies', 'Languages').
               - 'Subject': individual subject belonging to this basket (e.g., 'Economics', 'History', 'Geography', 'Sinhala', 'Tamil').
               - 'Guidance / Selection Rule': the guidance rule for selecting subjects from this basket (e.g., 'Candidates can select a maximum of two subjects from Basket 1').
            10. SECTION 2: STREAM DETAILS, AVAILABLE COURSES & OFFERING UNIVERSITIES:
               (Essential information for preparation for admission to first degree programmes / Courses of study under each stream / Courses for which students from different subject streams are eligible / Sections starting with 2.2.X.Y)
               `| Stream | Section | Course Code | Course of Study | Proposed Intake | Minimum Eligibility Requirements | Degree Programme | Available University | Duration |`
               CRITICAL RULES FOR SECTION 2:
               - Identify the Stream name for the courses (e.g., 'Arts', 'Commerce', 'Biological Science', 'Physical Science', 'Engineering Technology', 'Biosystems Technology', 'Indigenous Medicine', or 'Other Streams (Different Subject Streams)').
               - If the section heading mentions 'COURSES OF STUDY FOR WHICH STUDENTS FROM DIFFERENT SUBJECT STREAMS ARE ELIGIBLE', set Stream to 'Other Streams (Different Subject Streams)'.
               - Section: the section number if present (e.g., '2.2.4.3', '2.2.1.1').
               - Course Code: 3-digit code (e.g., '010', '001', '016').
               - Course of Study: full course name (e.g., 'Engineering (TM) - Textile & Apparel Engineering', 'Medicine').
               - Proposed Intake: integer number of places (e.g., 98, 200).
               - Minimum Eligibility Requirements: full admission eligibility criteria text.
               - Degree Programme: full degree title awarded (e.g., 'Bachelor of the Science of Engineering Honours in Textile & Apparel Engineering [BScEngHons (Textile & Apparel Engineering)]').
               - Available University: university or universities offering the course (e.g., 'University of Moratuwa'). If multiple universities offer the course, output a separate row for EACH University with the same Course Code and Course of Study.
               - Duration: duration of study (e.g., '04 years', '03 years', '05 years').

            RULES:
            - If this page contains a table, output ONLY the clean Markdown table starting with `|`.
            - Do NOT include markdown code fences (no ```).
            - Do NOT add conversational introductory or concluding text.
            """;

        String markdown = callGeminiVisionWithRetry(base64Image, pageNumber, prompt);
        String cleaned = cleanMarkdownFences(markdown);
        String tableType = identifyTableType(cleaned);

        ExtractionResult result = new ExtractionResult();
        result.confidence = 0.95;

        switch (tableType) {
            case "3. UNI-CODES ASSIGNED FOR EACH COURSE OF STUDY" -> {
                result.pageType = "UNIVERSITY_COURSE";
                result.items = parseMarkdownUniCodes(cleaned);
            }
            case "6. G.C.E. (O/L) EXAMINATION REQUIREMENTS" -> {
                result.pageType = "OL_REQUIREMENT";
                result.items = parseMarkdownOlRequirements(cleaned);
            }
            case "5. SPECIAL ADMISSION / DIFFERENTLY ABLED CATEGORIES" -> {
                result.pageType = "SPECIAL_PROVISION";
                result.items = parseMarkdownSpecialProvisions(cleaned);
            }
            case "7. REQUIREMENT TO PASS THE PRACTICAL/ APTITUDE TEST" -> {
                result.pageType = "APTITUDE";
                result.items = parseMarkdownAptitude(cleaned);
            }
            case "8. DISTRICT CUTOFF MARKS TABLE" -> {
                result.pageType = "CUTOFF";
                result.items = parseMarkdownToCutoffRecords(cleaned);
            }
            case "1. PLACES AVAILABLE FOR ADMISSION (PROPOSED INTAKE / ANNEX A)",
                 "2. DISTRIBUTION OF PLACES (ANNEX B / UNIVERSITY-WISE INTAKE)" -> {
                result.pageType = "COURSE";
                result.items = parseMarkdownCourses(cleaned);
            }
            case "9. ARTS SUBJECT BASKETS" -> {
                result.pageType = "ARTS_BASKET";
                result.items = parseMarkdownArtsBaskets(cleaned);
            }
            case "10. SECTION 2: STREAM COURSES AND UNIVERSITIES" -> {
                result.pageType = "COURSE";
                result.items = parseMarkdownStreamCoursesAndUniversities(cleaned);
            }
            default -> {
                if (cleaned.lines().anyMatch(l -> l.trim().startsWith("|"))) {
                    // Generic table fallback inspection
                    result.pageType = "COURSE";
                    result.items = parseMarkdownCourses(cleaned);
                } else {
                    result.pageType = "GENERAL";
                    result.items = Collections.emptyList();
                    result.confidence = 0.80;
                }
            }
        }

        try {
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("pageType", result.pageType);
            wrapper.put("confidence", result.confidence);
            wrapper.put("items", result.items);
            result.rawJson = objectMapper.writeValueAsString(wrapper);
        } catch (Exception e) {
            result.rawJson = "{}";
        }

        return result;
    }

    // ─── MARKDOWN TO SCHEMA JSON PARSERS ─────────────────────────────────────────

    private List<Map<String, Object>> parseMarkdownUniCodes(String markdown) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("course of study |")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 4) {
                String courseName = cells[1].trim().replaceAll("^[ï‚µ•*\\s]+", "").trim();
                String uniName = cells[2].trim().replaceAll("^[ï‚µ•*\\s]+", "").trim();
                String code = cells[3].trim().toUpperCase().replaceAll("[^A-Z0-9/]", "").trim();

                // Check if columns were inadvertently swapped (e.g. university in col 1, course in col 2)
                if (looksLikeUniversity(courseName) && !looksLikeUniversity(uniName) && !uniName.isBlank()) {
                    String temp = courseName;
                    courseName = uniName;
                    uniName = temp;
                }

                // Check if courseName inadvertently absorbed universityName
                if (uniName.isBlank() || looksLikeUniversity(courseName)) {
                    for (String ku : KNOWN_UNIVERSITIES) {
                        int idx = courseName.toUpperCase().lastIndexOf(ku);
                        if (idx != -1 && idx > 0) {
                            uniName = courseName.substring(idx).trim();
                            courseName = courseName.substring(0, idx).trim();
                            break;
                        }
                    }
                }

                courseName = courseName.replaceAll("[,\\-–—]+$", "").trim();

                if (!code.isBlank() && (!courseName.isBlank() || !uniName.isBlank())) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("code", code);
                    item.put("courseName", courseName);
                    item.put("universityName", uniName);
                    list.add(item);
                }
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseMarkdownOlRequirements(String markdown) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("course of study |") || trimmed.toLowerCase().contains("sin. lang")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 8) {
                String uniCodes = cells[1].trim();
                String course = cells[2].trim();
                String sin = cleanGrade(cells[3]);
                String eng = cleanGrade(cells[4]);
                String mat = cleanGrade(cells[5]);
                String sci = cleanGrade(cells[6]);
                String tam = cleanGrade(cells[7]);
                String notes = cells.length >= 9 ? cells[8].trim() : "";

                if (!uniCodes.isBlank() || !course.isBlank()) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("uniCodes", uniCodes);
                    item.put("courseOfStudy", course);
                    item.put("sinhalaLanguage", sin);
                    item.put("english", eng);
                    item.put("mathematics", mat);
                    item.put("science", sci);
                    item.put("tamilLanguage", tam);
                    item.put("notes", notes);
                    list.add(item);
                }
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseMarkdownSpecialProvisions(String markdown) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("differently abled")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 6) {
                String uni = cells[1].trim();
                String course = cells[2].trim();
                String uniCode = cells[3].trim().toUpperCase();
                int differentlyAbled = parseSeatCount(cells[4]);
                int blindBraille = parseSeatCount(cells[5]);

                if (!uniCode.isBlank() || !course.isBlank() || !uni.isBlank()) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("universityName", uni);
                    item.put("courseOfStudy", course);
                    item.put("uniCode", uniCode);
                    item.put("differentlyAbled", differentlyAbled);
                    item.put("blindBraille", blindBraille);
                    list.add(item);
                }
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseMarkdownAptitude(String markdown) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("course of study |") || trimmed.toLowerCase().contains("aptitude")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 4) {
                String course = cells[1].trim();
                String uni = cells[2].trim();
                String uniCode = cells[3].trim().toUpperCase();

                if (!course.isBlank() || !uniCode.isBlank()) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("courseOfStudy", course);
                    item.put("universityName", uni);
                    item.put("uniCode", uniCode);
                    list.add(item);
                }
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseMarkdownCourses(String markdown) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("course of study |") || trimmed.toLowerCase().contains("proposed intake")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 4) {
                String col1 = cells[1].trim();
                String col2 = cells[2].trim();
                String col3 = cells[3].trim();

                int intake = parseSeatCount(col3);
                Map<String, Object> item = new HashMap<>();
                if (col1.matches("^\\d{3}[A-Z]?$")) {
                    item.put("code", col1);
                    item.put("name", col2);
                } else {
                    item.put("code", UUID.randomUUID().toString().substring(0, 4).toUpperCase());
                    item.put("name", col2);
                    item.put("universityName", col1);
                }
                item.put("totalIntake", intake);
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseMarkdownStreamCoursesAndUniversities(String markdown) {
        List<Map<String, Object>> list = new ArrayList<>();
        Set<String> seenCourses = new HashSet<>();
        Set<String> seenUniCodes = new HashSet<>();
        String currentStream = "Other Streams (Different Subject Streams)";

        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("course of study |")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 4) {
                String streamCol = "";
                String sectionCol = "";
                String codeCol = "";
                String courseCol = "";
                String intakeCol = "0";
                String eligCol = "";
                String degreeCol = "";
                String uniCol = "";
                String durationCol = "";

                if (cells.length >= 9) {
                    // 9-column format: | Stream | Section | Course Code | Course of Study | Proposed Intake | Minimum Eligibility Requirements | Degree Programme | Available University | Duration |
                    streamCol = cells[1].trim();
                    sectionCol = cells[2].trim();
                    codeCol = cells[3].trim().replaceAll("[^0-9A-Za-z]", "").toUpperCase();
                    courseCol = cleanFieldText(cells[4]);
                    intakeCol = cells[5].trim();
                    eligCol = cleanFieldText(cells[6]);
                    degreeCol = cleanFieldText(cells[7]);
                    uniCol = cleanFieldText(cells[8]);
                    durationCol = cells.length >= 10 ? cleanFieldText(cells[9]) : "";
                } else {
                    // Legacy 4/5-column format: | Stream | Course of Study | Offering University | Minimum Eligibility / Requirements |
                    streamCol = cells[1].trim();
                    courseCol = cleanFieldText(cells[2]);
                    uniCol = cleanFieldText(cells[3]);
                    eligCol = cells.length >= 5 ? cleanFieldText(cells[4]) : "";
                }

                if (!streamCol.isBlank() && !streamCol.equalsIgnoreCase("Stream")) {
                    currentStream = normalizeStreamName(streamCol);
                } else if (!sectionCol.isBlank()) {
                    if (sectionCol.startsWith("2.2.1")) currentStream = "Arts";
                    else if (sectionCol.startsWith("2.2.2")) currentStream = "Commerce";
                    else if (sectionCol.startsWith("2.2.3")) currentStream = "Biological Science";
                    else if (sectionCol.startsWith("2.2.4")) {
                        if (courseCol.toLowerCase().contains("engineering") || courseCol.toLowerCase().contains("technology") || courseCol.toLowerCase().contains("textile")) {
                            currentStream = "Engineering Technology";
                        } else {
                            currentStream = "Physical Science";
                        }
                    } else if (sectionCol.startsWith("2.2.5")) currentStream = "Engineering Technology";
                    else if (sectionCol.startsWith("2.2.6")) currentStream = "Biosystems Technology";
                    else if (sectionCol.startsWith("2.2.7")) currentStream = "Indigenous Medicine";
                }

                if (courseCol.isBlank()) continue;

                if (codeCol.isBlank()) {
                    Matcher cm = Pattern.compile("(?i)(?:course\\s*code\\s*[-:]\\s*)([0-9]{3}[A-Z]?)").matcher(courseCol);
                    if (cm.find()) {
                        codeCol = cm.group(1).trim().toUpperCase();
                        courseCol = courseCol.replaceAll("(?i)\\(?\\s*course\\s*code\\s*[-:]\\s*[0-9]{3}[A-Z]?\\s*\\)?", "").trim();
                    } else {
                        codeCol = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
                    }
                }

                int intake = parseSeatCount(intakeCol);
                boolean aptitudeTest = line.toLowerCase().contains("aptitude") || eligCol.toLowerCase().contains("aptitude");

                // 1. Course record for Course Table
                String cKey = codeCol.toUpperCase() + "|||" + courseCol.toUpperCase();
                if (!seenCourses.contains(cKey)) {
                    seenCourses.add(cKey);
                    Map<String, Object> courseItem = new LinkedHashMap<>();
                    courseItem.put("moduleType", "COURSE");
                    courseItem.put("code", codeCol);
                    courseItem.put("name", courseCol);
                    courseItem.put("streamName", currentStream);
                    courseItem.put("totalIntake", intake);
                    if (!eligCol.isBlank()) {
                        courseItem.put("minimumEligibility", eligCol);
                    }
                    if (!degreeCol.isBlank()) {
                        courseItem.put("degreeTitle", degreeCol);
                    }
                    list.add(courseItem);
                }

                // 2. University Course record for Uni-Codes Table
                if (!uniCol.isBlank()) {
                    String[] unis = uniCol.split("[,;/]+");
                    for (String u : unis) {
                        String uName = cleanFieldText(u);
                        if (uName.isBlank()) continue;

                        String offeringKey = codeCol.toUpperCase() + "|||" + uName.toUpperCase();
                        if (!seenUniCodes.contains(offeringKey)) {
                            seenUniCodes.add(offeringKey);
                            Map<String, Object> uniItem = new LinkedHashMap<>();
                            uniItem.put("moduleType", "UNI_CODE");
                            uniItem.put("courseName", courseCol);
                            uniItem.put("universityName", uName);
                            uniItem.put("streamName", currentStream);
                            uniItem.put("intake", intake);
                            if (!degreeCol.isBlank()) {
                                uniItem.put("degreeProgram", degreeCol);
                            }
                            if (!durationCol.isBlank()) {
                                uniItem.put("duration", durationCol);
                            } else {
                                uniItem.put("duration", "04 years");
                            }
                            uniItem.put("aptitudeTest", aptitudeTest);

                            String uCode = findUniCode(courseCol, uName);
                            if (uCode == null || uCode.isBlank()) {
                                uCode = deriveUniCode(codeCol, uName);
                            }
                            uniItem.put("code", uCode);
                            list.add(uniItem);
                        }
                    }
                }
            }
        }
        return list;
    }

    private List<Map<String, Object>> parseMarkdownArtsBaskets(String markdown) {
        Map<Integer, Map<String, Object>> basketGroups = new LinkedHashMap<>();

        for (String line : markdown.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.startsWith("|") || trimmed.contains("---") || trimmed.toLowerCase().contains("basket number |") || trimmed.toLowerCase().contains("guidance / selection")) {
                continue;
            }
            String[] cells = trimmed.split("\\|");
            if (cells.length >= 4) {
                String basketNumStr = cells[1].trim().replaceAll("[^0-9]", "");
                int basketNumber = 1;
                try {
                    if (!basketNumStr.isBlank()) {
                        basketNumber = Integer.parseInt(basketNumStr);
                    }
                } catch (NumberFormatException ignored) {}

                String basketName = cells[2].trim();
                String subjectName = cells[3].trim().replaceAll("^[ï‚µ•*\\s]+", "").trim();
                String guidance = cells.length >= 5 ? cells[4].trim() : "";

                if (basketName.isBlank() && basketNumber > 0) {
                    basketName = "Basket " + basketNumber;
                }

                int finalBasketNumber = basketNumber;
                String finalBasketName = basketName;
                Map<String, Object> group = basketGroups.computeIfAbsent(basketNumber, k -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("moduleType", "ARTS_BASKET");
                    map.put("basketNumber", finalBasketNumber);
                    map.put("basketName", finalBasketName);
                    map.put("minSubjectsRequired", 1);
                    map.put("maxSubjectsAllowed", 3);
                    map.put("rulesDescription", "");
                    map.put("subjects", new ArrayList<String>());
                    return map;
                });

                if (!guidance.isBlank()) {
                    String existingRules = (String) group.get("rulesDescription");
                    if (existingRules == null || existingRules.isBlank()) {
                        group.put("rulesDescription", guidance);
                    } else if (!existingRules.contains(guidance)) {
                        group.put("rulesDescription", existingRules + "; " + guidance);
                    }
                }

                @SuppressWarnings("unchecked")
                List<String> subjects = (List<String>) group.get("subjects");
                if (!subjectName.isBlank() && !subjects.contains(subjectName)) {
                    subjects.add(subjectName);
                }
            }
        }

        return new ArrayList<>(basketGroups.values());
    }

    public static String normalizeStreamName(String raw) {
        if (raw == null || raw.isBlank()) return "Other Streams (Different Subject Streams)";
        String lower = raw.trim().toLowerCase();
        if (lower.contains("bio") && lower.contains("tech")) return "Biosystems Technology";
        if (lower.contains("eng") && lower.contains("tech")) return "Engineering Technology";
        if (lower.contains("bio")) return "Biological Science";
        if (lower.contains("phys") || lower.contains("math")) return "Physical Science";
        if (lower.contains("comm") || lower.contains("manage")) return "Commerce";
        if (lower.contains("arts") || lower.contains("humanities")) return "Arts";
        if (lower.contains("indigenous") || lower.contains("ayurved") || lower.contains("siddha") || lower.contains("unani")) return "Indigenous Medicine";
        if (lower.contains("different") || lower.contains("other") || lower.contains("eligible")) {
            return "Other Streams (Different Subject Streams)";
        }
        return raw.trim();
    }

    // ─── GEMINI VISION API CALLER WITH RETRY & EXPONENTIAL BACKOFF ───────────────

    private String callGeminiVisionWithRetry(String base64Image, int pageNumber, String prompt) {
        int maxRetries = 3;
        long backoffMs = 1500;

        for (int i = 0; i < maxRetries; i++) {
            try {
                return executeGeminiVisionRequest(base64Image, prompt);
            } catch (IllegalStateException e) {
                if (e.getMessage() != null && e.getMessage().contains("429")) {
                    log.warn("Gemini Vision 429 rate limit on page {}. Backing off for {} ms (attempt {}/{})...",
                            pageNumber, backoffMs, i + 1, maxRetries);
                    try {
                        Thread.sleep(backoffMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during rate limit backoff", ie);
                    }
                    backoffMs *= 2;
                } else {
                    throw e;
                }
            } catch (Exception ex) {
                if (i == maxRetries - 1) {
                    throw new RuntimeException(ex);
                }
                try {
                    Thread.sleep(backoffMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted during backoff", ie);
                }
                backoffMs *= 2;
            }
        }
        throw new RuntimeException("Max retries exceeded for page " + pageNumber);
    }

    private String executeGeminiVisionRequest(String base64Image, String prompt) throws Exception {
        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("text", prompt),
                                Map.of("inlineData", Map.of(
                                        "mimeType", "image/png",
                                        "data", base64Image
                                ))
                        ))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.0,
                        "maxOutputTokens", 8192
                )
        );

        String requestJson = objectMapper.writeValueAsString(requestBody);
        String cleanKey = geminiApiKey != null ? geminiApiKey.trim() : "";

        List<String> modelsToTry = new ArrayList<>();
        if (geminiModel != null && !geminiModel.isBlank()) {
            modelsToTry.add(geminiModel.trim());
        }
        for (String model : APPROVED_MODELS) {
            if (!modelsToTry.contains(model)) {
                modelsToTry.add(model);
            }
        }

        String lastError = "";
        for (String modelName : modelsToTry) {
            String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                    modelName, cleanKey);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", cleanKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .timeout(Duration.ofSeconds(45))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int statusCode = response.statusCode();

            if (statusCode >= 200 && statusCode < 300) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
                if (!textNode.isMissingNode()) {
                    return textNode.asText().trim();
                }
            }

            if (statusCode == 429) {
                throw new IllegalStateException("Gemini Rate Limit Exceeded (Status 429)");
            }

            lastError = String.format("Status %d for '%s': %s", statusCode, modelName, response.body());
            log.info("Gemini model '{}' returned status {}. Trying fallback model...", modelName, statusCode);
        }

        throw new RuntimeException("All Gemini models failed: " + lastError);
    }

    // ─── CLASSIFICATION & NORMALIZATION HELPERS ──────────────────────────────────

    public boolean isHandbookTableContent(String text) {
        if (text == null || text.isBlank()) return false;
        String lower = text.toLowerCase();

        boolean hasTableKeywords = lower.contains("uni - code") || lower.contains("uni-code") || lower.contains("uni-codes assigned")
                || lower.contains("places available for admission") || lower.contains("proposed intake")
                || lower.contains("distribution of places") || lower.contains("annex a") || lower.contains("annex b")
                || lower.contains("ordinary level") || lower.contains("sin. lang.") || lower.contains("tam. lang.")
                || lower.contains("differently abled") || lower.contains("blind (braille)") || lower.contains("special provision")
                || lower.contains("aptitude test") || lower.contains("practical test") || lower.contains("practical/ aptitude")
                || lower.contains("arts basket") || lower.contains("subject basket") || lower.contains("basket 1")
                || lower.contains("guidance for selection of subjects")
                || lower.contains("guidance for selection of subjects from basket")
                || lower.contains("selection of subjects from basket")
                || (lower.contains("2.2.1") && lower.contains("arts"))
                || lower.contains("medium of instruction")
                || lower.contains("essential information for preparation for admission")
                || lower.contains("different subject streams are eligible")
                || lower.contains("different subject streams")
                || (lower.contains("section 2") && (lower.contains("stream") || lower.contains("first degree programmes")))
                || isSection2Content(text);

        if (hasTableKeywords) return true;

        long linesWithColumns = text.lines()
                .filter(l -> l.contains("\t") || l.split("\\s{3,}").length >= 3)
                .count();

        return linesWithColumns >= 5;
    }

    public boolean isCutoffMarksPage(String text, int pageNumber) {
        if (text == null || text.isBlank()) return false;
        String lower = text.toLowerCase();

        boolean hasCutoffHeading = lower.contains("minimum \"z\" score") || lower.contains("minimum \"z\" scores")
                || lower.contains("minimum 'z' - score") || lower.contains("minimum 'z' score")
                || lower.contains("minimum 'z' scores") || lower.contains("minimum z-score")
                || lower.contains("minimum z score") || lower.contains("minimum z-scores")
                || lower.contains("cutoff") || lower.contains("cut-off")
                || lower.contains("minimum marks for university admission")
                || lower.contains("courses of study of universities, in respect of each district")
                || (lower.contains("academic year") && (lower.contains("after re- scrutiny") || lower.contains("after re-scrutiny") || lower.contains("after rescrutiny")));

        // Handbook table exclusions (only apply if page does NOT have an explicit cutoff heading)
        if (!hasCutoffHeading) {
            if (lower.contains("uni - code") || lower.contains("uni-code") || lower.contains("uni-codes assigned")
                    || lower.contains("places available for admission") || lower.contains("proposed intake")
                    || lower.contains("ordinary level") || lower.contains("sin. lang.") || lower.contains("tam. lang.")
                    || lower.contains("differently abled") || lower.contains("blind (braille)")) {
                return false;
            }
        }

        long uniqueDistrictCount = NON_UNIVERSITY_DISTRICT_NAMES.stream()
                .filter(d -> lower.contains(d.toLowerCase()))
                .count();

        long zScoreDecimalCount = Pattern.compile("[-+]?[0-3]\\s*\\.\\s*\\d{2,4}\\b").matcher(text).results().count();
        long nqcCount = Pattern.compile("(?i)\\b(NQC|N/A|NVQ)\\b").matcher(text).results().count();

        if (hasCutoffHeading) return true;
        if (uniqueDistrictCount >= 2) return true;
        if (zScoreDecimalCount >= 6) return true;
        return (zScoreDecimalCount >= 2 || nqcCount >= 2) && uniqueDistrictCount >= 1;
    }

    public static String identifyTableType(String content) {
        if (content == null || content.isBlank()) return "GENERAL";
        String lower = content.toLowerCase();

        String headerLine = content.lines()
                .filter(l -> l.trim().startsWith("|") && !l.contains("---"))
                .findFirst()
                .orElse("")
                .toLowerCase();

        long decimalZScoreCount = Pattern.compile("[-+]?[0-3]\\.\\d{3,4}\\b").matcher(content).results().count();
        long nqcCount = Pattern.compile("(?i)\\b(NQC|N/A|NVQ)\\b").matcher(content).results().count();
        boolean hasCutoffKeyword = lower.contains("minimum z-score") || lower.contains("minimum \"z\"")
                || lower.contains("minimum 'z'") || lower.contains("cutoff") || lower.contains("cut-off")
                || lower.contains("courses of study of universities, in respect of each district");

        boolean hasDistrictHeaderOrRows = headerLine.contains("district")
                || (lower.contains("colombo") && lower.contains("gampaha") && lower.contains("kalutara") && (decimalZScoreCount >= 2 || nqcCount >= 2));

        if (hasDistrictHeaderOrRows || hasCutoffKeyword || decimalZScoreCount >= 5) {
            return "8. DISTRICT CUTOFF MARKS TABLE";
        }
        if (lower.contains("ordinary level") || lower.contains("o/l requirement") || headerLine.contains("sin. lang") || headerLine.contains("tam. lang")) {
            return "6. G.C.E. (O/L) EXAMINATION REQUIREMENTS";
        }
        if (lower.contains("differently abled") || lower.contains("blind (braille)") || lower.contains("special provision")) {
            return "5. SPECIAL ADMISSION / DIFFERENTLY ABLED CATEGORIES";
        }
        if (headerLine.contains("uni - code") || headerLine.contains("uni-code") || lower.contains("uni-codes assigned")) {
            return "3. UNI-CODES ASSIGNED FOR EACH COURSE OF STUDY";
        }
        if (lower.contains("practical/ aptitude") || lower.contains("aptitude test") || headerLine.contains("aptitude")) {
            return "7. REQUIREMENT TO PASS THE PRACTICAL/ APTITUDE TEST";
        }
        if (lower.contains("places available for admission") || lower.contains("proposed intake") || headerLine.contains("intake")) {
            return "1. PLACES AVAILABLE FOR ADMISSION (PROPOSED INTAKE / ANNEX A)";
        }
        if (lower.contains("arts stream") && (lower.contains("basket") || lower.contains("guidance for selection") || lower.contains("selection of subjects"))
                || lower.contains("guidance for selection of subjects from basket")
                || lower.contains("selection of subjects from basket")
                || lower.contains("arts basket") || lower.contains("subject basket")
                || (headerLine.contains("basket") && headerLine.contains("subject"))
                || (headerLine.contains("basket number") && headerLine.contains("basket name"))) {
            return "9. ARTS SUBJECT BASKETS";
        }
        if (isSection2Content(content)
                || lower.contains("essential information for preparation for admission")
                || lower.contains("different subject streams are eligible")
                || lower.contains("different subject streams")
                || headerLine.contains("degree programme")
                || headerLine.contains("minimum eligibility")
                || headerLine.contains("offering university")
                || (headerLine.contains("stream") && headerLine.contains("course"))
                || (headerLine.contains("stream") && headerLine.contains("university"))
                || (headerLine.contains("section") && headerLine.contains("course code"))) {
            return "10. SECTION 2: STREAM COURSES AND UNIVERSITIES";
        }
        return "GENERAL";
    }

    public static String normalizeDistrictName(String raw) {
        if (raw == null || raw.isBlank()) return "";
        String d = raw.trim().toUpperCase().replaceAll("[^A-Z ]", "").trim();

        if (d.startsWith("KEGAL") || d.equals("KEGALLA") || d.equals("KEGALLE") || d.equals("KEG")) return "KEGALLE";
        if (d.startsWith("RATNA") || d.startsWith("RATHNA") || d.contains("NAPURA")) return "RATNAPURA";
        if (d.startsWith("KURUNE") || d.startsWith("KURU") || d.contains("NEGALA")) return "KURUNEGALA";
        if (d.startsWith("NUWARA") || d.contains("ELIYA") || d.equals("NELIYA")) return "NUWARA ELIYA";
        if (d.startsWith("KILINOCH") || d.startsWith("KILINO")) return "KILINOCHCHI";
        if (d.startsWith("MULLAI") || d.contains("TIVU")) return "MULLAITIVU";
        if (d.startsWith("MONARA") || d.contains("GALA")) return "MONARAGALA";
        if (d.startsWith("POLONNA") || d.contains("RUWA") || d.startsWith("POLON")) return "POLONNARUWA";
        if (d.startsWith("ANURADHA") || d.contains("PURA") || d.startsWith("ANURA")) return "ANURADHAPURA";
        if (d.startsWith("TRINCO") || d.contains("MALEE")) return "TRINCOMALEE";
        if (d.startsWith("BATTICA") || d.contains("LOA") || d.startsWith("BATTI")) return "BATTICALOA";
        if (d.startsWith("HAMBAN") || d.contains("TOTA") || d.startsWith("HAMBA")) return "HAMBANTOTA";

        for (String expected : ALL_EXPECTED_DISTRICTS) {
            if (d.equalsIgnoreCase(expected) || d.contains(expected) || expected.contains(d)) {
                return expected;
            }
        }
        return d;
    }

    private static String toDistrictCamelCase(String normDistrict) {
        if (normDistrict == null || normDistrict.isBlank()) return null;
        return switch (normDistrict.toUpperCase()) {
            case "COLOMBO" -> "colombo";
            case "GAMPAHA" -> "gampaha";
            case "KALUTARA" -> "kalutara";
            case "KANDY" -> "kandy";
            case "MATALE" -> "matale";
            case "NUWARA ELIYA" -> "nuwaraEliya";
            case "GALLE" -> "galle";
            case "MATARA" -> "matara";
            case "HAMBANTOTA" -> "hambantota";
            case "JAFFNA" -> "jaffna";
            case "KILINOCHCHI" -> "kilinochchi";
            case "MANNAR" -> "mannar";
            case "VAVUNIYA" -> "vavuniya";
            case "MULLAITIVU" -> "mullaitivu";
            case "BATTICALOA" -> "batticaloa";
            case "AMPARA" -> "ampara";
            case "TRINCOMALEE" -> "trincomalee";
            case "KURUNEGALA" -> "kurunegala";
            case "PUTTALAM" -> "puttalam";
            case "ANURADHAPURA" -> "anuradhapura";
            case "POLONNARUWA" -> "polonnaruwa";
            case "BADULLA" -> "badulla";
            case "MONARAGALA" -> "monaragala";
            case "RATNAPURA" -> "ratnapura";
            case "KEGALLE" -> "kegalle";
            default -> null;
        };
    }

    private Set<String> extractDistrictsFromMarkdown(String text) {
        Set<String> set = new HashSet<>();
        if (text == null) return set;
        for (String line : text.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("|") && !trimmed.toLowerCase().contains("district |") && !trimmed.contains("---")) {
                String[] cells = trimmed.split("\\|");
                if (cells.length >= 2) {
                    String norm = normalizeDistrictName(cells[1].trim());
                    if (ALL_EXPECTED_DISTRICTS.contains(norm)) {
                        set.add(norm);
                    }
                }
            }
        }
        return set;
    }

    private String cleanMarkdownFences(String text) {
        if (text == null) return "";
        String s = text.trim();
        if (s.startsWith("```markdown")) s = s.substring("```markdown".length());
        else if (s.startsWith("```")) s = s.substring(3);
        if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
        return s.trim();
    }

    private String cleanGrade(String g) {
        if (g == null) return "";
        String s = g.trim();
        if (s.equals("-") || s.equals("–") || s.equals("—")) return "";
        return s;
    }

    private int parseSeatCount(String s) {
        if (s == null) return 0;
        String cleaned = s.trim();
        if (cleaned.equals("-") || cleaned.equals("–") || cleaned.equals("—") || cleaned.equalsIgnoreCase("nil") || cleaned.equalsIgnoreCase("none")) {
            return 0;
        }
        try {
            return Integer.parseInt(cleaned);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String findUniCode(String courseName, String universityName) {
        if (uniCodeRepository == null) return null;
        try {
            List<UniCode> all = uniCodeRepository.findAll();
            for (UniCode u : all) {
                if (u.getCourseName() != null && u.getCourseName().equalsIgnoreCase(courseName)) {
                    if (universityName == null || universityName.isBlank() ||
                            (u.getUniversityName() != null && u.getUniversityName().equalsIgnoreCase(universityName))) {
                        return u.getCode();
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    public static String validateCutoffDistricts(Map<String, Object> cutoffItem) {
        if (cutoffItem == null) return "Empty record";
        int presentCount = 0;
        int nvqCount = 0;
        List<String> missing = new ArrayList<>();

        Set<String> nvqSet = new LinkedHashSet<>();
        Object nvqObj = cutoffItem.get("nvqDistricts");
        if (nvqObj instanceof List<?> list) {
            for (Object o : list) if (o != null) nvqSet.add(o.toString().toLowerCase().trim());
        } else if (nvqObj instanceof String str) {
            for (String s : str.split(",")) if (!s.isBlank()) nvqSet.add(s.toLowerCase().trim());
        }

        for (String district : DISTRICT_KEYS) {
            String snake = district.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
            boolean hasKey = cutoffItem.containsKey(district) || cutoffItem.containsKey(snake);
            Object val = cutoffItem.getOrDefault(district, cutoffItem.get(snake));

            boolean isNvq = nvqSet.contains(district.toLowerCase())
                    || (val != null && val.toString().toUpperCase().contains("NVQ"));

            if (isNvq) {
                nvqCount++;
                nvqSet.add(district.toLowerCase());
            } else if (hasKey && val != null && !val.toString().isBlank() && !val.toString().equalsIgnoreCase("null") && !val.toString().equals("-")) {
                presentCount++;
            } else if (!hasKey) {
                missing.add(district);
                cutoffItem.put(district, null);
            }
        }

        if (!nvqSet.isEmpty()) {
            cutoffItem.put("nvqDistricts", new ArrayList<>(nvqSet));
        }

        if (missing.isEmpty()) {
            if (nvqCount > 0) {
                return String.format("Verified: Complete 25-district data (%d active cutoffs, %d NVQ districts).", presentCount, nvqCount);
            }
            return String.format("Verified: Complete 25-district data (%d districts with active cutoffs).", presentCount);
        } else {
            return String.format("Validation Note: %d district keys were missing in extraction and auto-filled with null: [%s]. (%d cutoffs, %d NVQ)",
                    missing.size(), String.join(", ", missing), presentCount, nvqCount);
        }
    }

    private List<String> getDynamicUniversities() {
        if (universityRepository == null) return Collections.emptyList();
        try {
            return universityRepository.findAll().stream()
                    .map(University::getName)
                    .filter(name -> name != null && !name.isBlank())
                    .sorted((a, b) -> Integer.compare(b.length(), a.length()))
                    .toList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ─── UPGRADED RULE-BASED FALLBACK ───────────────────────────────────────────

    public ExtractionResult ruleBasedExtraction(String text, int pageNumber) {
        ExtractionResult result = new ExtractionResult();
        String lower = text.toLowerCase();

        if (isCutoffMarksPage(text, pageNumber) || lower.contains("minimum z-score") || lower.contains("minimum \"z\"") || lower.contains("minimum 'z'") || lower.contains("cutoff") || lower.contains("cut-off")
                || (lower.contains("colombo") && lower.contains("gampaha") && lower.contains("kalutara"))) {
            result.pageType = "CUTOFF";
            result.confidence = 0.90;
            result.items = extractCutoffRecords(text);
        } else if (lower.contains("ordinary level") || lower.contains("(o/l)") || lower.contains("o/l examination") || (lower.contains("sin. lang") && lower.contains("eng."))) {
            result.pageType = "OL_REQUIREMENT";
            result.confidence = 0.90;
            result.items = extractOlRequirementRecords(text);
        } else if (lower.contains("differently abled") || lower.contains("blind") || lower.contains("braille") || lower.contains("special provision")) {
            result.pageType = "SPECIAL_PROVISION";
            result.confidence = 0.90;
            result.items = extractSpecialProvisionRecords(text);
        } else if (lower.contains("uni-code") || lower.contains("unicode") || (lower.contains("university") && Pattern.compile("\\b0[0-9]{2}[A-Z]\\b").matcher(text).find())) {
            result.pageType = "UNIVERSITY_COURSE";
            result.confidence = 0.88;
            result.items = extractUniCodeRecords(text);
        } else if (lower.contains("aptitude test") || lower.contains("practical test")) {
            result.pageType = "APTITUDE";
            result.confidence = 0.88;
            result.items = extractAptitudeRecords(text);
        } else if (lower.contains("arts stream") && (lower.contains("basket") || lower.contains("guidance for selection") || lower.contains("selection of subjects"))
                || lower.contains("guidance for selection of subjects from basket")
                || lower.contains("arts basket") || lower.contains("subject basket")) {
            result.pageType = "ARTS_BASKET";
            result.confidence = 0.88;
            result.items = extractArtsBasketRecords(text);
        } else if (isSection2Content(text)) {
            result.pageType = "COURSE";
            result.confidence = 0.95;
            result.items = extractSection2CoursesAndUniCodes(text);
        } else if (lower.contains("course of study") || lower.contains("intake") || lower.contains("proposed intake")) {
            result.pageType = "COURSE";
            result.confidence = 0.85;
            result.items = extractCourseRecords(text);
        } else {
            result.pageType = "GENERAL";
            result.confidence = 0.70;
            result.items = Collections.emptyList();
        }

        try {
            Map<String, Object> wrapper = new HashMap<>();
            wrapper.put("pageType", result.pageType);
            wrapper.put("confidence", result.confidence);
            wrapper.put("items", result.items);
            result.rawJson = objectMapper.writeValueAsString(wrapper);
        } catch (Exception e) {
            result.rawJson = "{}";
        }

        return result;
    }

    private boolean looksLikeUniversity(String s) {
        if (s == null) return false;
        String upper = s.toUpperCase();
        return upper.contains("UNIVERSITY") || upper.contains("CAMPUS") || upper.contains("INSTITUTE")
                || upper.contains("COLLEGE") || upper.contains("UCSC") || upper.contains("UVPA");
    }

    private List<Map<String, Object>> extractUniCodeRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        // Preprocess: merge lines that wrapped across multiple lines in UGC Handbook
        List<String> mergedLines = new ArrayList<>();
        String[] rawLines = text.split("\\r?\\n");
        StringBuilder buffer = new StringBuilder();

        for (String raw : rawLines) {
            String line = raw.trim().replaceAll("^[ï‚µ•*\\s]+", "").trim();
            if (line.isBlank() || line.toLowerCase().contains("course of study") || line.contains("---")) {
                continue;
            }
            if (buffer.length() > 0) {
                buffer.append(" ").append(line);
            } else {
                buffer.append(line);
            }
            if (buffer.toString().matches(".*\\b\\d{3}[A-Z]?$")) {
                mergedLines.add(buffer.toString());
                buffer.setLength(0);
            }
        }
        if (buffer.length() > 0 && buffer.toString().matches(".*\\b\\d{3}[A-Z]?$")) {
            mergedLines.add(buffer.toString());
        }

        Pattern codeEndPattern = Pattern.compile("^(.*?)\\s+(\\d{3}[A-Z]?)$");
        List<String> allUnis = new ArrayList<>();
        allUnis.addAll(getDynamicUniversities());
        allUnis.addAll(KNOWN_UNIVERSITIES);
        allUnis = allUnis.stream()
                .filter(u -> u != null && !u.isBlank())
                .distinct()
                .sorted((a, b) -> Integer.compare(b.length(), a.length()))
                .toList();

        for (String line : mergedLines) {
            Matcher m = codeEndPattern.matcher(line.trim());
            if (m.find()) {
                String prefix = m.group(1).trim();
                String code = m.group(2).trim().toUpperCase();

                String matchedUni = "";
                String courseName = prefix;

                for (String uni : allUnis) {
                    int idx = prefix.toUpperCase().lastIndexOf(uni.toUpperCase());
                    if (idx != -1 && idx > 0) {
                        courseName = prefix.substring(0, idx).trim();
                        matchedUni = prefix.substring(idx).trim();
                        break;
                    }
                }

                if (matchedUni.isBlank()) {
                    String[] parts = prefix.split("\\s{2,}");
                    if (parts.length >= 2) {
                        courseName = parts[0].trim();
                        matchedUni = parts[1].trim();
                    } else {
                        int hIdx = prefix.lastIndexOf("-");
                        if (hIdx > 0) {
                            courseName = prefix.substring(0, hIdx).trim();
                            matchedUni = prefix.substring(hIdx + 1).trim();
                        }
                    }
                }

                if (looksLikeUniversity(courseName) && !looksLikeUniversity(matchedUni) && !matchedUni.isBlank()) {
                    String temp = courseName;
                    courseName = matchedUni;
                    matchedUni = temp;
                }

                courseName = courseName.replaceAll("[,\\-–—]+$", "").trim();

                if (!code.isBlank() && (!courseName.isBlank() || !matchedUni.isBlank())) {
                    Map<String, Object> item = new HashMap<>();
                    item.put("code", code);
                    item.put("courseName", courseName);
                    item.put("universityName", matchedUni);
                    list.add(item);
                }
            }
        }
        return list;
    }

    private List<Map<String, Object>> extractOlRequirementRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        String[] lines = text.split("\\r?\\n");
        Pattern uniCodeLead = Pattern.compile("^([0-9]{3}[A-Z]?(?:\\s*/\\s*[0-9]{3}[A-Z]?)*)\\b");

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isBlank()) continue;

            String lower = line.toLowerCase();
            if (lower.contains("course of study") || lower.contains("sin. lang") || lower.contains("examination requirements")) {
                continue;
            }

            Matcher m = uniCodeLead.matcher(line);
            if (m.find()) {
                String uniCodes = m.group(1).trim();
                String rest = line.substring(m.end()).trim();

                // Extract single-character grade tokens (A, B, C, S with optional asterisks) from the end of the line
                Pattern gradesPattern = Pattern.compile("(\\b[ABCS]\\*?\\b(?:\\s+[ABCS]\\*?)*)$");
                Matcher gm = gradesPattern.matcher(rest);

                String course = rest;
                String[] grades = new String[0];
                if (gm.find()) {
                    course = rest.substring(0, gm.start()).trim();
                    grades = gm.group(1).trim().split("\\s+");
                }

                String sin = "";
                String eng = "";
                String mat = "";
                String sci = "";
                String tam = "";

                if (grades.length >= 5) {
                    sin = cleanGrade(grades[0]);
                    eng = cleanGrade(grades[1]);
                    mat = cleanGrade(grades[2]);
                    sci = cleanGrade(grades[3]);
                    tam = cleanGrade(grades[4]);
                } else {
                    for (String g : grades) {
                        String clean = cleanGrade(g);
                        if (eng.isEmpty()) eng = clean;
                        else if (mat.isEmpty()) mat = clean;
                        else if (sci.isEmpty()) sci = clean;
                    }
                }

                Map<String, Object> item = new HashMap<>();
                item.put("uniCodes", uniCodes);
                item.put("courseOfStudy", course);
                item.put("sinhalaLanguage", sin);
                item.put("english", eng);
                item.put("mathematics", mat);
                item.put("science", sci);
                item.put("tamilLanguage", tam);
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> extractSpecialProvisionRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        String[] lines = text.split("\\r?\\n");
        String currentUniversity = "";
        List<String> dbUnis = getDynamicUniversities();

        Pattern rowPattern = Pattern.compile("^(.*?)\\b(\\d{3}[A-Z]?)\\s+([0-9]+|[-–—]+)\\s+([0-9]+|[-–—]+)\\s*$");

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) continue;

            String lower = trimmed.toLowerCase();
            if (lower.contains("differently abled") || lower.contains("blind (braille)") || lower.contains("course of study")) {
                continue;
            }

            Matcher m = rowPattern.matcher(trimmed);
            if (m.find()) {
                String prefix = m.group(1).trim();
                String uniCode = m.group(2).trim().toUpperCase();
                int differentlyAbled = parseSeatCount(m.group(3));
                int blindBraille = parseSeatCount(m.group(4));

                String uni = "";
                String course = prefix;

                for (String dbUni : dbUnis) {
                    if (prefix.toLowerCase().startsWith(dbUni.toLowerCase())) {
                        uni = dbUni;
                        course = prefix.substring(dbUni.length()).trim();
                        currentUniversity = uni;
                        break;
                    }
                }
                if (uni.isBlank() && !currentUniversity.isBlank()) {
                    uni = currentUniversity;
                }

                Map<String, Object> item = new HashMap<>();
                item.put("universityName", uni);
                item.put("courseOfStudy", course);
                item.put("uniCode", uniCode);
                item.put("differentlyAbled", differentlyAbled);
                item.put("blindBraille", blindBraille);
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> extractAptitudeRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("(?m)^\\s*([A-Za-z &\\-/()]+?)\\s{2,}([A-Za-z0-9 ,&\\-/()]+?)\\s{2,}(\\d{3}[A-Z]?)\\s*$");
        Matcher m = p.matcher(text);
        while (m.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("courseOfStudy", m.group(1).trim().toUpperCase());
            item.put("universityName", m.group(2).trim().toUpperCase());
            item.put("uniCode", m.group(3).trim().toUpperCase());
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> extractCutoffRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("(?m)^\\s*(\\d{3}[A-Z]?)\\s+([A-Za-z &\\(\\)/\\-,]+?)\\s+([A-Za-z &\\(\\)/\\-,]+?)\\s+([0-9.\\-A-Za-z/]+.*)$");
        Matcher m = p.matcher(text);
        while (m.find()) {
            String uniCode = m.group(1).trim();
            String courseName = m.group(2).trim();
            String uniName = m.group(3).trim();
            String scoresPart = m.group(4).trim();

            Map<String, Object> item = new HashMap<>();
            item.put("uniCode", uniCode);
            item.put("courseName", courseName);
            item.put("universityName", uniName);

            List<String> nvqDistricts = new ArrayList<>();
            String[] tokens = scoresPart.split("\\s+");
            int districtIdx = 0;
            for (String tok : tokens) {
                if (districtIdx >= DISTRICT_KEYS.size()) break;
                String dKey = DISTRICT_KEYS.get(districtIdx);
                String upper = tok.trim().toUpperCase();

                if (upper.contains("NVQ")) {
                    item.put(dKey, null);
                    nvqDistricts.add(dKey);
                    districtIdx++;
                } else if (upper.equals("-") || upper.equals("–") || upper.equals("—") || upper.equals("NQC") || upper.equals("N/A")) {
                    item.put(dKey, null);
                    districtIdx++;
                } else {
                    try {
                        double val = Double.parseDouble(tok);
                        if (val >= 0.0 && val <= 3.0) {
                            item.put(dKey, val);
                        } else {
                            item.put(dKey, null);
                        }
                        districtIdx++;
                    } catch (NumberFormatException ignored) {
                        // Skip non-score words if any
                    }
                }
            }
            for (int i = districtIdx; i < DISTRICT_KEYS.size(); i++) {
                item.put(DISTRICT_KEYS.get(i), null);
            }
            if (!nvqDistricts.isEmpty()) {
                item.put("nvqDistricts", nvqDistricts);
            }
            item.put("validationNotes", validateCutoffDistricts(item));
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> extractCourseRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        // 1. Matches UGC Handbook Annex A lines: "001 Medicine - 2095" or "002 Dental Surgery - 130"
        Pattern p1 = Pattern.compile("(?m)^\\s*(\\d{3})\\s+([A-Za-z &(),/\\-]+?)\\s*(?:[-–—:]\\s*|\\s{2,})(\\d{1,5})\\s*$");
        Matcher m1 = p1.matcher(text);
        while (m1.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("code", m1.group(1).trim());
            item.put("name", m1.group(2).trim());
            item.put("totalIntake", parseSeatCount(m1.group(3)));
            list.add(item);
        }

        // 2. Fallback: Matches "Course Code Course of Study" without explicit intake or with hyphen
        if (list.isEmpty()) {
            Pattern p2 = Pattern.compile("(?i)(?:course\\s*(?:code)?[:\\s]+)?(\\d{3})\\s*[-:]\\s*([A-Za-z &\\-/]+)");
            Matcher m2 = p2.matcher(text);
            while (m2.find()) {
                Map<String, Object> item = new HashMap<>();
                item.put("code", m2.group(1).trim());
                item.put("name", m2.group(2).trim());
                item.put("totalIntake", 100);
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> extractArtsBasketRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        Map<Integer, Map<String, Object>> basketGroups = new LinkedHashMap<>();
        int currentBasketNumber = 1;
        String currentBasketName = "Basket 1";

        Pattern basketHeader = Pattern.compile("(?i)(?:basket|group)\\s*([0-9]+)\\s*[:\\-–—]?\\s*([A-Za-z &\\-/]+)?");

        for (String rawLine : text.split("\\r?\\n")) {
            String line = rawLine.trim();
            if (line.isBlank()) continue;

            Matcher m = basketHeader.matcher(line);
            if (m.find()) {
                try {
                    currentBasketNumber = Integer.parseInt(m.group(1));
                } catch (NumberFormatException ignored) {}
                currentBasketName = m.group(2) != null && !m.group(2).isBlank()
                        ? m.group(2).trim()
                        : "Basket " + currentBasketNumber;
                continue;
            }

            int bNum = currentBasketNumber;
            String bName = currentBasketName;
            Map<String, Object> group = basketGroups.computeIfAbsent(bNum, k -> {
                Map<String, Object> map = new HashMap<>();
                map.put("moduleType", "ARTS_BASKET");
                map.put("basketNumber", bNum);
                map.put("basketName", bName);
                map.put("minSubjectsRequired", 1);
                map.put("maxSubjectsAllowed", 3);
                map.put("rulesDescription", "Guidance: Select subjects according to UGC Arts stream basket criteria");
                map.put("subjects", new ArrayList<String>());
                return map;
            });

            @SuppressWarnings("unchecked")
            List<String> subjects = (List<String>) group.get("subjects");
            String cleanedSub = line.replaceAll("^[•*ï‚µ\\-\\d.\\s]+", "").trim();
            if (!cleanedSub.isBlank() && cleanedSub.length() > 2 && !cleanedSub.toLowerCase().contains("guidance") && !cleanedSub.toLowerCase().contains("basket")) {
                if (!subjects.contains(cleanedSub)) {
                    subjects.add(cleanedSub);
                }
            }
        }
        return new ArrayList<>(basketGroups.values());
    }

    public static boolean isSection2Content(String text) {
        if (text == null || text.isBlank()) return false;
        String lower = text.toLowerCase();

        boolean hasSectionPattern = Pattern.compile("(?m)^\\s*2\\.\\d+(?:\\.\\d+)*\\s+").matcher(text).find();
        boolean hasCourseCode = Pattern.compile("(?i)(?:\\(?\\s*course\\s*code\\s*[-:]\\s*[0-9]{3}[A-Z]?\\s*\\)?)").matcher(text).find();
        boolean hasProposedIntake = Pattern.compile("(?i)(?:\\(?\\s*proposed\\s*intake\\s*[-:]\\s*[0-9]+\\s*\\)?)").matcher(text).find();
        boolean hasMinEligibility = lower.contains("minimum eligibility requirements");
        boolean hasDegreeProg = lower.contains("degree programme") || lower.contains("degree program");
        boolean hasAvailUni = lower.contains("available university") || lower.contains("available universities") || lower.contains("offering university");

        if (hasSectionPattern && (hasCourseCode || hasProposedIntake || hasMinEligibility || hasDegreeProg || hasAvailUni)) {
            return true;
        }
        if (hasCourseCode && (hasMinEligibility || hasDegreeProg || hasAvailUni || hasProposedIntake)) {
            return true;
        }
        return false;
    }

    public static String cleanFieldText(String s) {
        if (s == null) return "";
        return s.replaceAll("^[•*§\\-–—:\\s\t\uF0A7\u2022]+", "")
                .replaceAll("[\\t\\r\\n]+", " ")
                .replaceAll("\\s{2,}", " ")
                .trim();
    }

    public static String deriveUniCode(String courseCode, String uniName) {
        if (courseCode == null || courseCode.isBlank()) {
            courseCode = "000";
        }
        String cleanCode = courseCode.replaceAll("[^0-9A-Za-z]", "").toUpperCase();
        if (uniName == null || uniName.isBlank()) {
            return cleanCode;
        }
        String upperUni = uniName.toUpperCase();
        String suffix = "";
        if (upperUni.contains("MORATUWA")) suffix = "M";
        else if (upperUni.contains("COLOMBO") || upperUni.contains("UCSC")) suffix = "C";
        else if (upperUni.contains("PERADENIYA")) suffix = "P";
        else if (upperUni.contains("JAYEWARDENE") || upperUni.contains("SJP")) suffix = "J";
        else if (upperUni.contains("KELANIYA")) suffix = "K";
        else if (upperUni.contains("JAFFNA")) suffix = "J";
        else if (upperUni.contains("RUHUNA")) suffix = "R";
        else if (upperUni.contains("EASTERN") && !upperUni.contains("SOUTH")) suffix = "E";
        else if (upperUni.contains("SOUTH EASTERN") || upperUni.contains("SEUSL")) suffix = "SE";
        else if (upperUni.contains("RAJARATA") || upperUni.contains("RUSL")) suffix = "RA";
        else if (upperUni.contains("WAYAMBA") || upperUni.contains("WUSL")) suffix = "W";
        else if (upperUni.contains("SABARAGAMUWA") || upperUni.contains("SUSL")) suffix = "S";
        else if (upperUni.contains("UVA") || upperUni.contains("WELLASSA") || upperUni.contains("UWU")) suffix = "UW";
        else if (upperUni.contains("VISUAL") || upperUni.contains("PERFORMING") || upperUni.contains("UVPA")) suffix = "V";
        else if (upperUni.contains("VAVUNIYA")) suffix = "VA";
        else if (upperUni.contains("GAMPAHA") || upperUni.contains("WICKRAMARACHCHI")) suffix = "GW";
        else {
            String initials = upperUni.replaceAll("[^A-Z]", "");
            suffix = initials.length() > 0 ? initials.substring(0, 1) : "U";
        }
        return cleanCode + suffix;
    }

    public List<Map<String, Object>> extractSection2CoursesAndUniCodes(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        Set<String> seenCourses = new HashSet<>();
        Set<String> seenUniCodes = new HashSet<>();
        String currentStream = "Other Streams (Different Subject Streams)";

        Pattern streamPattern = Pattern.compile("(?im)^\\s*(?:2\\.\\d+(?:\\.\\d+)?\\s+)?([A-Za-z &\\-/]+?\\b(?:STREAM|STREAMS)\\b.*?)$");
        Matcher sm = streamPattern.matcher(text);
        if (sm.find()) {
            currentStream = normalizeStreamName(sm.group(1));
        } else {
            currentStream = normalizeStreamName(text);
        }

        Pattern entryPattern = Pattern.compile("(?m)^\\s*(2\\.\\d+(?:\\.\\d+)+)\\s+([^\r\n]+)");
        List<Integer> startIndices = new ArrayList<>();
        List<String> sectionNumbers = new ArrayList<>();
        List<String> courseHeaders = new ArrayList<>();

        Matcher em = entryPattern.matcher(text);
        while (em.find()) {
            String title = em.group(2).trim();
            if (title.toUpperCase().contains("STREAM") || title.toUpperCase().contains("STREAMS")) {
                currentStream = normalizeStreamName(title);
                continue;
            }
            startIndices.add(em.start());
            sectionNumbers.add(em.group(1).trim());
            courseHeaders.add(title);
        }

        if (startIndices.isEmpty()) {
            Pattern ccPattern = Pattern.compile("(?i)(?:^|\\r?\\n)\\s*(?:([^\r\n]+)\\r?\\n)?\\s*\\(?\\s*course\\s*code\\s*[-:]\\s*([0-9]{3}[A-Z]?)");
            Matcher ccm = ccPattern.matcher(text);
            while (ccm.find()) {
                startIndices.add(ccm.start());
                sectionNumbers.add("");
                courseHeaders.add(ccm.group(1) != null ? ccm.group(1).trim() : "");
            }
        }

        if (startIndices.isEmpty() && Pattern.compile("(?i)course\\s*code\\s*[-:]").matcher(text).find()) {
            startIndices.add(0);
            sectionNumbers.add("");
            courseHeaders.add("");
        }

        Pattern codePattern = Pattern.compile("(?i)(?:\\(?\\s*course\\s*code\\s*[-:]\\s*|\\bcode\\s*[-:]\\s*)([0-9]{3}[A-Z]?)");
        Pattern intakePattern = Pattern.compile("(?i)(?:\\(?\\s*proposed\\s*intake\\s*[-:]\\s*|\\(?\\s*intake\\s*[-:]\\s*)([0-9]+)");
        Pattern eligPattern = Pattern.compile("(?is)minimum\\s+eligibility\\s+requirements\\s*(?:for\\s+admission\\s*)?[:\\-–—](.+?)(?=(?:[•*§\\-]?\\s*(?:degree\\s*programme|degree\\s*program|available\\s*universit|duration)|\\b2\\.\\d+(?:\\.\\d+)+|\\Z))");
        Pattern degreePattern = Pattern.compile("(?is)(?:[•*§\\-]?\\s*)?degree\\s+programme\\s*[:\\-–—](.+?)(?=(?:[•*§\\-]?\\s*(?:available\\s*universit|duration|minimum\\s*eligibility)|\\b2\\.\\d+(?:\\.\\d+)+|\\Z))");
        Pattern uniPattern = Pattern.compile("(?is)(?:[•*§\\-]?\\s*)?available\\s+universit(?:y|ies)\\s*[:\\-–—](.+?)(?=(?:[•*§\\-]?\\s*(?:duration|degree\\s*programme|minimum\\s*eligibility)|\\b2\\.\\d+(?:\\.\\d+)+|\\Z))");
        Pattern durationPattern = Pattern.compile("(?i)(?:[•*§\\-]?\\s*)?duration\\s*[:\\-–—]\\s*([0-9]+\\s*(?:years?|yrs?|months?))");

        List<String> knownUnis = new ArrayList<>();
        knownUnis.addAll(getDynamicUniversities());
        knownUnis.addAll(KNOWN_UNIVERSITIES);
        knownUnis = knownUnis.stream().filter(u -> u != null && !u.isBlank()).distinct().sorted((a, b) -> Integer.compare(b.length(), a.length())).toList();

        for (int i = 0; i < startIndices.size(); i++) {
            int start = startIndices.get(i);
            int end = (i + 1 < startIndices.size()) ? startIndices.get(i + 1) : text.length();
            String block = text.substring(start, end).trim();

            String secNum = sectionNumbers.get(i);
            String courseName = courseHeaders.get(i);

            String blockStream = currentStream;
            if (secNum.startsWith("2.2.1")) blockStream = "Arts";
            else if (secNum.startsWith("2.2.2")) blockStream = "Commerce";
            else if (secNum.startsWith("2.2.3")) blockStream = "Biological Science";
            else if (secNum.startsWith("2.2.4")) {
                if (courseName.toLowerCase().contains("engineering") || courseName.toLowerCase().contains("technology") || courseName.toLowerCase().contains("textile")) {
                    blockStream = "Engineering Technology";
                } else {
                    blockStream = "Physical Science";
                }
            } else if (secNum.startsWith("2.2.5")) blockStream = "Engineering Technology";
            else if (secNum.startsWith("2.2.6")) blockStream = "Biosystems Technology";
            else if (secNum.startsWith("2.2.7")) blockStream = "Indigenous Medicine";

            // Extract Course Code
            String courseCode = "";
            Matcher cm = codePattern.matcher(block);
            if (cm.find()) {
                courseCode = cm.group(1).trim().toUpperCase();
            }

            // Extract Proposed Intake
            int proposedIntake = 0;
            Matcher im = intakePattern.matcher(block);
            if (im.find()) {
                proposedIntake = parseSeatCount(im.group(1));
            }

            // Extract Minimum Eligibility Requirements
            String minimumEligibility = "";
            Matcher ematch = eligPattern.matcher(block);
            if (ematch.find()) {
                minimumEligibility = cleanFieldText(ematch.group(1));
            }

            // Extract Degree Programme
            String degreeProgramme = "";
            Matcher dm = degreePattern.matcher(block);
            if (dm.find()) {
                degreeProgramme = cleanFieldText(dm.group(1));
            }

            // Extract Available Universities
            List<String> unis = new ArrayList<>();
            Matcher um = uniPattern.matcher(block);
            if (um.find()) {
                String rawUniText = um.group(1).trim();
                String[] candidateLines = rawUniText.split("[\\r\\n,;]+");
                for (String cand : candidateLines) {
                    String cleanedU = cleanFieldText(cand);
                    if (cleanedU.isBlank()) continue;
                    boolean matched = false;
                    for (String ku : knownUnis) {
                        if (cleanedU.toUpperCase().contains(ku.toUpperCase()) || ku.toUpperCase().contains(cleanedU.toUpperCase())) {
                            // Prefer title-cased or cleaned text from page
                            String bestName = cleanedU.length() >= ku.length() ? cleanedU : ku;
                            if (!unis.contains(bestName)) unis.add(bestName);
                            matched = true;
                            break;
                        }
                    }
                    if (!matched && looksLikeUniversity(cleanedU)) {
                        if (!unis.contains(cleanedU)) unis.add(cleanedU);
                    }
                }
            }

            if (unis.isEmpty()) {
                for (String ku : knownUnis) {
                    if (block.toUpperCase().contains(ku.toUpperCase())) {
                        if (!unis.contains(ku)) unis.add(ku);
                    }
                }
            }

            // Extract Duration
            String duration = "";
            Matcher durM = durationPattern.matcher(block);
            if (durM.find()) {
                duration = cleanFieldText(durM.group(1));
            } else {
                Matcher numDur = Pattern.compile("(?i)duration\\s*[:\\-–—]\\s*([0-9]+)").matcher(block);
                if (numDur.find()) {
                    duration = String.format("%02d years", Integer.parseInt(numDur.group(1)));
                }
            }

            // Aptitude test boolean
            boolean aptitudeTest = Pattern.compile("(?i)\\b(?:aptitude\\s*test|practical\\s*test|aptitude)\\b").matcher(block).find();

            // Refine Course Name if empty
            if (courseName.isBlank()) {
                Matcher beforeCC = Pattern.compile("(?im)^\\s*(?:2\\.\\d+(?:\\.\\d+)*\\s+)?([A-Za-z0-9 &\\(\\)/\\-,]+?)\\s*(?=\\r?\\n\\s*\\(?\\s*course\\s*code)").matcher(block);
                if (beforeCC.find()) {
                    courseName = beforeCC.group(1).trim();
                } else {
                    courseName = "Course " + (courseCode.isBlank() ? (i + 1) : courseCode);
                }
            }
            courseName = cleanFieldText(courseName);

            // Refine Course Code if empty
            if (courseCode.isBlank()) {
                courseCode = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
            }

            // 1. Create COURSE staging item
            String cKey = courseCode.toUpperCase() + "|||" + courseName.toUpperCase();
            if (!seenCourses.contains(cKey)) {
                seenCourses.add(cKey);
                Map<String, Object> courseItem = new LinkedHashMap<>();
                courseItem.put("moduleType", "COURSE");
                courseItem.put("code", courseCode);
                courseItem.put("name", courseName);
                courseItem.put("streamName", blockStream);
                courseItem.put("totalIntake", proposedIntake);
                courseItem.put("minimumEligibility", minimumEligibility);
                if (!degreeProgramme.isBlank()) {
                    courseItem.put("degreeTitle", degreeProgramme);
                }
                list.add(courseItem);
            }

            // 2. Create UNI_CODE staging items
            if (unis.isEmpty()) {
                unis.add("");
            }
            for (String uName : unis) {
                if (uName.isBlank()) continue;
                String uKey = courseCode.toUpperCase() + "|||" + uName.toUpperCase();
                if (!seenUniCodes.contains(uKey)) {
                    seenUniCodes.add(uKey);
                    Map<String, Object> uniItem = new LinkedHashMap<>();
                    uniItem.put("moduleType", "UNI_CODE");
                    uniItem.put("courseName", courseName);
                    uniItem.put("universityName", uName);
                    uniItem.put("intake", proposedIntake);
                    uniItem.put("degreeProgram", degreeProgramme);
                    uniItem.put("duration", duration.isBlank() ? "04 years" : duration);
                    uniItem.put("aptitudeTest", aptitudeTest);
                    uniItem.put("streamName", blockStream);

                    String uCode = findUniCode(courseName, uName);
                    if (uCode == null || uCode.isBlank()) {
                        uCode = deriveUniCode(courseCode, uName);
                    }
                    uniItem.put("code", uCode);
                    list.add(uniItem);
                }
            }
        }

        return list;
    }
}
