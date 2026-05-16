-- WP AI Controller — Schema do Banco
-- Execute no SQL Editor do Supabase

-- Tabela de sites WordPress conectados
CREATE TABLE IF NOT EXISTS sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  wp_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Config de IA por site
CREATE TABLE IF NOT EXISTS ai_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'deepseek', 'openai', 'claude')),
  api_key TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id)
);

-- Projetos/páginas construídas
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  elementor_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: usuário só vê os próprios dados
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus sites" ON sites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Usuário vê suas configs IA" ON ai_configs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM sites WHERE sites.id = ai_configs.site_id AND sites.user_id = auth.uid()
  ));

CREATE POLICY "Usuário vê seus projetos" ON projects
  FOR ALL USING (EXISTS (
    SELECT 1 FROM sites WHERE sites.id = projects.site_id AND sites.user_id = auth.uid()
  ));

-- Índices
CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_configs_site ON ai_configs(site_id);
CREATE INDEX IF NOT EXISTS idx_projects_site ON projects(site_id);
