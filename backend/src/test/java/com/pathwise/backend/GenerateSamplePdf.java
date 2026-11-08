package com.pathwise.backend;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;

import java.io.File;

public class GenerateSamplePdf {
    public static void main(String[] args) throws Exception {
        try (PDDocument doc = new PDDocument()) {
            // Page 1
            PDPage p1 = new PDPage();
            doc.addPage(p1);
            try (PDPageContentStream cs = new PDPageContentStream(doc, p1)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText("UNIVERSITY GRANTS COMMISSION - SRI LANKA");
                cs.newLineAtOffset(0, -20);
                cs.showText("ADMISSIONS TO UNDERGRADUATE COURSES 2023/2024");
                cs.newLineAtOffset(0, -30);
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                cs.showText("MINIMUM Z-SCORE CUTOFFS ACROSS DISTRICTS");
                cs.newLineAtOffset(0, -20);
                cs.showText("001A Medicine University of Colombo 2.0521 2.0314 1.9845 1.9567 1.9123 1.8456 1.9678 1.9452 1.8723 1.9324 1.8210 1.8150 1.8340 1.8100 1.8654 1.8540 1.8432 1.9421 1.8650 1.8845 1.8765 1.8920 1.8430 1.9021 1.9214");
                cs.endText();
            }

            // Page 2
            PDPage p2 = new PDPage();
            doc.addPage(p2);
            try (PDPageContentStream cs = new PDPageContentStream(doc, p2)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText("SPECIAL PROVISIONS AND ARTS BASKETS");
                cs.newLineAtOffset(0, -30);
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 10);
                cs.showText("Basket 1: Social Sciences");
                cs.newLineAtOffset(0, -20);
                cs.showText("Differently abled: Candidates eligible for special admissions consideration.");
                cs.endText();
            }

            File out = new File("sample-handbook.pdf");
            doc.save(out);
            System.out.println("Sample PDF generated at: " + out.getAbsolutePath());
        }
    }
}
