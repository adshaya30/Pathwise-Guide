-- PathWise Database Schema for Supabase PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    academic_year VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    total_pages INT DEFAULT 0,
    processed_pages INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Extraction Jobs table
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    progress_percent INT DEFAULT 0,
    current_step VARCHAR(255),
    total_items_extracted INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Pages table (PDF text & classification staging)
CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    raw_text TEXT,
    page_type VARCHAR(100) DEFAULT 'UNKNOWN',
    status VARCHAR(50) DEFAULT 'PENDING',
    extracted_json JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_document_page UNIQUE (document_id, page_number)
);

-- Extracted Records table (Review & staging before publish)
CREATE TABLE IF NOT EXISTS extracted_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    page_number INT,
    module_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    raw_payload JSONB NOT NULL,
    validation_notes TEXT,
    rejection_reason TEXT,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    published_record_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Universities table
CREATE TABLE IF NOT EXISTS universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Streams table
CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    basket_category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stream Subjects linking table
CREATE TABLE IF NOT EXISTS stream_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    is_mandatory BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_stream_subject UNIQUE (stream_id, subject_id)
);

-- Arts Baskets table
CREATE TABLE IF NOT EXISTS arts_baskets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_number INT NOT NULL,
    basket_name VARCHAR(255) NOT NULL,
    min_subjects_required INT DEFAULT 1,
    max_subjects_allowed INT DEFAULT 3,
    rules_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Arts Basket Subjects table
CREATE TABLE IF NOT EXISTS arts_basket_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basket_id UUID REFERENCES arts_baskets(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    subject_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_basket_subject UNIQUE (basket_id, subject_id)
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
    stream_name VARCHAR(100),
    duration_years NUMERIC(3,1) DEFAULT 4.0,
    degree_title VARCHAR(255),
    details JSONB NOT NULL DEFAULT '[]'::jsonb,
    minimum_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Uni-Codes table
CREATE TABLE IF NOT EXISTS uni_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    course_name VARCHAR(255) NOT NULL,
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    university_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    has_disadvantage BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Special Provisions table
CREATE TABLE IF NOT EXISTS special_provisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_name VARCHAR(255) DEFAULT '',
    course_of_study VARCHAR(255) DEFAULT '',
    uni_code VARCHAR(50) DEFAULT '',
    differently_abled INT DEFAULT 0,
    blind_braille INT DEFAULT 0,
    category VARCHAR(100) DEFAULT 'BLIND_AND_DIFFERENTLY_ABLED',
    title VARCHAR(255),
    description TEXT,
    eligible_courses JSONB DEFAULT '[]'::jsonb,
    quota_percentage NUMERIC(5,2),
    conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE special_provisions ADD COLUMN IF NOT EXISTS university_name VARCHAR(255) DEFAULT '';
ALTER TABLE special_provisions ADD COLUMN IF NOT EXISTS course_of_study VARCHAR(255) DEFAULT '';
ALTER TABLE special_provisions ADD COLUMN IF NOT EXISTS uni_code VARCHAR(50) DEFAULT '';
ALTER TABLE special_provisions ADD COLUMN IF NOT EXISTS differently_abled INT DEFAULT 0;
ALTER TABLE special_provisions ADD COLUMN IF NOT EXISTS blind_braille INT DEFAULT 0;
ALTER TABLE special_provisions ALTER COLUMN title DROP NOT NULL;
ALTER TABLE special_provisions ALTER COLUMN description DROP NOT NULL;
ALTER TABLE special_provisions ALTER COLUMN category DROP NOT NULL;

-- Cutoffs table (Single Table Design with 25 Districts)
CREATE TABLE IF NOT EXISTS cutoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uni_code_id UUID REFERENCES uni_codes(id) ON DELETE CASCADE,
    uni_code VARCHAR(50) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    university_name VARCHAR(255) NOT NULL,
    academic_year VARCHAR(50) NOT NULL,
    colombo NUMERIC(8,4),
    gampaha NUMERIC(8,4),
    kalutara NUMERIC(8,4),
    kandy NUMERIC(8,4),
    matale NUMERIC(8,4),
    nuwara_eliya NUMERIC(8,4),
    galle NUMERIC(8,4),
    matara NUMERIC(8,4),
    hambantota NUMERIC(8,4),
    jaffna NUMERIC(8,4),
    kilinochchi NUMERIC(8,4),
    mannar NUMERIC(8,4),
    vavuniya NUMERIC(8,4),
    mullaitivu NUMERIC(8,4),
    batticaloa NUMERIC(8,4),
    ampara NUMERIC(8,4),
    trincomalee NUMERIC(8,4),
    kurunegala NUMERIC(8,4),
    puttalam NUMERIC(8,4),
    anuradhapura NUMERIC(8,4),
    polonnaruwa NUMERIC(8,4),
    badulla NUMERIC(8,4),
    monaragala NUMERIC(8,4),
    ratnapura NUMERIC(8,4),
    kegalle NUMERIC(8,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cutoff_unicode_year UNIQUE (uni_code_id, academic_year)
);

-- Aptitude Requirements table
CREATE TABLE IF NOT EXISTS aptitude_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    course_name VARCHAR(255) NOT NULL,
    course_of_study VARCHAR(255),
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    university_name VARCHAR(255),
    uni_code VARCHAR(50) DEFAULT '',
    test_name VARCHAR(255),
    test_description TEXT,
    passing_criteria TEXT,
    application_deadline VARCHAR(100),
    conducted_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE aptitude_requirements ADD COLUMN IF NOT EXISTS uni_code VARCHAR(50) DEFAULT '';
ALTER TABLE aptitude_requirements ADD COLUMN IF NOT EXISTS course_of_study VARCHAR(255);
ALTER TABLE aptitude_requirements ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE aptitude_requirements ALTER COLUMN test_name DROP NOT NULL;

-- Seed base 25 Sri Lankan Districts
INSERT INTO districts (code, name, province, has_disadvantage) VALUES
('COLOMBO', 'Colombo', 'Western', false),
('GAMPAHA', 'Gampaha', 'Western', false),
('KALUTARA', 'Kalutara', 'Western', false),
('KANDY', 'Kandy', 'Central', false),
('MATALE', 'Matale', 'Central', false),
('NUWARA_ELIYA', 'Nuwara Eliya', 'Central', true),
('GALLE', 'Galle', 'Southern', false),
('MATARA', 'Matara', 'Southern', false),
('HAMBANTOTA', 'Hambantota', 'Southern', true),
('JAFFNA', 'Jaffna', 'Northern', false),
('KILINOCHCHI', 'Kilinochchi', 'Northern', true),
('MANNAR', 'Mannar', 'Northern', true),
('VAVUNIYA', 'Vavuniya', 'Northern', true),
('MULLAITIVU', 'Mullaitivu', 'Northern', true),
('BATTICALOA', 'Batticaloa', 'Eastern', true),
('AMPARA', 'Ampara', 'Eastern', true),
('TRINCOMALEE', 'Trincomalee', 'Eastern', true),
('KURUNEGALA', 'Kurunegala', 'North Western', false),
('PUTTALAM', 'Puttalam', 'North Western', true),
('ANURADHAPURA', 'Anuradhapura', 'North Central', true),
('POLONNARUWA', 'Polonnaruwa', 'North Central', true),
('BADULLA', 'Badulla', 'Uva', true),
('MONARAGALA', 'Monaragala', 'Uva', true),
('RATNAPURA', 'Ratnapura', 'Sabaragamuwa', true),
('KEGALLE', 'Kegalle', 'Sabaragamuwa', false)
ON CONFLICT (code) DO NOTHING;

-- Seed key Sri Lankan Universities
INSERT INTO universities (code, name, location) VALUES
('UOC', 'University of Colombo', 'Colombo'),
('UOP', 'University of Peradeniya', 'Peradeniya, Kandy'),
('UOM', 'University of Moratuwa', 'Moratuwa'),
('USJ', 'University of Sri Jayewardenepura', 'Nugegoda'),
('UOK', 'University of Kelaniya', 'Kelaniya'),
('UOR', 'University of Ruhuna', 'Matara'),
('UOJ', 'University of Jaffna', 'Jaffna'),
('EUSL', 'Eastern University, Sri Lanka', 'Chenkalady, Batticaloa'),
('SEUSL', 'South Eastern University of Sri Lanka', 'Oluvil'),
('RUSL', 'Rajarata University of Sri Lanka', 'Mihintale'),
('WUSL', 'Wayamba University of Sri Lanka', 'Kuliyapitiya'),
('SUSL', 'Sabaragamuwa University of Sri Lanka', 'Belihuloya'),
('UWU', 'Uva Wellassa University', 'Badulla'),
('UVPA', 'University of the Visual and Performing Arts', 'Colombo'),
('GWUIM', 'Gampaha Wickramarachchi University of Indigenous Medicine', 'Yakkala'),
('OUSL', 'Open University of Sri Lanka', 'Nawala, Nugegoda')
ON CONFLICT (code) DO NOTHING;

-- Seed G.C.E. A/L Streams
INSERT INTO streams (code, name, description) VALUES
('PHYSICAL_SCIENCE', 'Physical Science (Mathematics)', 'Combined Mathematics, Physics, Chemistry / Information Technology'),
('BIOLOGICAL_SCIENCE', 'Biological Science', 'Biology, Chemistry, Physics / Agriculture'),
('COMMERCE', 'Commerce', 'Accounting, Business Studies, Economics / Business Statistics'),
('ARTS', 'Arts', 'Social Sciences, Humanities, Aesthetic Studies, Languages'),
('ENGINEERING_TECHNOLOGY', 'Engineering Technology (ET)', 'Engineering Technology, Science for Technology, Mathematics / IT'),
('BIOSYSTEMS_TECHNOLOGY', 'Biosystems Technology (BST)', 'Biosystems Technology, Science for Technology, Agriculture / IT'),
('INDIGENOUS_MEDICINE', 'Indigenous Medicine', 'Ayurveda, Siddha, Unani medicine stream')
ON CONFLICT (code) DO NOTHING;

-- Seed UGC Section 6.1 Special Provisions (Blind & Differently Abled Candidates)
INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Colombo', 'Arts', '019A', 12, 8, 'BLIND_AND_DIFFERENTLY_ABLED', 'Arts - University of Colombo', 'Blind & Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '019A' AND course_of_study = 'Arts');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Peradeniya', 'Biological Science', '006B', 1, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Biological Science - University of Peradeniya', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '006B' AND course_of_study = 'Biological Science');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Peradeniya', 'Physical Science', '013B', 1, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Physical Science - University of Peradeniya', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '013B' AND course_of_study = 'Physical Science');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Peradeniya', 'Management', '016B', 1, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Management - University of Peradeniya', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '016B' AND course_of_study = 'Management');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Peradeniya', 'Arts', '019B', 4, 4, 'BLIND_AND_DIFFERENTLY_ABLED', 'Arts - University of Peradeniya', 'Blind & Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '019B' AND course_of_study = 'Arts');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Peradeniya', 'Food Science and Technology', '035B', 4, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Food Science and Technology - University of Peradeniya', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '035B' AND course_of_study = 'Food Science and Technology');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Sri Jayewardenepura', 'Engineering', '008C', 5, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Engineering - University of Sri Jayewardenepura', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '008C' AND course_of_study = 'Engineering');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Sri Jayewardenepura', 'Commerce', '018C', 10, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Commerce - University of Sri Jayewardenepura', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '018C' AND course_of_study = 'Commerce');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Sri Jayewardenepura', 'Arts', '019C', 8, 5, 'BLIND_AND_DIFFERENTLY_ABLED', 'Arts - University of Sri Jayewardenepura', 'Blind & Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '019C' AND course_of_study = 'Arts');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Sri Jayewardenepura', 'Information Communication Technology', '104C', 2, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'ICT - University of Sri Jayewardenepura', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '104C' AND course_of_study = 'Information Communication Technology');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Kelaniya', 'Biological Science', '006D', 1, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Biological Science - University of Kelaniya', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '006D' AND course_of_study = 'Biological Science');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Kelaniya', 'Arts', '019D', 4, 5, 'BLIND_AND_DIFFERENTLY_ABLED', 'Arts - University of Kelaniya', 'Blind & Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '019D' AND course_of_study = 'Arts');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Jaffna', 'Biological Science', '006E', 5, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Biological Science - University of Jaffna', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '006E' AND course_of_study = 'Biological Science');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Jaffna', 'Physical Science', '013E', 5, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Physical Science - University of Jaffna', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '013E' AND course_of_study = 'Physical Science');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Jaffna', 'Commerce', '018E', 8, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Commerce - University of Jaffna', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '018E' AND course_of_study = 'Commerce');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Jaffna', 'Arts', '019E', 10, 10, 'BLIND_AND_DIFFERENTLY_ABLED', 'Arts - University of Jaffna', 'Blind & Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '019E' AND course_of_study = 'Arts');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Jaffna', 'Law', '025E', 1, 1, 'BLIND_AND_DIFFERENTLY_ABLED', 'Law - University of Jaffna', 'Blind & Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '025E' AND course_of_study = 'Law');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Ruhuna', 'Arts', '019F', 2, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Arts - University of Ruhuna', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '019F' AND course_of_study = 'Arts');

INSERT INTO special_provisions (university_name, course_of_study, uni_code, differently_abled, blind_braille, category, title, description)
SELECT 'University of Moratuwa', 'Information Technology (IT)', '026G', 1, 0, 'BLIND_AND_DIFFERENTLY_ABLED', 'Information Technology (IT) - University of Moratuwa', 'Differently Abled Admission'
WHERE NOT EXISTS (SELECT 1 FROM special_provisions WHERE uni_code = '026G' AND course_of_study = 'Information Technology (IT)');

-- Seed UGC Practical / Aptitude Test Requirements
INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'ARTS (SP) - MASS MEDIA', 'ARTS (SP) - MASS MEDIA', 'SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO', '020S', 'Aptitude Test', 'SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '020S');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'ARTS (SP) - PERFORMING ARTS', 'ARTS (SP) - PERFORMING ARTS', 'SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO', '041S', 'Practical / Aptitude Test', 'SRIPALEE CAMPUS, UNIVERSITY OF COLOMBO', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '041S');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'ARCHITECTURE', 'ARCHITECTURE', 'UNIVERSITY OF MORATUWA', '023G', 'Aptitude Test', 'UNIVERSITY OF MORATUWA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '023G');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'DESIGN', 'DESIGN', 'UNIVERSITY OF MORATUWA', '024G', 'Aptitude Test', 'UNIVERSITY OF MORATUWA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '024G');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'FASHION DESIGN & PRODUCT DEVELOPMENT', 'FASHION DESIGN & PRODUCT DEVELOPMENT', 'UNIVERSITY OF MORATUWA', '034G', 'Aptitude Test', 'UNIVERSITY OF MORATUWA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '034G');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'MUSIC', 'MUSIC', 'UNIVERSITY OF SRI JAYEWARDENEPURA', '068C', 'Practical / Aptitude Test', 'UNIVERSITY OF SRI JAYEWARDENEPURA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '068C');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'MUSIC', 'MUSIC', 'UNIVERSITY OF JAFFNA', '068E', 'Practical / Aptitude Test', 'UNIVERSITY OF JAFFNA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '068E');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'MUSIC', 'MUSIC', 'SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA', '068Y', 'Practical / Aptitude Test', 'SWAMY VIPULANANDA INSTITUTE, EASTERN UNIVERSITY', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '068Y');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'MUSIC', 'MUSIC', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', '068Z', 'Practical / Aptitude Test', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '068Z');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'DANCE', 'DANCE', 'UNIVERSITY OF JAFFNA', '069E', 'Practical / Aptitude Test', 'UNIVERSITY OF JAFFNA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '069E');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'DANCE', 'DANCE', 'SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA', '069Y', 'Practical / Aptitude Test', 'SWAMY VIPULANANDA INSTITUTE, EASTERN UNIVERSITY', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '069Y');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'DANCE', 'DANCE', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', '069Z', 'Practical / Aptitude Test', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '069Z');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'ART & DESIGN', 'ART & DESIGN', 'UNIVERSITY OF JAFFNA', '070E', 'Practical / Aptitude Test', 'UNIVERSITY OF JAFFNA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '070E');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'DRAMA & THEATRE', 'DRAMA & THEATRE', 'SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA', '071Y', 'Practical / Aptitude Test', 'SWAMY VIPULANANDA INSTITUTE, EASTERN UNIVERSITY', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '071Y');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'DRAMA & THEATRE', 'DRAMA & THEATRE', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', '071Z', 'Practical / Aptitude Test', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '071Z');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'VISUAL & TECHNOLOGICAL ARTS', 'VISUAL & TECHNOLOGICAL ARTS', 'SWAMY VIPULANANDA INSTITUTE OF AESTHETIC STUDIES, EASTERN UNIVERSITY, SRI LANKA', '072Y', 'Practical / Aptitude Test', 'SWAMY VIPULANANDA INSTITUTE, EASTERN UNIVERSITY', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '072Y');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'PHYSICAL EDUCATION', 'PHYSICAL EDUCATION', 'UNIVERSITY OF JAFFNA', '081E', 'Practical / Aptitude Test', 'UNIVERSITY OF JAFFNA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '081E');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'PHYSICAL EDUCATION', 'PHYSICAL EDUCATION', 'SABARAGAMUWA UNIVERSITY OF SRI LANKA', '081L', 'Practical / Aptitude Test', 'SABARAGAMUWA UNIVERSITY OF SRI LANKA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '081L');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'SPORTS SCIENCE & MANAGEMENT', 'SPORTS SCIENCE & MANAGEMENT', 'UNIVERSITY OF SRI JAYEWARDENEPURA', '082C', 'Practical / Aptitude Test', 'UNIVERSITY OF SRI JAYEWARDENEPURA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '082C');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'SPORTS SCIENCE & MANAGEMENT', 'SPORTS SCIENCE & MANAGEMENT', 'SABARAGAMUWA UNIVERSITY OF SRI LANKA', '082L', 'Practical / Aptitude Test', 'SABARAGAMUWA UNIVERSITY OF SRI LANKA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '082L');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'VISUAL ARTS', 'VISUAL ARTS', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', '085Z', 'Practical / Aptitude Test', 'UNIVERSITY OF THE VISUAL & PERFORMING ARTS', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '085Z');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'LANDSCAPE ARCHITECTURE', 'LANDSCAPE ARCHITECTURE', 'UNIVERSITY OF MORATUWA', '097G', 'Aptitude Test', 'UNIVERSITY OF MORATUWA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '097G');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'FILM & TELEVISION STUDIES', 'FILM & TELEVISION STUDIES', 'UNIVERSITY OF KELANIYA', '100D', 'Practical / Aptitude Test', 'UNIVERSITY OF KELANIYA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '100D');

INSERT INTO aptitude_requirements (course_of_study, course_name, university_name, uni_code, test_name, conducted_by, passing_criteria)
SELECT 'SPORTS SCIENCE', 'SPORTS SCIENCE', 'UNIVERSITY OF KELANIYA', '141D', 'Practical / Aptitude Test', 'UNIVERSITY OF KELANIYA', 'Pass in practical/aptitude test'
WHERE NOT EXISTS (SELECT 1 FROM aptitude_requirements WHERE uni_code = '141D');

