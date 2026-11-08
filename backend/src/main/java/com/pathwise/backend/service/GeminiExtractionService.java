package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
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

    @Value("${pathwise.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${pathwise.gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    public GeminiExtractionService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().build();
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

        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                return callGeminiApi(pageText, pageNumber);
            } catch (Exception e) {
                log.warn("Gemini API call failed for page {}: {}. Falling back to rule-based extractor.", pageNumber, e.getMessage());
            }
        }

        return ruleBasedExtraction(pageText, pageNumber);
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
                - CUTOFF: Minimum Z-score cutoffs table with district values.
                - APTITUDE: Courses requiring practical / aptitude test, listing Course of Study, University / Campus / Institute, and Uni-Code.
                - STREAM_SUBJECT: A/L stream subject combinations.
                - GENERAL: Forewords, index, general instructions.
                
                Return a strictly valid JSON object matching this schema:
                {
                  "pageType": "CUTOFF" | "COURSE" | "UNI_CODE" | "ARTS_BASKET" | "DISTRICT" | "SPECIAL_PROVISION" | "APTITUDE" | "STREAM_SUBJECT" | "GENERAL",
                  "confidence": 0.95,
                  "items": [
                     // If SPECIAL_PROVISION (UGC Section 6.1):
                     // For each row in the table, extract:
                     // { "universityName": "University of Colombo", "courseOfStudy": "Arts", "uniCode": "019A", "differentlyAbled": 12, "blindBraille": 8 }
                     // Note: If seat count is "-" or absent, set to 0. If university is visually grouped across rows, retain the universityName.
                     // If APTITUDE:
                     // { "courseOfStudy": "...", "universityName": "...", "uniCode": "..." }
                     // If CUTOFF:
                     // { "uniCode": "...", "courseName": "...", "universityName": "...", "colombo": 1.95, ... }
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

            // Extract numeric tokens from scores part
            String[] tokens = scoresPart.split("\\s+");
            String[] districts = {"colombo", "gampaha", "kalutara", "kandy", "matale", "nuwaraEliya",
                    "galle", "matara", "hambantota", "jaffna", "kilinochchi", "mannar",
                    "vavuniya", "mullaitivu", "batticaloa", "ampara", "trincomalee",
                    "kurunegala", "puttalam", "anuradhapura", "polonnaruwa", "badulla",
                    "monaragala", "ratnapura", "kegalle"};

            int districtIdx = 0;
            for (String tok : tokens) {
                if (districtIdx >= districts.length) break;
                try {
                    double val = Double.parseDouble(tok);
                    item.put(districts[districtIdx], val);
                    districtIdx++;
                } catch (NumberFormatException ignored) {}
            }
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

        // Known Sri Lankan universities for boundary matching in PDF-extracted lines
        List<String> knownUnis = List.of(
                "University of Sri Jayewardenepura",
                "University of Colombo",
                "University of Peradeniya",
                "University of Kelaniya",
                "University of Moratuwa",
                "University of Jaffna",
                "University of Ruhuna",
                "Eastern University, Sri Lanka",
                "Eastern University",
                "South Eastern University of Sri Lanka",
                "South Eastern University",
                "Rajarata University of Sri Lanka",
                "Rajarata University",
                "Wayamba University of Sri Lanka",
                "Wayamba University",
                "Sabaragamuwa University of Sri Lanka",
                "Sabaragamuwa University",
                "Uva Wellassa University",
                "University of the Visual & Performing Arts",
                "University of the Visual and Performing Arts",
                "Gampaha Wickramarachchi University",
                "Open University of Sri Lanka"
        );

        Pattern rowPattern = Pattern.compile("^(.*?)\\b(\\d{3}[A-Z]?)\\s+([0-9]+|[-–—]+)\\s+([0-9]+|[-–—]+)\\s*$");

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

                // Check if prefix has multi-space or tab separation
                String[] parts = prefix.split("\\t|\\s{2,}");
                if (parts.length >= 2) {
                    uni = parts[0].trim();
                    course = parts[1].trim();
                    currentUniversity = uni;
                } else {
                    // Try to match known university at start of prefix
                    boolean matchedKnown = false;
                    for (String ku : knownUnis) {
                        if (prefix.toLowerCase().startsWith(ku.toLowerCase())) {
                            uni = ku;
                            course = prefix.substring(ku.length()).trim();
                            currentUniversity = uni;
                            matchedKnown = true;
                            break;
                        }
                    }

                    if (!matchedKnown) {
                        if (!currentUniversity.isBlank()) {
                            uni = currentUniversity;
                            course = prefix;
                        } else {
                            uni = prefix;
                            course = "Arts";
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

