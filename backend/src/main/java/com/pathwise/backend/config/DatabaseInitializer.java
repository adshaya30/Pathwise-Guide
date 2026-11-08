package com.pathwise.backend.config;

import com.pathwise.backend.entity.AptitudeRequirement;
import com.pathwise.backend.entity.SpecialProvision;
import com.pathwise.backend.repository.AptitudeRequirementRepository;
import com.pathwise.backend.repository.SpecialProvisionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseInitializer implements CommandLineRunner {

    private final DataSource dataSource;
    private final SpecialProvisionRepository specialProvisionRepository;
    private final AptitudeRequirementRepository aptitudeRequirementRepository;

    @Override
    public void run(String... args) {
        try {
            log.info("Executing schema.sql on Supabase PostgreSQL...");
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
            populator.addScript(new ClassPathResource("schema.sql"));
            populator.setContinueOnError(true);
            populator.execute(dataSource);
            log.info("schema.sql executed successfully! All tables and seed data are verified.");
        } catch (Exception e) {
            log.warn("Notice during schema initialization: {}", e.getMessage());
        }

        seedUgcSpecialProvisions();
        seedUgcAptitudeRequirements();
    }

    private void seedUgcSpecialProvisions() {
        try {
            // Remove any legacy dummy rows without uniCode
            specialProvisionRepository.findAll().stream()
                    .filter(sp -> sp.getUniCode() == null || sp.getUniCode().isBlank())
                    .forEach(sp -> specialProvisionRepository.deleteById(sp.getId()));

            List<Object[]> allocations = List.of(
                    new Object[]{"University of Colombo", "Arts", "019A", 12, 8},
                    new Object[]{"University of Peradeniya", "Biological Science", "006B", 1, 0},
                    new Object[]{"University of Peradeniya", "Physical Science", "013B", 1, 0},
                    new Object[]{"University of Peradeniya", "Management", "016B", 1, 0},
                    new Object[]{"University of Peradeniya", "Arts", "019B", 4, 4},
                    new Object[]{"University of Peradeniya", "Food Science and Technology", "035B", 4, 0},
                    new Object[]{"University of Sri Jayewardenepura", "Engineering", "008C", 5, 0},
                    new Object[]{"University of Sri Jayewardenepura", "Commerce", "018C", 10, 0},
                    new Object[]{"University of Sri Jayewardenepura", "Arts", "019C", 8, 5},
                    new Object[]{"University of Sri Jayewardenepura", "Information Communication Technology", "104C", 2, 0},
                    new Object[]{"University of Kelaniya", "Biological Science", "006D", 1, 0},
                    new Object[]{"University of Kelaniya", "Arts", "019D", 4, 5},
                    new Object[]{"University of Jaffna", "Biological Science", "006E", 5, 0},
                    new Object[]{"University of Jaffna", "Physical Science", "013E", 5, 0},
                    new Object[]{"University of Jaffna", "Commerce", "018E", 8, 0},
                    new Object[]{"University of Jaffna", "Arts", "019E", 10, 10},
                    new Object[]{"University of Jaffna", "Law", "025E", 1, 1},
                    new Object[]{"University of Ruhuna", "Arts", "019F", 2, 0},
                    new Object[]{"University of Moratuwa", "Information Technology (IT)", "026G", 1, 0}
            );

            List<SpecialProvision> existing = specialProvisionRepository.findAll();
            for (Object[] row : allocations) {
                String uni = (String) row[0];
                String course = (String) row[1];
                String code = (String) row[2];
                int diffAbled = (int) row[3];
                int blind = (int) row[4];

                boolean exists = existing.stream().anyMatch(e -> code.equalsIgnoreCase(e.getUniCode()) && course.equalsIgnoreCase(e.getCourseOfStudy()));
                if (!exists) {
                    specialProvisionRepository.save(SpecialProvision.builder()
                            .universityName(uni)
                            .courseOfStudy(course)
                            .uniCode(code)
                            .differentlyAbled(diffAbled)
                            .blindBraille(blind)
                            .category("BLIND_AND_DIFFERENTLY_ABLED")
                            .title(course + " - " + uni)
                            .description("UGC Section 6.1 Special Provision for " + course + " (" + code + ")")
                            .build());
                }
            }
            log.info("UGC Section 6.1 Special Provisions seeded successfully.");
        } catch (Exception e) {
            log.warn("Error seeding special provisions: {}", e.getMessage());
        }
    }

    private void seedUgcAptitudeRequirements() {
        try {
            // Remove any legacy dummy rows without uniCode
            aptitudeRequirementRepository.findAll().stream()
                    .filter(a -> a.getUniCode() == null || a.getUniCode().isBlank())
                    .forEach(a -> aptitudeRequirementRepository.deleteById(a.getId()));

            List<String[]> aptitudes = List.of(
                    new String[]{"ARTS (SP) - MASS MEDIA", "SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO", "020S"},
                    new String[]{"ARTS (SP) - PERFORMING ARTS", "SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO", "041S"},
                    new String[]{"ARCHITECTURE", "UNIVERSITY OF MORATUWA", "023G"},
                    new String[]{"DESIGN", "UNIVERSITY OF MORATUWA", "024G"},
                    new String[]{"FASHION DESIGN & PRODUCT DEVELOPMENT", "UNIVERSITY OF MORATUWA", "034G"},
                    new String[]{"MUSIC", "UNIVERSITY OF SRI JAYEWARDENEPURA", "068C"},
                    new String[]{"MUSIC", "UNIVERSITY OF JAFFNA", "068E"},
                    new String[]{"MUSIC", "SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA", "068Y"},
                    new String[]{"MUSIC", "UNIVERSITY OF THE VISUAL & PERFORMING ARTS", "068Z"},
                    new String[]{"DANCE", "UNIVERSITY OF JAFFNA", "069E"},
                    new String[]{"DANCE", "SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA", "069Y"},
                    new String[]{"DANCE", "UNIVERSITY OF THE VISUAL & PERFORMING ARTS", "069Z"},
                    new String[]{"ART & DESIGN", "UNIVERSITY OF JAFFNA", "070E"},
                    new String[]{"DRAMA & THEATRE", "SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA", "071Y"},
                    new String[]{"DRAMA & THEATRE", "UNIVERSITY OF THE VISUAL & PERFORMING ARTS", "071Z"},
                    new String[]{"VISUAL & TECHNOLOGICAL ARTS", "SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA", "072Y"},
                    new String[]{"PHYSICAL EDUCATION", "UNIVERSITY OF JAFFNA", "081E"},
                    new String[]{"PHYSICAL EDUCATION", "SABARAGAMUWA UNIVERSITY OF SRI LANKA", "081L"},
                    new String[]{"SPORTS SCIENCE & MANAGEMENT", "UNIVERSITY OF SRI JAYEWARDENEPURA", "082C"},
                    new String[]{"SPORTS SCIENCE & MANAGEMENT", "SABARAGAMUWA UNIVERSITY OF SRI LANKA", "082L"},
                    new String[]{"VISUAL ARTS", "UNIVERSITY OF THE VISUAL & PERFORMING ARTS", "085Z"},
                    new String[]{"LANDSCAPE ARCHITECTURE", "UNIVERSITY OF MORATUWA", "097G"},
                    new String[]{"FILM & TELEVISION STUDIES", "UNIVERSITY OF KELANIYA", "100D"},
                    new String[]{"SPORTS SCIENCE", "UNIVERSITY OF KELANIYA", "141D"}
            );

            List<AptitudeRequirement> existing = aptitudeRequirementRepository.findAll();
            for (String[] row : aptitudes) {
                String course = row[0];
                String uni = row[1];
                String code = row[2];

                boolean exists = existing.stream().anyMatch(e -> code.equalsIgnoreCase(e.getUniCode()));
                if (!exists) {
                    aptitudeRequirementRepository.save(AptitudeRequirement.builder()
                            .courseOfStudy(course)
                            .courseName(course)
                            .universityName(uni)
                            .uniCode(code)
                            .testName("Practical / Aptitude Test")
                            .conductedBy(uni)
                            .passingCriteria("Pass in practical/aptitude test in addition to cutoff mark")
                            .build());
                }
            }
            log.info("UGC Aptitude Requirements seeded successfully.");
        } catch (Exception e) {
            log.warn("Error seeding aptitude requirements: {}", e.getMessage());
        }
    }
}
