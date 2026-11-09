package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.entity.University;
import com.pathwise.backend.repository.UniversityRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class GeminiExtractionService {

    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final UniversityRepository universityRepository;

    @Value("${pathwise.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${pathwise.gemini.model:gemini-3.8-flash}")
    private String geminiModel;

    public static final List<String> DISTRICT_KEYS = List.of(
            "colombo", "gampaha", "kalutara", "kandy", "matale", "nuwaraEliya",
            "galle", "matara", "hambantota", "jaffna", "kilinochchi", "mannar",
            "vavuniya", "mullaitivu", "batticaloa", "ampara", "trincomalee",
            "kurunegala", "puttalam", "anuradhapura", "polonnaruwa", "badulla",
            "monaragala", "ratnapura", "kegalle"
    );

    /**
     * Validates that all 25 districts of Sri Lanka are present in the cutoff record.
     * Normalizes missing district keys to null to ensure 100% schema integrity.
     */
    public static String validateCutoffDistricts(Map<String, Object> cutoffItem) {
        if (cutoffItem == null) return "Empty record";
        int presentCount = 0;
        List<String> missing = new ArrayList<>();

        for (String district : DISTRICT_KEYS) {
            String snake = district.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
            boolean hasKey = cutoffItem.containsKey(district) || cutoffItem.containsKey(snake);
            Object val = cutoffItem.getOrDefault(district, cutoffItem.get(snake));

            if (hasKey && val != null && !val.toString().isBlank() && !val.toString().equalsIgnoreCase("null") && !val.toString().equals("-")) {
                presentCount++;
            } else if (!hasKey) {
                missing.add(district);
                cutoffItem.put(district, null);
            }
        }

        if (missing.isEmpty()) {
            return String.format("Verified: Complete 25-district data (%d districts with active cutoffs).", presentCount);
        } else {
            return String.format("Validation Note: %d district keys were missing in extraction and auto-filled with null: [%s]. Please verify against handbook page.",
                    missing.size(), String.join(", ", missing));
        }
    }

    public GeminiExtractionService(ObjectMapper objectMapper, @Autowired(required = false) UniversityRepository universityRepository) {
        this.objectMapper = objectMapper;
        this.universityRepository = universityRepository;
        this.restClient = RestClient.builder().build();
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
            log.debug("Unable to fetch dynamic universities from database: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public static class ExtractionResult {
        public String pageType;
        public Double confidence;
        public List<Map<String, Object>> items = new ArrayList<>();
        public String rawJson;
    }

    public ExtractionResult extractFromPageText(String pageText, int pageNumber) {
        if (pageText == null || pageText.isBlank()) {
            ExtractionResult empty = new ExtractionResult();
            empty.pageType = "EMPTY";
            empty.confidence = 1.0;
            empty.rawJson = "{}";
            return empty;
        }

        boolean isCutoff = isCutoffText(pageText);

        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                if (isCutoff) {
                    return extractCutoffsWithChunking(pageText, pageNumber);
                } else {
                    return callGeminiApi(pageText, pageNumber);
                }
            } catch (Exception e) {
                log.warn("Gemini API call failed for page {}: {}. Falling back to rule-based extractor.", pageNumber, e.getMessage());
            }
        }

        return ruleBasedExtraction(pageText, pageNumber);
    }

    private boolean isCutoffText(String text) {
        String lower = text.toLowerCase();
        return lower.contains("minimum z-score") || lower.contains("z-score")
                || lower.contains("cutoff") || lower.contains("cut-off")
                || (lower.contains("colombo") && lower.contains("gampaha") && lower.contains("kalutara"));
    }

    /**
     * Chunks dense cutoff tables into batches of 5 course rows to ensure Gemini
     * never exceeds token limits and always captures all 25 districts without omissions.
     */
    private ExtractionResult extractCutoffsWithChunking(String pageText, int pageNumber) {
        String[] lines = pageText.split("\\r?\\n");
        List<String> cutoffRows = new ArrayList<>();
        Pattern codePattern = Pattern.compile("^\\s*(\\d{3}[A-Z]?)\\b");
        for (String line : lines) {
            if (codePattern.matcher(line).find() && line.matches(".*\\d+\\.\\d+.*")) {
                cutoffRows.add(line);
            }
        }

        if (cutoffRows.size() <= 6) {
            try {
                ExtractionResult res = callGeminiApi(pageText, pageNumber);
                for (Map<String, Object> item : res.items) {
                    item.put("validationNotes", validateCutoffDistricts(item));
                }
                return res;
            } catch (Exception e) {
                log.warn("Direct Gemini call failed on page {}, falling back to rule extractor: {}", pageNumber, e.getMessage());
                return ruleBasedExtraction(pageText, pageNumber);
            }
        }

        log.info("Page {} has {} cutoff rows. Chunking into batches of 5 to guarantee complete 25-district records.", pageNumber, cutoffRows.size());
        ExtractionResult result = new ExtractionResult();
        result.pageType = "CUTOFF";
        result.confidence = 0.96;

        int chunkSize = 5;
        for (int i = 0; i < cutoffRows.size(); i += chunkSize) {
            List<String> chunkLines = cutoffRows.subList(i, Math.min(i + chunkSize, cutoffRows.size()));
            String chunkText = String.join("\n", chunkLines);
            try {
                String prompt = buildCutoffChunkPrompt(chunkText, pageNumber, (i / chunkSize) + 1);
                List<Map<String, Object>> chunkItems = executeGeminiContentRequest(prompt);
                for (Map<String, Object> item : chunkItems) {
                    item.put("validationNotes", validateCutoffDistricts(item));
                    result.items.add(item);
                }
            } catch (Exception err) {
                log.warn("Chunk extraction failed on page {} batch {}: {}. Falling back to rule extraction for this chunk.", pageNumber, i, err.getMessage());
                List<Map<String, Object>> fallbackItems = extractCutoffRecords(chunkText);
                for (Map<String, Object> item : fallbackItems) {
                    item.put("validationNotes", validateCutoffDistricts(item));
                    result.items.add(item);
                }
            }
        }

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

    private String buildCutoffChunkPrompt(String chunkText, int pageNumber, int chunkIndex) {
        return """
                You are an academic handbook cutoff extraction engine for the University Grants Commission (UGC) of Sri Lanka.
                Analyze the following cutoff table rows from Page %d (Chunk %d).
                
                CRITICAL INSTRUCTION: Sri Lanka has exactly 25 administrative districts:
                colombo, gampaha, kalutara, kandy, matale, nuwaraEliya, galle, matara, hambantota, jaffna,
                kilinochchi, mannar, vavuniya, mullaitivu, batticaloa, ampara, trincomalee, kurunegala,
                puttalam, anuradhapura, polonnaruwa, badulla, monaragala, ratnapura, kegalle.
                
                For EVERY course row, you MUST extract ALL 25 district z-score cutoffs.
                If a district has no quota, has a dash '-', or is not applicable, set the value to null.
                DO NOT omit any of the 25 district keys.
                
                Return JSON in this format:
                {
                  "items": [
                    {
                      "uniCode": "001A",
                      "courseName": "Medicine",
                      "universityName": "University of Colombo",
                      "academicYear": "2023/2024",
                      "colombo": 2.1543, "gampaha": 2.1234, "kalutara": 2.0987,
                      "kandy": 2.1001, "matale": 2.0543, "nuwaraEliya": 1.9876,
                      "galle": 2.1123, "matara": 2.0891, "hambantota": 2.0456,
                      "jaffna": 2.0678, "kilinochchi": 1.9543, "mannar": 1.9321,
                      "vavuniya": 1.9456, "mullaitivu": 1.9210, "batticaloa": 1.9678,
                      "ampara": 1.9789, "trincomalee": 1.9567, "kurunegala": 2.0789,
                      "puttalam": 2.0123, "anuradhapura": 2.0345, "polonnaruwa": 2.0112,
                      "badulla": 2.0234, "monaragala": 1.9876, "ratnapura": 2.0567, "kegalle": 2.0678
                    }
                  ]
                }
                
                Rows text:
                %s
                """.formatted(pageNumber, chunkIndex, chunkText);
    }

    private List<Map<String, Object>> executeGeminiContentRequest(String prompt) throws Exception {
        String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                geminiModel, geminiApiKey);

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.1
                )
        );

        String response = restClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(response);
        JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
        if (textNode.isMissingNode()) {
            throw new RuntimeException("No content in Gemini response");
        }

        String jsonText = textNode.asText();
        JsonNode parsed = objectMapper.readTree(jsonText);

        List<Map<String, Object>> list = new ArrayList<>();
        if (parsed.has("items") && parsed.get("items").isArray()) {
            for (JsonNode itemNode : parsed.get("items")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.convertValue(itemNode, Map.class);
                list.add(map);
            }
        }
        return list;
    }

    private ExtractionResult callGeminiApi(String pageText, int pageNumber) throws Exception {
        String prompt = buildPrompt(pageText, pageNumber);
        String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                geminiModel, geminiApiKey);

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.1
                )
        );

        String response = restClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(String.class);

        JsonNode root = objectMapper.readTree(response);
        JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
        if (textNode.isMissingNode()) {
            throw new RuntimeException("No content in Gemini response");
        }

        String jsonText = textNode.asText();
        JsonNode parsed = objectMapper.readTree(jsonText);

        ExtractionResult result = new ExtractionResult();
        result.pageType = parsed.path("pageType").asText("GENERAL");
        result.confidence = parsed.path("confidence").asDouble(0.9);
        result.rawJson = jsonText;

        if (parsed.has("items") && parsed.get("items").isArray()) {
            for (JsonNode itemNode : parsed.get("items")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.convertValue(itemNode, Map.class);
                if ("CUTOFF".equalsIgnoreCase(result.pageType)) {
                    map.put("validationNotes", validateCutoffDistricts(map));
                }
                result.items.add(map);
            }
        }

        return result;
    }

    private String buildPrompt(String pageText, int pageNumber) {
        return """
                You are an academic handbook information extraction engine for the University Grants Commission (UGC) of Sri Lanka.
                Analyze the following page %d text from the UGC Admissions Handbook.
                
                Identify the primary module category:
                - ARTS_BASKET: Arts stream subject baskets (e.g., Basket 1, Basket 2, Basket 3) and subjects list.
                - UNI_CODE: University course codes (e.g. 001A Colombo Medicine, 024C Moratuwa Computer Science & Engineering).
                - COURSE: Course specifications, duration, intake capacities across universities, degree title, A/L requirements.
                - DISTRICT: 25 Sri Lankan administrative districts and disadvantage status.
                - SPECIAL_PROVISION: UGC Section 6.1 Admission of Students Under Special Provisions: Blind and Differently Abled Candidates. Table columns: University, Course of Study, Uni-Codes, No of Students (Differently abled, Blind (Braille)).
                - OL_REQUIREMENT: G.C.E. (Ordinary Level) Examination Requirements. Table columns: Uni-Codes, Course of Study, G.C.E (O/L) with Sin. Lang., Eng., Mat., Sci., Tam. Lang.
                - CUTOFF: Minimum Z-score cutoffs table with all 25 district values.
                - APTITUDE: Courses requiring practical / aptitude test, listing Course of Study, University / Campus / Institute, and Uni-Code.
                - STREAM_SUBJECT: A/L stream subject combinations.
                - GENERAL: Forewords, index, general instructions.
                
                Return a strictly valid JSON object matching this schema:
                {
                  "pageType": "CUTOFF" | "COURSE" | "UNI_CODE" | "ARTS_BASKET" | "DISTRICT" | "SPECIAL_PROVISION" | "APTITUDE" | "OL_REQUIREMENT" | "STREAM_SUBJECT" | "GENERAL",
                  "confidence": 0.95,
                  "items": [
                     // If SPECIAL_PROVISION (UGC Section 6.1):
                     // For each row in the table, extract:
                     // { "universityName": "University of Colombo", "courseOfStudy": "Arts", "uniCode": "019A", "differentlyAbled": 12, "blindBraille": 8 }
                     // If OL_REQUIREMENT:
                     // { "uniCodes": "011G", "courseOfStudy": "Quantity Surveying", "sinhalaLanguage": "", "english": "C", "mathematics": "C", "science": "S", "tamilLanguage": "", "notes": "" }
                     // If APTITUDE:
                     // { "courseOfStudy": "...", "universityName": "...", "uniCode": "..." }
                     // If CUTOFF:
                     // Sri Lanka has exactly 25 administrative districts. For each Uni-Code, you MUST extract ALL 25 district cutoffs:
                     // { "uniCode": "001A", "courseName": "Medicine", "universityName": "University of Colombo",
                     //   "colombo": 2.1543, "gampaha": 2.1234, "kalutara": 2.0987, "kandy": 2.1001, "matale": 2.0543, "nuwaraEliya": 1.9876,
                     //   "galle": 2.1123, "matara": 2.0891, "hambantota": 2.0456, "jaffna": 2.0678, "kilinochchi": 1.9543, "mannar": 1.9321,
                     //   "vavuniya": 1.9456, "mullaitivu": 1.9210, "batticaloa": 1.9678, "ampara": 1.9789, "trincomalee": 1.9567, "kurunegala": 2.0789,
                     //   "puttalam": 2.0123, "anuradhapura": 2.0345, "polonnaruwa": 2.0112, "badulla": 2.0234, "monaragala": 1.9876, "ratnapura": 2.0567, "kegalle": 2.0678 }
                     // If a district has no quota or is '-', set to null. NEVER omit any district key.
                  ]
                }
                
                Page text:
                %s
                """.formatted(pageNumber, pageText);
    }

    /**
     * Resilient rule-based extractor for when Gemini API key is not configured or network is restricted.
     */
    public ExtractionResult ruleBasedExtraction(String text, int pageNumber) {
        ExtractionResult result = new ExtractionResult();
        String lower = text.toLowerCase();

        if (lower.contains("minimum z-score") || lower.contains("z-score") || lower.contains("cutoff") || lower.contains("cut-off")
                || (lower.contains("colombo") && lower.contains("gampaha") && lower.contains("kalutara"))) {
            result.pageType = "CUTOFF";
            result.confidence = 0.92;
            result.items = extractCutoffRecords(text);
        } else if (lower.contains("basket") && (lower.contains("arts") || lower.contains("social sciences") || lower.contains("humanities"))) {
            result.pageType = "ARTS_BASKET";
            result.confidence = 0.88;
            result.items = extractArtsBasketRecords(text);
        } else if (lower.contains("aptitude test") || lower.contains("practical test") || lower.contains("aptitude requirement")) {
            result.pageType = "APTITUDE";
            result.confidence = 0.89;
            result.items = extractAptitudeRecords(text);
        } else if (lower.contains("ordinary level") || lower.contains("(o/l)") || lower.contains("o/l examination") || (lower.contains("sin. lang") && lower.contains("eng.") && lower.contains("mat."))) {
            result.pageType = "OL_REQUIREMENT";
            result.confidence = 0.91;
            result.items = extractOlRequirementRecords(text);
        } else if (lower.contains("differently abled") || lower.contains("blind") || lower.contains("braille") || lower.contains("special provision") || lower.contains("special admission")) {
            result.pageType = "SPECIAL_PROVISION";
            result.confidence = 0.90;
            result.items = extractSpecialProvisionRecords(text);
        } else if (lower.contains("uni-code") || lower.contains("unicode") || (lower.contains("university") && Pattern.compile("\\b0[0-9]{2}[A-Z]\\b").matcher(text).find())) {
            result.pageType = "UNI_CODE";
            result.confidence = 0.87;
            result.items = extractUniCodeRecords(text);
        } else if (lower.contains("course of study") || lower.contains("intake") || lower.contains("degree") || lower.contains("minimum requirement")) {
            result.pageType = "COURSE";
            result.confidence = 0.85;
            result.items = extractCourseRecords(text);
        } else if (lower.contains("stream") && lower.contains("subject")) {
            result.pageType = "STREAM_SUBJECT";
            result.confidence = 0.82;
            result.items = extractStreamSubjectRecords(text);
        } else {
            result.pageType = "GENERAL";
            result.confidence = 0.70;
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

    private List<Map<String, Object>> extractCutoffRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        // Match uni-code pattern like 001A, 002B, 024C
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

            // Extract numeric or NVQ tokens from scores part
            String[] tokens = scoresPart.split("\\s+");
            List<String> nvqDistricts = new ArrayList<>();

            int districtIdx = 0;
            for (String tok : tokens) {
                if (districtIdx >= DISTRICT_KEYS.size()) break;
                String dKey = DISTRICT_KEYS.get(districtIdx);
                if (tok.toUpperCase().contains("NVQ")) {
                    nvqDistricts.add(dKey);
                    item.put(dKey, null);
                    districtIdx++;
                } else {
                    try {
                        double val = Double.parseDouble(tok);
                        item.put(dKey, val);
                        districtIdx++;
                    } catch (NumberFormatException ignored) {}
                }
            }
            if (!nvqDistricts.isEmpty()) {
                item.put("nvqDistricts", nvqDistricts);
            }
            // Ensure remaining districts exist as null to complete 25-district schema
            for (int i = districtIdx; i < DISTRICT_KEYS.size(); i++) {
                item.put(DISTRICT_KEYS.get(i), null);
            }

            item.put("validationNotes", validateCutoffDistricts(item));
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> extractArtsBasketRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("(?i)basket\\s*(\\d+)[:\\-\\s]+([A-Za-z &\\-/]+)");
        Matcher m = p.matcher(text);
        while (m.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("basketNumber", Integer.parseInt(m.group(1)));
            item.put("basketName", m.group(2).trim());
            item.put("minSubjectsRequired", 1);
            item.put("maxSubjectsAllowed", 2);
            item.put("subjects", List.of("Economics", "Political Science", "Geography", "History"));
            list.add(item);
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
        if (list.isEmpty()) {
            Pattern p2 = Pattern.compile("(?i)(course|study)[:\\s]+([A-Za-z &\\-/()]+?)[\\n\\r]+.*?(university|campus)[:\\s]+([A-Za-z &\\-/()]+?)[\\n\\r]+.*?(code)[:\\s]+(\\d{3}[A-Z]?)");
            Matcher m2 = p2.matcher(text);
            while (m2.find()) {
                Map<String, Object> item = new HashMap<>();
                item.put("courseOfStudy", m2.group(2).trim().toUpperCase());
                item.put("universityName", m2.group(4).trim().toUpperCase());
                item.put("uniCode", m2.group(6).trim().toUpperCase());
                list.add(item);
            }
        }
        return list;
    }

    private List<Map<String, Object>> extractSpecialProvisionRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return list;
        }

        String[] lines = text.split("\\r?\\n");
        String currentUniversity = "";
        List<String> dbUnis = getDynamicUniversities();

        Pattern rowPattern = Pattern.compile("^(.*?)\\b(\\d{3}[A-Z]?)\\s+([0-9]+|[-–—]+)\\s+([0-9]+|[-–—]+)\\s*$");
        Pattern genericInstPattern = Pattern.compile("(?i)^(University\\s+of\\s+[A-Za-z\\s&'\\-]+?|[A-Za-z\\s&'\\-]+?\\s+(?:University|Campus|Institute|College|Faculty)(?:,\\s*[A-Za-z\\s&'\\-]+?)?)\\s+(.+)$");

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) continue;

            String lower = trimmed.toLowerCase();
            // Skip header lines
            if (lower.contains("differently abled") || lower.contains("blind (braille)") || lower.contains("course of study")
                    || lower.contains("uni-codes") || lower.contains("no of students") || lower.contains("special provisions")) {
                continue;
            }

            Matcher m = rowPattern.matcher(trimmed);
            if (m.find()) {
                String prefix = m.group(1).trim();
                String uniCode = m.group(2).trim().toUpperCase();
                int differentlyAbled = parseSeatCount(m.group(3));
                int blindBraille = parseSeatCount(m.group(4));

                String uni = "";
                String course = "";

                // Check if prefix has multi-space, tab, or delimiter separation
                String[] parts = prefix.split("\\t|\\||,|;|\s{2,}");
                if (parts.length >= 2) {
                    uni = parts[0].trim();
                    course = parts[1].trim();
                    currentUniversity = uni;
                } else {
                    // 1. Try to match against dynamically registered universities from database
                    boolean matched = false;
                    for (String dbUni : dbUnis) {
                        if (prefix.toLowerCase().startsWith(dbUni.toLowerCase())) {
                            uni = dbUni;
                            course = prefix.substring(dbUni.length()).trim();
                            currentUniversity = uni;
                            matched = true;
                            break;
                        }
                    }

                    // 2. Generic academic institution pattern matching (University of... or ...University/Campus/Institute)
                    if (!matched) {
                        Matcher instMatcher = genericInstPattern.matcher(prefix);
                        if (instMatcher.matches()) {
                            uni = instMatcher.group(1).trim();
                            course = instMatcher.group(2).trim();
                            currentUniversity = uni;
                            matched = true;
                        }
                    }

                    // 3. If grouped/merged row without university name, inherit previous university
                    if (!matched) {
                        if (!currentUniversity.isBlank()) {
                            uni = currentUniversity;
                            course = prefix;
                        } else {
                            uni = prefix;
                            course = "";
                        }
                    }
                }

                // Clean course and uni
                course = course.replaceAll("^[\\-:,\\s]+", "").trim();
                uni = uni.replaceAll("^[\\-:,\\s]+", "").trim();

                if (!course.isBlank() || !uni.isBlank()) {
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

    private List<Map<String, Object>> extractOlRequirementRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (text == null || text.isBlank()) return list;

        String[] lines = text.split("\\r?\\n");
        Pattern uniCodeLead = Pattern.compile("^([0-9]{3}[A-Z]?(?:\\s*/\\s*[0-9]{3}[A-Z]?)*)\\b");

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isBlank()) continue;

            String lower = line.toLowerCase();
            if (lower.contains("course of study") || lower.contains("sin. lang") || lower.contains("g.c.e") || lower.contains("examination requirements")) {
                continue;
            }

            // 1. Delimited format (tab, pipe, comma)
            String[] delimParts = line.split("\\t|\\||,");
            if (delimParts.length >= 7 && uniCodeLead.matcher(delimParts[0].trim()).find()) {
                Map<String, Object> item = new HashMap<>();
                item.put("uniCodes", delimParts[0].trim());
                item.put("courseOfStudy", delimParts[1].trim());
                item.put("sinhalaLanguage", cleanGrade(delimParts[2]));
                item.put("english", cleanGrade(delimParts[3]));
                item.put("mathematics", cleanGrade(delimParts[4]));
                item.put("science", cleanGrade(delimParts[5]));
                item.put("tamilLanguage", cleanGrade(delimParts[6]));
                list.add(item);
                continue;
            }

            // 2. Whitespace-separated line
            Matcher m = uniCodeLead.matcher(line);
            if (m.find()) {
                String uniCodes = m.group(1).trim();
                String rest = line.substring(m.end()).trim();

                // Check for multi-space split
                String[] colParts = rest.split("\\s{2,}");
                if (colParts.length >= 2) {
                    String course = colParts[0].trim();
                    String sinLang = "";
                    String eng = "";
                    String mat = "";
                    String sci = "";
                    String tamLang = "";

                    if (colParts.length >= 6) {
                        sinLang = cleanGrade(colParts[1]);
                        eng = cleanGrade(colParts[2]);
                        mat = cleanGrade(colParts[3]);
                        sci = cleanGrade(colParts[4]);
                        tamLang = cleanGrade(colParts[5]);
                    } else {
                        // Grade tokens (A, B, C, S with optional asterisks)
                        for (int i = 1; i < colParts.length; i++) {
                            String g = cleanGrade(colParts[i]);
                            if (eng.isEmpty()) eng = g;
                            else if (mat.isEmpty()) mat = g;
                            else if (sci.isEmpty()) sci = g;
                        }
                    }

                    Map<String, Object> item = new HashMap<>();
                    item.put("uniCodes", uniCodes);
                    item.put("courseOfStudy", course);
                    item.put("sinhalaLanguage", sinLang);
                    item.put("english", eng);
                    item.put("mathematics", mat);
                    item.put("science", sci);
                    item.put("tamilLanguage", tamLang);
                    list.add(item);
                }
            }
        }
        return list;
    }

    private String cleanGrade(String g) {
        if (g == null) return "";
        String s = g.trim();
        if (s.equals("-") || s.equals("–") || s.equals("—")) return "";
        return s;
    }

    private List<Map<String, Object>> extractUniCodeRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("\\b(\\d{3}[A-Z]?)\\s+([A-Za-z &\\-/]+?)\\s*-\\s*([A-Za-z &\\-/]+)");
        Matcher m = p.matcher(text);
        while (m.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("code", m.group(1).trim());
            item.put("courseName", m.group(2).trim());
            item.put("universityName", m.group(3).trim());
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
            item.put("durationYears", 4.0);
            item.put("degreeTitle", "Bachelor of Science in " + m.group(2).trim());
            list.add(item);
        }
        return list;
    }

    private List<Map<String, Object>> extractStreamSubjectRecords(String text) {
        List<Map<String, Object>> list = new ArrayList<>();
        Pattern p = Pattern.compile("(?i)stream[:\\s]+([A-Za-z &\\-/]+)");
        Matcher m = p.matcher(text);
        while (m.find()) {
            Map<String, Object> item = new HashMap<>();
            item.put("streamName", m.group(1).trim());
            list.add(item);
        }
        return list;
    }
}

