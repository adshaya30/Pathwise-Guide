package com.pathwise.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.dto.AdvisorChatRequest;
import com.pathwise.backend.dto.AdvisorChatResponse;
import com.pathwise.backend.entity.*;
import com.pathwise.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HybridAdvisorService {

    private final GeminiEmbeddingService embeddingService;
    private final HandbookChunkRepository handbookChunkRepository;
    private final CutoffRepository cutoffRepository;
    private final CourseRepository courseRepository;
    private final UniCodeRepository uniCodeRepository;
    private final OlRequirementRepository olRequirementRepository;
    private final SpecialProvisionRepository specialProvisionRepository;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${pathwise.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${pathwise.gemini.model:gemini-3.5-flash}")
    private String geminiModel;

    public AdvisorChatResponse askAdvisor(AdvisorChatRequest request) {
        String question = request.getQuestion() != null ? request.getQuestion().trim() : "";
        if (question.isBlank()) {
            return AdvisorChatResponse.builder()
                    .answer("Please enter a question regarding university admission, courses, cutoffs, or policies.")
                    .citedPages(List.of())
                    .citedSections(List.of())
                    .build();
        }

        String district = request.getDistrict() != null ? request.getDistrict().trim() : "";
        Double zScore = request.getZScore();
        String stream = request.getStream() != null ? request.getStream().trim() : "";

        // 1. STRUCTURED SQL DATA RETRIEVAL
        List<Map<String, Object>> structuredPreview = new ArrayList<>();
        StringBuilder sqlContext = new StringBuilder();

        // Check if query is seeking Cutoffs / Z-scores
        boolean isCutoffQuery = isCutoffRelated(question);
        if (isCutoffQuery || (zScore != null && !district.isBlank())) {
            List<Cutoff> cutoffs = cutoffRepository.findAll();
            List<Map<String, Object>> matchedCutoffs = filterCutoffs(cutoffs, question, district, zScore);
            if (!matchedCutoffs.isEmpty()) {
                sqlContext.append("### OFFICIAL DATABASE CUTOFF & ADMISSION MARKS:\n");
                for (Map<String, Object> c : matchedCutoffs.stream().limit(15).toList()) {
                    sqlContext.append(String.format("- **%s** at %s (Uni-Code: %s) -> Min Z-Score (%s): %s%s\n",
                            c.get("courseName"),
                            c.get("universityName"),
                            c.get("uniCode"),
                            c.get("district"),
                            c.get("score"),
                            c.get("isNvq") != null && (boolean) c.get("isNvq") ? " [NVQ Eligible]" : ""
                    ));
                }
                sqlContext.append("\n");
                structuredPreview.addAll(matchedCutoffs.stream().limit(10).toList());
            }
        }

        // Check if query mentions O/L requirements
        if (isOlRelated(question)) {
            List<OlRequirement> ols = olRequirementRepository.findAll();
            List<OlRequirement> matchedOls = ols.stream()
                    .filter(ol -> matchesAnyTerm(ol.getCourseOfStudy() + " " + ol.getUniCodes(), question))
                    .limit(5)
                    .toList();
            if (!matchedOls.isEmpty()) {
                sqlContext.append("### OFFICIAL G.C.E. (O/L) REQUIREMENTS:\n");
                for (OlRequirement ol : matchedOls) {
                    sqlContext.append(String.format("- Course: %s | Codes: %s | Sinhala: %s | English: %s | Math: %s | Science: %s | Tamil: %s%s\n",
                            ol.getCourseOfStudy(), ol.getUniCodes(),
                            orDash(ol.getSinhalaLanguage()), orDash(ol.getEnglish()), orDash(ol.getMathematics()),
                            orDash(ol.getScience()), orDash(ol.getTamilLanguage()),
                            (ol.getNotes() != null && !ol.getNotes().isBlank()) ? " | Notes: " + ol.getNotes() : ""
                    ));
                }
                sqlContext.append("\n");
            }
        }

        // Check if query mentions Aptitude / Practical tests
        if (isAptitudeRelated(question)) {
            List<UniCode> aptUniCodes = uniCodeRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getAptitudeTest()))
                    .filter(u -> matchesAnyTerm(u.getCourseName() + " " + u.getUniversityName() + " " + u.getCode(), question))
                    .limit(6)
                    .toList();
            if (!aptUniCodes.isEmpty()) {
                sqlContext.append("### OFFICIAL APTITUDE & PRACTICAL TEST REQUIREMENTS (University Courses):\n");
                for (UniCode u : aptUniCodes) {
                    sqlContext.append(String.format("- Course: %s | University: %s | Uni-Code: %s | Aptitude Required: YES\n",
                            u.getCourseName(), u.getUniversityName(), u.getCode()));
                }
                sqlContext.append("\n");
            }
        }

        // Check if query mentions Differently Abled or Special Provisions
        if (isSpecialProvisionRelated(question)) {
            List<SpecialProvision> sps = specialProvisionRepository.findAll();
            List<SpecialProvision> matchedSps = sps.stream()
                    .filter(sp -> matchesAnyTerm(sp.getCourseOfStudy() + " " + sp.getUniversityName(), question))
                    .limit(5)
                    .toList();
            if (!matchedSps.isEmpty()) {
                sqlContext.append("### OFFICIAL SPECIAL PROVISIONS (Differently Abled / Blind):\n");
                for (SpecialProvision sp : matchedSps) {
                    sqlContext.append(String.format("- University: %s | Course: %s | Differently Abled Quota: %d | Blind (Braille) Quota: %d\n",
                            sp.getUniversityName(), sp.getCourseOfStudy(), sp.getDifferentlyAbled(), sp.getBlindBraille()));
                }
                sqlContext.append("\n");
            }
        }

        // 2. VECTOR RAG RETRIEVAL (Handbook narrative policies, rules, circulars)
        String queryVectorStr = embeddingService.generateEmbeddingString(question);
        List<Map<String, Object>> similarChunks = Collections.emptyList();
        if (queryVectorStr != null && !queryVectorStr.isBlank()) {
            similarChunks = handbookChunkRepository.findSimilarChunks(queryVectorStr, 5, 0.60);
        }

        StringBuilder ragContext = new StringBuilder();
        Set<Integer> citedPages = new LinkedHashSet<>();
        Set<String> citedSections = new LinkedHashSet<>();

        if (!similarChunks.isEmpty()) {
            ragContext.append("### OFFICIAL UGC HANDBOOK NARRATIVE & POLICY SECTIONS:\n");
            for (Map<String, Object> chunk : similarChunks) {
                int pageNum = (int) chunk.get("pageNumber");
                String title = (String) chunk.get("sectionTitle");
                String content = (String) chunk.get("content");
                citedPages.add(pageNum);
                if (title != null && !title.isBlank()) citedSections.add(title);

                ragContext.append(String.format("[Handbook Page %d - %s]:\n%s\n\n", pageNum, title != null ? title : "Section", content));
            }
        }

        // 3. SYNTHESIS WITH GEMINI
        String synthesizedAnswer = synthesizeResponse(question, district, zScore, stream, sqlContext.toString(), ragContext.toString());

        return AdvisorChatResponse.builder()
                .answer(synthesizedAnswer)
                .citedPages(new ArrayList<>(citedPages))
                .citedSections(new ArrayList<>(citedSections))
                .structuredMatchesCount(structuredPreview.size())
                .ragChunksCount(similarChunks.size())
                .structuredDataPreview(structuredPreview)
                .build();
    }

    private String synthesizeResponse(String question, String district, Double zScore, String stream, String sqlContext, String ragContext) {
        String prompt = String.format("""
            You are the official PathWise AI Academic Advisor for Sri Lankan University Admissions (UGC Sri Lanka).
            Your job is to provide accurate, authoritative, and helpful answers to students.

            STUDENT INQUIRY:
            - Question: %s
            - District: %s
            - Z-Score: %s
            - Stream: %s

            %s

            %s

            INSTRUCTIONS & GUARDRAILS:
            1. Use the EXACT numbers from the Database Cutoff & Admission Marks if quoting cutoffs. NEVER make up or hallucinate cutoffs.
            2. When referencing handbook policies, rules, or guidelines, explicitly cite the page number like "[UGC Handbook Page X]".
            3. If the student provides their Z-Score and District, clearly compare their score against the official cutoffs and state whether they meet the threshold or are near the cutoff.
            4. If the data is not present in the provided context, state that clearly and advise checking the latest UGC circulars.
            5. Structure your answer using clear Markdown: bold key numbers, use bullet points, and highlight recommendations.
            """,
                question,
                (district != null && !district.isBlank()) ? district : "Not specified",
                zScore != null ? zScore.toString() : "Not specified",
                (stream != null && !stream.isBlank()) ? stream : "Not specified",
                !sqlContext.isBlank() ? sqlContext : "No specific SQL records matched.",
                !ragContext.isBlank() ? ragContext : "No specific handbook text chunks found in vector search."
        );

        return callGemini(prompt);
    }

    private String callGemini(String prompt) {
        String cleanKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        if (cleanKey.isBlank()) {
            return "Gemini API key is not configured. Please set `GEMINI_API_KEY` in backend configuration.";
        }

        List<String> models = List.of(geminiModel, "gemini-3.5-flash", "gemini-flash-latest");
        for (String model : models) {
            try {
                String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                        model, cleanKey);

                Map<String, Object> body = Map.of(
                        "contents", List.of(
                                Map.of("parts", List.of(Map.of("text", prompt)))
                        ),
                        "generationConfig", Map.of(
                                "temperature", 0.2,
                                "maxOutputTokens", 4096
                        )
                );

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .header("Content-Type", "application/json")
                        .header("x-goog-api-key", cleanKey)
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                        .timeout(Duration.ofSeconds(30))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    JsonNode root = objectMapper.readTree(response.body());
                    JsonNode textNode = root.at("/candidates/0/content/parts/0/text");
                    if (!textNode.isMissingNode()) {
                        return textNode.asText().trim();
                    }
                }
            } catch (Exception e) {
                log.warn("Gemini call failed for model {}: {}", model, e.getMessage());
            }
        }
        return "I apologize, but the AI advisor service is temporarily unable to generate a response. Please try again in a few moments.";
    }

    private List<Map<String, Object>> filterCutoffs(List<Cutoff> cutoffs, String query, String district, Double zScore) {
        List<Map<String, Object>> matches = new ArrayList<>();
        String normDistrict = GeminiExtractionService.normalizeDistrictName(district);
        String districtField = toDistrictCamelCase(normDistrict);

        for (Cutoff c : cutoffs) {
            boolean textMatch = query.isBlank() || matchesAnyTerm(c.getCourseName() + " " + c.getUniversityName() + " " + c.getUniCode(), query);

            if (districtField != null) {
                BigDecimal scoreVal = getDistrictScore(c, districtField);
                boolean isNvq = c.isDistrictNvq(normDistrict);

                if (scoreVal != null) {
                    double dScore = scoreVal.doubleValue();
                    boolean scoreMatch = (zScore == null) || (zScore >= dScore - 0.15); // Include eligible & near-miss
                    if (textMatch && scoreMatch) {
                        Map<String, Object> map = new HashMap<>();
                        map.put("courseName", c.getCourseName());
                        map.put("universityName", c.getUniversityName());
                        map.put("uniCode", c.getUniCode());
                        map.put("district", normDistrict);
                        map.put("score", dScore);
                        map.put("isNvq", isNvq);
                        matches.add(map);
                    }
                } else if (isNvq && textMatch) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("courseName", c.getCourseName());
                    map.put("universityName", c.getUniversityName());
                    map.put("uniCode", c.getUniCode());
                    map.put("district", normDistrict);
                    map.put("score", "NVQ");
                    map.put("isNvq", true);
                    matches.add(map);
                }
            } else if (textMatch) {
                Map<String, Object> map = new HashMap<>();
                map.put("courseName", c.getCourseName());
                map.put("universityName", c.getUniversityName());
                map.put("uniCode", c.getUniCode());
                map.put("district", "National / Island");
                map.put("score", "Various (Select District)");
                matches.add(map);
            }
        }

        // Sort by closest cutoff if zScore is available
        if (zScore != null && districtField != null) {
            matches.sort((a, b) -> {
                Object sa = a.get("score");
                Object sb = b.get("score");
                if (sa instanceof Double da && sb instanceof Double db) {
                    return Double.compare(Math.abs(da - zScore), Math.abs(db - zScore));
                }
                return 0;
            });
        }

        return matches;
    }

    private BigDecimal getDistrictScore(Cutoff c, String districtKey) {
        return switch (districtKey.toLowerCase()) {
            case "colombo" -> c.getColombo();
            case "gampaha" -> c.getGampaha();
            case "kalutara" -> c.getKalutara();
            case "kandy" -> c.getKandy();
            case "matale" -> c.getMatale();
            case "nuwaraeliya" -> c.getNuwaraEliya();
            case "galle" -> c.getGalle();
            case "matara" -> c.getMatara();
            case "hambantota" -> c.getHambantota();
            case "jaffna" -> c.getJaffna();
            case "kilinochchi" -> c.getKilinochchi();
            case "mannar" -> c.getMannar();
            case "vavuniya" -> c.getVavuniya();
            case "mullaitivu" -> c.getMullaitivu();
            case "batticaloa" -> c.getBatticaloa();
            case "ampara" -> c.getAmpara();
            case "trincomalee" -> c.getTrincomalee();
            case "kurunegala" -> c.getKurunegala();
            case "puttalam" -> c.getPuttalam();
            case "anuradhapura" -> c.getAnuradhapura();
            case "polonnaruwa" -> c.getPolonnaruwa();
            case "badulla" -> c.getBadulla();
            case "monaragala" -> c.getMonaragala();
            case "ratnapura" -> c.getRatnapura();
            case "kegalle" -> c.getKegalle();
            default -> null;
        };
    }

    private String toDistrictCamelCase(String normDistrict) {
        if (normDistrict == null || normDistrict.isBlank()) return null;
        return normDistrict.toLowerCase().replace(" ", "");
    }

    private boolean isCutoffRelated(String text) {
        String lower = text.toLowerCase();
        return lower.contains("z-score") || lower.contains("z score") || lower.contains("cutoff")
                || lower.contains("cut-off") || lower.contains("eligible") || lower.contains("can i get")
                || lower.contains("marks") || lower.contains("minimum mark");
    }

    private boolean isOlRelated(String text) {
        String lower = text.toLowerCase();
        return lower.contains("o/l") || lower.contains("ordinary level") || lower.contains("english")
                || lower.contains("math") || lower.contains("sinhala") || lower.contains("tamil");
    }

    private boolean isAptitudeRelated(String text) {
        String lower = text.toLowerCase();
        return lower.contains("aptitude") || lower.contains("practical test") || lower.contains("practical exam");
    }

    private boolean isSpecialProvisionRelated(String text) {
        String lower = text.toLowerCase();
        return lower.contains("differently abled") || lower.contains("blind") || lower.contains("braille")
                || lower.contains("special provision") || lower.contains("disability");
    }

    private boolean matchesAnyTerm(String source, String query) {
        if (source == null || query == null) return false;
        String s = source.toLowerCase();
        String q = query.toLowerCase();
        for (String word : q.split("[\\s,?.!]+")) {
            if (word.length() >= 4 && s.contains(word)) {
                return true;
            }
        }
        return false;
    }

    private String orDash(String s) {
        return (s != null && !s.isBlank()) ? s : "—";
    }
}
