package com.pathwise.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pathwise.backend.service.GeminiExtractionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class GeminiExtractionServiceTest {

    private GeminiExtractionService extractionService;

    @BeforeEach
    void setUp() {
        extractionService = new GeminiExtractionService(new ObjectMapper(), null, null);
    }

    @Test
    void testExtractSection2CoursesAndUniCodes() {
        String sampleText = """
                2.2.4 ENGINEERING TECHNOLOGY STREAM
                
                2.2.4.3 Engineering  (TM) - Textile & Apparel Engineering
                  (Course Code - 010)
                  (Proposed Intake - 98)
                Minimum eligibility requirements for admission : 
                At least  three ‘S’  grades in Chemistry, Combined Mathematics and Physics at the G.C.E. 
                (Advanced Level) Examination.
                	Degree	Programme	: Bachelor of the Science of Engineering Honours in Textile 
                    & Apparel Engineering
                				[BScEngHons	(Textile & Apparel Engineering)]
                	Available University : University of Moratuwa
                	Duration		:	04	years
                """;

        assertTrue(GeminiExtractionService.isSection2Content(sampleText));

        List<Map<String, Object>> items = extractionService.extractSection2CoursesAndUniCodes(sampleText);
        System.out.println("EXTRACTED ITEMS: " + items);
        assertNotNull(items);
        assertEquals(2, items.size(), "Should have 1 COURSE and 1 UNI_CODE record");

        // Verify COURSE record
        Map<String, Object> courseItem = items.stream()
                .filter(i -> "COURSE".equals(i.get("moduleType")))
                .findFirst()
                .orElse(null);
        assertNotNull(courseItem);
        assertEquals("010", courseItem.get("code"));
        assertEquals("Engineering (TM) - Textile & Apparel Engineering", courseItem.get("name"));
        assertEquals("Engineering Technology", courseItem.get("streamName"));
        assertEquals(98, courseItem.get("totalIntake"));
        assertTrue(courseItem.get("minimumEligibility").toString().contains("At least three ‘S’ grades in Chemistry"));
        assertTrue(courseItem.get("degreeTitle").toString().contains("Bachelor of the Science of Engineering Honours"));

        // Verify UNI_CODE record
        Map<String, Object> uniItem = items.stream()
                .filter(i -> "UNI_CODE".equals(i.get("moduleType")))
                .findFirst()
                .orElse(null);
        assertNotNull(uniItem);
        assertEquals("010M", uniItem.get("code"));
        assertEquals("Engineering (TM) - Textile & Apparel Engineering", uniItem.get("courseName"));
        assertEquals("University of Moratuwa", uniItem.get("universityName"));
        assertEquals(98, uniItem.get("intake"));
        assertEquals("04 years", uniItem.get("duration"));
        assertEquals(false, uniItem.get("aptitudeTest"));
        assertTrue(uniItem.get("degreeProgram").toString().contains("BScEngHons"));
    }

    @Test
    void testExtractMultiCourseAndMultiUniversityWithAptitude() {
        String sampleText = """
                2.2.1 ARTS STREAM
                
                2.2.1.1 Arts
                  (Course Code - 001)
                  (Proposed Intake - 3500)
                Minimum eligibility requirements for admission : 
                At least three 'S' grades in three Arts subjects.
                	Degree	Programme	: Bachelor of Arts
                	Available Universities : University of Colombo, University of Peradeniya, University of Kelaniya
                	Duration		:	03	years
                
                2.2.1.2 Architecture
                  (Course Code - 035)
                  (Proposed Intake - 80)
                Minimum eligibility requirements for admission : 
                Candidates should pass the aptitude test. At least three 'S' grades.
                	Degree	Programme	: Bachelor of Architecture Honours
                	Available University : University of Moratuwa
                	Duration		:	05	years
                """;

        List<Map<String, Object>> items = extractionService.extractSection2CoursesAndUniCodes(sampleText);
        assertNotNull(items);

        // Course 001: 1 Course record + 3 Uni_Code records (Colombo, Peradeniya, Kelaniya)
        // Course 035: 1 Course record + 1 Uni_Code record (Moratuwa with aptitudeTest = true)
        // Total = 6 records
        assertEquals(6, items.size());

        // Check Architecture has aptitudeTest = true
        Map<String, Object> archUni = items.stream()
                .filter(i -> "UNI_CODE".equals(i.get("moduleType")) && "Architecture".equals(i.get("courseName")))
                .findFirst()
                .orElse(null);
        assertNotNull(archUni);
        assertEquals(true, archUni.get("aptitudeTest"));
        assertEquals("035M", archUni.get("code"));
        assertEquals("05 years", archUni.get("duration"));

        // Check Arts multi-university
        long artsUniCount = items.stream()
                .filter(i -> "UNI_CODE".equals(i.get("moduleType")) && "Arts".equals(i.get("courseName")))
                .count();
        assertEquals(3, artsUniCount);
    }
}
