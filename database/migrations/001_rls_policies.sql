-- ==============================================================================
-- 001_rls_policies.sql
-- Kịch Bản Kích Hoạt Row-Level Security (RLS) & Chính Sách Phân Quyền Cấp Hàng
-- Áp dụng cho cơ sở dữ liệu PostgreSQL / Supabase
-- ==============================================================================

-- 1. BẢNG DỰ ÁN (projects)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT,
    genre TEXT,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bật bắt buộc Row-Level Security cho projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Chính sách: Chủ sở hữu có toàn quyền (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Projects: Owner full control"
ON projects
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Chính sách: Đọc dự án công khai (SELECT)
CREATE POLICY "Projects: Read public projects"
ON projects
FOR SELECT
TO authenticated, anon
USING (is_public = TRUE);

-- ------------------------------------------------------------------------------
-- 2. BẢNG CỘNG TÁC VIÊN (project_collaborators)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_email)
);

ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators: Project owner can manage collaborators"
ON project_collaborators
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_collaborators.project_id
        AND projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Collaborators: Collaborators can view membership"
ON project_collaborators
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    user_email = (auth.jwt() ->> 'email')
);

-- Cho phép cộng tác viên đọc dự án được chia sẻ
CREATE POLICY "Projects: Collaborator read access"
ON projects
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = projects.id
        AND (
            project_collaborators.user_id = auth.uid() OR
            project_collaborators.user_email = (auth.jwt() ->> 'email')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 3. BẢNG CHƯƠNG TRUYỆN (chapters)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    raw_content TEXT NOT NULL DEFAULT '',
    translated_content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'translating', 'polished', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapters: Owner full control"
ON chapters
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = chapters.project_id
        AND projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Chapters: Collaborator read access"
ON chapters
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = chapters.project_id
        AND (
            project_collaborators.user_id = auth.uid() OR
            project_collaborators.user_email = (auth.jwt() ->> 'email')
        )
    )
);

CREATE POLICY "Chapters: Editor update access"
ON chapters
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = chapters.project_id
        AND project_collaborators.role = 'editor'
        AND (
            project_collaborators.user_id = auth.uid() OR
            project_collaborators.user_email = (auth.jwt() ->> 'email')
        )
    )
);

-- ------------------------------------------------------------------------------
-- 4. BẢNG TỪ ĐIỂN THUẬT NGỮ (glossary)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS glossary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chinese TEXT NOT NULL,
    vietnamese TEXT NOT NULL,
    pinyin TEXT,
    category TEXT DEFAULT 'general',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Glossary: Owner full control"
ON glossary
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = glossary.project_id
        AND projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Glossary: Collaborator read & write access"
ON glossary
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = glossary.project_id
        AND (
            project_collaborators.user_id = auth.uid() OR
            project_collaborators.user_email = (auth.jwt() ->> 'email')
        )
    )
);
