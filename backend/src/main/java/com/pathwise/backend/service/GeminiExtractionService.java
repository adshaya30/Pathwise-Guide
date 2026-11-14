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

    @Value("${pathwise.gemini.model:gemini-flash-lite-latest}")
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

    private static final List<String> APPROVED_MODELS = List.of(
            "gemini-flash-lite-latest",
            "gemini-3.5-flash",
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

                CRITICAL PROVINCE GROUP EXTRACTION (Part %d of %d):
                You MUST extract ALL course and university rows visible on this page ONLY for the following specific districts:
                %s

                Format as standard 4-column Markdown rows:
                `| District | Course of Study | University | Minimum Z-Score / Cutoff |`

                Rules:
                1. Extract ALL courses & universities on this page for EVERY one of the listed districts (%s).
                2. Special column aliases:
                   - For RATNAPURA: Column header may be printed as 'RATNAPURA' / 'RATHNAPURA' / 'RATNA.'. Output district as 'RATNAPURA'.
                   - For KURUNEGALA: Column header may be printed as 'KURUNEGALA' / 'KURU.' / 'KURUN.'. Output district as 'KURUNEGALA'.
                   - For KEGALLE: Column header may be printed as 'KEGALLA' / 'KEGALLE' / 'KEG.'. Output district as 'KEGALLE'.
                3. Do NOT include table headers, markdown code fences (no ```), or intro text.
                4. Return ONLY data rows starting with `|`.
                5. If a cutoff mark is 'NVQ', 'NQC', '-', or blank, still include the row with that exact value (e.g. 'NVQ', 'NQC', '-'). Do NOT skip 'NVQ' entries.
                6. Do NOT extract districts that are not in this group.
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
                        districtMap.put(districtKey, score);
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
            9. ARTS SUBJECT BASKETS (G.C.E. A/L Arts stream basket selection rules):
               `| Basket | Subject | Guidance / Rule |`

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
                result.pageType = "UNI_CODE";
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
        if (geminiModel != null && !geminiModel.isBlank() && !APPROVED_MODELS.contains(geminiModel)) {
            modelsToTry.add(geminiModel);
        }
        modelsToTry.addAll(APPROVED_MODELS);

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
                || lower.contains("medium of instruction");

        if (hasTableKeywords) return true;

        long linesWithColumns = text.lines()
                .filter(l -> l.contains("\t") || l.split("\\s{3,}").length >= 3)
                .count();

        return linesWithColumns >= 5;
    }

    public boolean isCutoffMarksPage(String text, int pageNumber) {
        if (text == null || text.isBlank()) return false;
        String lower = text.toLowerCase();

        // Handbook table exclusions
        if (lower.contains("uni - code") || lower.contains("uni-code") || lower.contains("uni-codes assigned")
                || lower.contains("places available for admission") || lower.contains("proposed intake")
                || lower.contains("ordinary level") || lower.contains("sin. lang.") || lower.contains("tam. lang.")
                || lower.contains("differently abled") || lower.contains("aptitude test") || lower.contains("practical test")) {
            return false;
        }

        long uniqueDistrictCount = NON_UNIVERSITY_DISTRICT_NAMES.stream()
                .filter(d -> lower.contains(d.toLowerCase()))
                .count();

        boolean hasCutoffHeading = lower.contains("minimum z-score") || lower.contains("minimum 'z' - score")
                || lower.contains("minimum 'z' score") || lower.contains("cutoff") || lower.contains("cut-off")
                || lower.contains("minimum marks for university admission");

        long zScoreDecimalCount = Pattern.compile("[-+]?\\d\\s*\\.\\s*\\d{2,4}\\b").matcher(text).results().count();
        long nqcCount = Pattern.compile("(?i)\\b(NQC|N/A)\\b").matcher(text).results().count();

        if (uniqueDistrictCount >= 2) return true;
        if (hasCutoffHeading && (zScoreDecimalCount >= 2 || nqcCount >= 2 || uniqueDistrictCount >= 1)) return true;
        return zScoreDecimalCount >= 6;
    }

    public static String identifyTableType(String content) {
        if (content == null || content.isBlank()) return "GENERAL";
        String lower = content.toLowerCase();

        String headerLine = content.lines()
                .filter(l -> l.trim().startsWith("|") && !l.contains("---"))
                .findFirst()
                .orElse("")
                .toLowerCase();

        long decimalZScoreCount = Pattern.compile("[-+]?\\d\\.\\d{3,4}\\b").matcher(content).results().count();
        long nqcCount = Pattern.compile("(?i)\\b(NQC|N/A)\\b").matcher(content).results().count();
        boolean hasCutoffKeyword = lower.contains("minimum z-score") || lower.contains("cutoff") || lower.contains("cut-off");

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

        if (lower.contains("minimum z-score") || lower.contains("z-score") || lower.contains("cutoff") || lower.contains("cut-off")
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
            result.pageType = "UNI_CODE";
            result.confidence = 0.88;
            result.items = extractUniCodeRecords(text);
        } else if (lower.contains("aptitude test") || lower.contains("practical test")) {
            result.pageType = "APTITUDE";
            result.confidence = 0.88;
            result.items = extractAptitudeRecords(text);
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

    private List<Map<String, Object>> extractUniCodeRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        // 1. Matches UGC Handbook table lines ending with Uni-Code: COURSE UNIVERSITY CODE
        Pattern p1 = Pattern.compile("^(?:[ï‚µ•*\\s]*)(.+?)\\s{2,}(.+?)\\s+(\\d{3}[A-Z]?)$", Pattern.MULTILINE);
        Matcher m1 = p1.matcher(text);
        while (m1.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("courseName", m1.group(1).trim());
            item.put("universityName", m1.group(2).trim());
            item.put("code", m1.group(3).trim());
            list.add(item);
        }

        // 2. Matches code at start: CODE Course - University
        if (list.isEmpty()) {
            Pattern p2 = Pattern.compile("\\b(\\d{3}[A-Z]?)\\s+([A-Za-z &\\-/]+?)\\s*-\\s*([A-Za-z &\\-/]+)");
            Matcher m2 = p2.matcher(text);
            while (m2.find()) {
                Map<String, Object> item = new HashMap<>();
                item.put("code", m2.group(1).trim());
                item.put("courseName", m2.group(2).trim());
                item.put("universityName", m2.group(3).trim());
                list.add(item);
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
        Pattern p = Pattern.compile("(?m)^\\s*(\\d{3}[A-Z]?)\\s+([A-Za-z &\\(\\)/\\-,]+?)\\s+([A-Za-z &\\(\\)/\\-,]+?)\\s+([0-9.\\-]+.*)$");
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

            String[] tokens = scoresPart.split("\\s+");
            int districtIdx = 0;
            for (String tok : tokens) {
                if (districtIdx >= DISTRICT_KEYS.size()) break;
                String dKey = DISTRICT_KEYS.get(districtIdx);
                try {
                    double val = Double.parseDouble(tok);
                    item.put(dKey, val);
                    districtIdx++;
                } catch (NumberFormatException ignored) {}
            }
            for (int i = districtIdx; i < DISTRICT_KEYS.size(); i++) {
                item.put(DISTRICT_KEYS.get(i), null);
            }
            item.put("validationNotes", validateCutoffDistricts(item));
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> extractCourseRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("(?i)course\\s*(?:code)?[:\\s]+(\\d{3})\\s*[-:]\\s*([A-Za-z &\\-/]+)");
        Matcher m = p.matcher(text);
        while (m.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("code", m.group(1).trim());
            item.put("name", m.group(2).trim());
            item.put("totalIntake", 100);
            list.add(item);
        }
        return list;
    }
}
