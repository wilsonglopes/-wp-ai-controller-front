# WP AI Builder — Sistema Completo de Construção WordPress com IA

> **Para workers agênticos:** Use superpowers:subagent-driven-development ou superpowers:executing-plans para implementar fase a fase.

**Objetivo:** Transformar o wp-ai-controller-front em um sistema completo e auto-aprendível de construção de páginas WordPress via comandos em linguagem natural, com biblioteca de receitas, gerenciamento de conhecimento e loop de treinamento da IA.

**Arquitetura:** Frontend Next.js centralizado no Netlify que gerencia múltiplos sites WordPress via plugin REST API. A IA recebe contexto dinâmico (base de conhecimento + receitas aprovadas + snippets customizados) e executa tool use em loop para construir páginas Elementor. Builds bem avaliados retroalimentam o sistema como receitas, tornando a IA progressivamente mais inteligente.

**Stack:** Next.js 16 · React 19 · TypeScript · Supabase · Tailwind v4 · shadcn/ui · Anthropic SDK · OpenAI SDK · Plugin WP AI Controller

---

## Visão Geral das Fases

| Fase | O que entrega | Tempo estimado |
|------|--------------|----------------|
| 1 | Limpeza + unificação do knowledge | 1h |
| 2 | Expansão do banco de dados | 1h |
| 3 | Builder potente (histórico + injeção de receitas) | 3h |
| 4 | UI do builder aprimorada (rating + salvar receita) | 2h |
| 5 | Biblioteca de receitas `/recipes` | 3h |
| 6 | Histórico de builds `/history` | 2h |
| 7 | Gerenciador de conhecimento `/knowledge` | 3h |
| 8 | Loop de treinamento (receitas → system prompt) | 2h |

**Total estimado:** 17h de desenvolvimento

---

## Mapa de Arquivos

### Novos arquivos
```
knowledge/
└── base.json                          ← knowledge.json movido do wp-ai-knowledge

src/app/
├── recipes/page.tsx                   ← Biblioteca de receitas
├── history/page.tsx                   ← Histórico de builds
└── knowledge/page.tsx                 ← Gerenciador de conhecimento

src/app/api/
├── recipes/route.ts                   ← CRUD de receitas
├── knowledge/route.ts                 ← CRUD de snippets
└── builds/route.ts                    ← Salvar/buscar builds

src/components/
├── recipe-picker.tsx                  ← Modal de seleção de receita antes do build
├── recipe-card.tsx                    ← Card de receita na biblioteca
├── build-rating.tsx                   ← Componente de rating pós-build
├── build-card.tsx                     ← Card do histórico de builds
└── knowledge-snippet-editor.tsx       ← Editor de snippets de conhecimento

src/lib/
├── knowledge.ts                       ← Carrega e mescla base.json + snippets
├── recipes-actions.ts                 ← Server actions de receitas
├── builds-actions.ts                  ← Server actions de builds
└── knowledge-actions.ts               ← Server actions de snippets
```

### Arquivos modificados
```
src/lib/types.ts                       ← +Build, Recipe, KnowledgeSnippet
src/lib/ai-builder.ts                  ← +injeção de receitas no system prompt
src/components/builder-chat.tsx        ← +recipe picker, rating, salvar receita
src/app/page.tsx                       ← +links para recipes/history/knowledge
supabase-schema.sql                    ← +3 novas tabelas + RLS
.gitignore                             ← +plugins/ +check.py
```

### Arquivos removidos
```
check.py                               ← Arquivo Python solto, sem relação
```

---

## Fase 1 — Limpeza + Unificação do Knowledge

### Objetivo
Remover arquivos desnecessários, trazer o `knowledge.json` para dentro do projeto e configurar `.gitignore` corretamente.

### Tarefa 1.1 — Limpar arquivos desnecessários

- [ ] Deletar `check.py` da raiz do projeto
- [ ] Criar/atualizar `.gitignore`:

```gitignore
# Dependencies
node_modules/
.next/
.pnp
.pnp.js

# Environment
.env
.env.local
.env*.local

# Build
dist/
build/

# Editor
.vscode/
.idea/
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store
Thumbs.db

# Projeto
plugins/
check.py
```

- [ ] Commit: `chore: limpar arquivos desnecessários`

### Tarefa 1.2 — Integrar knowledge base ao projeto

- [ ] Criar pasta `knowledge/` na raiz do projeto
- [ ] Copiar `J:\wp-ai-knowledge\knowledge.json` → `knowledge/base.json`
- [ ] Criar `src/lib/knowledge.ts`:

```typescript
import baseKnowledge from "../../knowledge/base.json"
import { createClient } from "./supabase-server"

export async function getBuilderKnowledge(): Promise<string> {
  const supabase = await createClient()

  // Busca snippets ativos do usuário
  const { data: snippets } = await supabase
    .from("knowledge_snippets")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  const customWidgets: Record<string, unknown> = {}
  const customTips: string[] = []
  const customRecipes: Record<string, unknown> = {}

  if (snippets) {
    for (const snippet of snippets) {
      if (snippet.type === "widget") customWidgets[snippet.name] = snippet.content
      if (snippet.type === "tip") customTips.push(`- ${snippet.description}: ${JSON.stringify(snippet.content)}`)
      if (snippet.type === "recipe") customRecipes[snippet.name] = snippet.content
    }
  }

  const merged = {
    ...baseKnowledge,
    widgets: { ...baseKnowledge.widgets, ...customWidgets },
    custom_recipes: customRecipes,
  }

  let result = JSON.stringify(merged, null, 2)

  if (customTips.length > 0) {
    result += `\n\nDICAS CUSTOMIZADAS DO USUÁRIO:\n${customTips.join("\n")}`
  }

  return result
}

export async function getTopRecipesForPrompt(limit = 5): Promise<string> {
  const supabase = await createClient()

  const { data: recipes } = await supabase
    .from("recipes")
    .select("name, description, category, prompt_example, elementor_json")
    .order("usage_count", { ascending: false })
    .limit(limit)

  if (!recipes || recipes.length === 0) return ""

  const lines = recipes.map(
    (r) => `### ${r.name} (${r.category})\n${r.description}\nExemplo: "${r.prompt_example}"`
  )

  return `\n\n## RECEITAS APROVADAS (use como referência):\n${lines.join("\n\n")}`
}
```

- [ ] Adicionar no `tsconfig.json` o suporte a import JSON:
```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

- [ ] Commit: `feat: integrar knowledge base ao projeto`

---

## Fase 2 — Expansão do Banco de Dados

### Objetivo
Adicionar 3 tabelas ao Supabase: `builds`, `recipes`, `knowledge_snippets`.

### Tarefa 2.1 — Atualizar schema SQL

- [ ] Adicionar ao `supabase-schema.sql`:

```sql
-- Histórico de builds (páginas construídas pela IA)
CREATE TABLE IF NOT EXISTS builds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  prompt TEXT NOT NULL,
  page_url TEXT,
  page_id INTEGER,
  elementor_json JSONB,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  saved_as_recipe UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Biblioteca de receitas (templates aprovados)
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  tags TEXT[] DEFAULT '{}',
  prompt_example TEXT,
  elementor_json JSONB NOT NULL,
  preview_url TEXT,
  usage_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_from_build UUID REFERENCES builds(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK de builds para recipes
ALTER TABLE builds ADD CONSTRAINT builds_saved_as_recipe_fkey
  FOREIGN KEY (saved_as_recipe) REFERENCES recipes(id) ON DELETE SET NULL;

-- Snippets de conhecimento customizado
CREATE TABLE IF NOT EXISTS knowledge_snippets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('widget', 'recipe', 'tip', 'pattern')),
  name TEXT NOT NULL,
  description TEXT,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "builds_owner" ON builds
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "recipes_owner" ON recipes
  FOR ALL USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "knowledge_snippets_owner" ON knowledge_snippets
  FOR ALL USING (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_builds_user ON builds(user_id);
CREATE INDEX IF NOT EXISTS idx_builds_site ON builds(site_id);
CREATE INDEX IF NOT EXISTS idx_builds_rating ON builds(rating);
CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_usage ON recipes(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_snippets_user ON knowledge_snippets(user_id);
```

- [ ] Executar no SQL Editor do Supabase
- [ ] Commit: `feat: adicionar tabelas builds, recipes, knowledge_snippets`

### Tarefa 2.2 — Atualizar tipos TypeScript

- [ ] Adicionar em `src/lib/types.ts`:

```typescript
export type Build = {
  id: string
  user_id: string
  site_id: string
  prompt: string
  page_url: string | null
  page_id: number | null
  elementor_json: unknown | null
  rating: number | null
  saved_as_recipe: string | null
  created_at: string
}

export type Recipe = {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string
  tags: string[]
  prompt_example: string | null
  elementor_json: unknown
  preview_url: string | null
  usage_count: number
  is_public: boolean
  created_from_build: string | null
  created_at: string
}

export type KnowledgeSnippet = {
  id: string
  user_id: string
  type: "widget" | "recipe" | "tip" | "pattern"
  name: string
  description: string | null
  content: unknown
  is_active: boolean
  created_at: string
}

export const RECIPE_CATEGORIES = [
  "político",
  "empresarial",
  "portfolio",
  "blog",
  "loja",
  "institucional",
  "landing-page",
  "geral",
] as const

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]
```

- [ ] Commit: `feat: tipos Build, Recipe, KnowledgeSnippet`

---

## Fase 3 — Builder Potente

### Objetivo
O builder agora: injeta conhecimento + receitas no prompt, salva cada build no histórico, extrai page_id e page_url do resultado.

### Tarefa 3.1 — Server Actions de builds

- [ ] Criar `src/lib/builds-actions.ts`:

```typescript
"use server"

import { createClient } from "./supabase-server"
import type { Build } from "./types"

export async function saveBuild(values: {
  site_id: string
  prompt: string
  page_url?: string
  page_id?: number
  elementor_json?: unknown
}): Promise<Build> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")

  const { data, error } = await supabase
    .from("builds")
    .insert({ ...values, user_id: user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function rateBuild(buildId: string, rating: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("builds")
    .update({ rating })
    .eq("id", buildId)

  if (error) throw new Error(error.message)
}

export async function getBuilds(siteId?: string): Promise<Build[]> {
  const supabase = await createClient()
  let query = supabase.from("builds").select("*").order("created_at", { ascending: false })
  if (siteId) query = query.eq("site_id", siteId)
  const { data, error } = await query.limit(50)
  if (error) throw new Error(error.message)
  return data
}
```

### Tarefa 3.2 — Melhorar o ai-builder.ts

- [ ] Modificar `src/lib/ai-builder.ts` — adicionar `getBuilderKnowledge` e `getTopRecipesForPrompt` ao system prompt:

```typescript
// No topo do arquivo, importar
import { getBuilderKnowledge, getTopRecipesForPrompt } from "./knowledge"

// Modificar runBuilder para receber o knowledge dinamicamente
export async function runBuilder(opts: {
  provider: string
  model: string
  apiKey: string
  wpUrl: string
  wpApiKey: string
  userMessage: string
  recipeContext?: string  // ← novo: receita base selecionada
  sendEvent: (e: BuilderEvent) => void
}): Promise<{ pageUrl?: string; pageId?: number; elementorJson?: unknown }> {
  const { provider, model, apiKey, wpUrl, wpApiKey, userMessage, recipeContext, sendEvent } = opts

  // Carrega knowledge dinâmico
  const knowledge = await getBuilderKnowledge()
  const topRecipes = await getTopRecipesForPrompt(5)

  const dynamicSystem = buildSystemPrompt(knowledge, topRecipes, recipeContext)

  let result: { pageUrl?: string; pageId?: number; elementorJson?: unknown } = {}

  if (provider === "claude") {
    result = await runClaudeLoop(apiKey, model, userMessage, wpUrl, wpApiKey, dynamicSystem, sendEvent)
  } else {
    result = await runOpenAILoop(provider, apiKey, model, userMessage, wpUrl, wpApiKey, dynamicSystem, sendEvent)
  }

  return result
}

function buildSystemPrompt(knowledge: string, topRecipes: string, recipeContext?: string): string {
  return `Você é um especialista em construção de sites WordPress com Elementor.
${recipeContext ? `\n## RECEITA BASE SELECIONADA PELO USUÁRIO:\n${recipeContext}\n\nAdapte esta receita às instruções do usuário.` : ""}
${topRecipes}

## KNOWLEDGE BASE COMPLETO DO ELEMENTOR:
${knowledge}

## FLUXO:
1. Chame wp_get_status para entender o site
2. Crie a página com wp_create_page (status: "publish")
3. Construa o layout com wp_elementor_set
4. Configure menus se necessário
5. Retorne o permalink ao usuário

## REGRAS:
- IDs hex de 8 chars únicos para cada elemento
- Construa a página COMPLETA em uma chamada wp_elementor_set
- Use containers aninhados para layouts em colunas
- Sempre informe o permalink ao final`
}
```

- [ ] Fazer os loops retornarem `{ pageUrl, pageId, elementorJson }` extraídos dos tool results
- [ ] Commit: `feat: builder dinâmico com knowledge + receitas injetadas`

### Tarefa 3.3 — Route handler salva build automaticamente

- [ ] Modificar `src/app/api/builder/route.ts` para salvar build ao concluir:

```typescript
// Após runBuilder, salvar no histórico
const result = await runBuilder({ ... })

if (result.pageUrl || result.pageId) {
  await saveBuild({
    site_id,
    prompt: message,
    page_url: result.pageUrl,
    page_id: result.pageId,
    elementor_json: result.elementorJson,
  }).catch(console.error) // não falha silenciosamente o build se o save falhar
}
```

- [ ] Commit: `feat: salvar builds automaticamente no histórico`

---

## Fase 4 — UI do Builder Aprimorada

### Objetivo
Adicionar ao builder: seletor de receita antes de enviar, rating após conclusão, botão "Salvar como receita".

### Tarefa 4.1 — Recipe Picker

- [ ] Criar `src/components/recipe-picker.tsx`:
  - Modal/drawer com lista de receitas do usuário
  - Filtro por categoria
  - Card mostrando nome, descrição, preview_url
  - Botão "Usar esta receita" → passa `elementor_json` como contexto

### Tarefa 4.2 — Build Rating

- [ ] Criar `src/components/build-rating.tsx`:
  - 5 estrelas clicáveis
  - Ao selecionar: chama `rateBuild(buildId, rating)`
  - Se ≥ 4 estrelas: exibe botão "Salvar como receita"

### Tarefa 4.3 — Atualizar builder-chat.tsx

- [ ] Adicionar botão "Receita base" antes do textarea
- [ ] Após `done`: mostrar `BuildRating`
- [ ] Passar `buildId` retornado pela API para o rating
- [ ] Commit: `feat: builder com recipe picker e rating`

---

## Fase 5 — Biblioteca de Receitas `/recipes`

### Objetivo
Página completa para gerenciar e navegar receitas.

### Tarefa 5.1 — Server Actions de receitas

- [ ] Criar `src/lib/recipes-actions.ts`:

```typescript
"use server"
import { createClient } from "./supabase-server"
import { revalidatePath } from "next/cache"
import type { Recipe } from "./types"

export async function getRecipes(category?: string): Promise<Recipe[]>
export async function getRecipe(id: string): Promise<Recipe | null>
export async function createRecipe(values: Partial<Recipe>): Promise<Recipe>
export async function updateRecipe(id: string, values: Partial<Recipe>): Promise<Recipe>
export async function deleteRecipe(id: string): Promise<void>
export async function incrementRecipeUsage(id: string): Promise<void>
export async function saveBuiltAsRecipe(buildId: string, values: { name: string; category: string; description: string }): Promise<Recipe>
```

### Tarefa 5.2 — Página /recipes

- [ ] Criar `src/app/recipes/page.tsx` (Server Component):
  - Grid de `RecipeCard`
  - Filtro por categoria (tab ou select)
  - Botão "Nova receita" → formulário

- [ ] Criar `src/components/recipe-card.tsx`:
  - Nome + categoria + badge
  - Descrição
  - Preview URL (imagem ou iframe)
  - Botões: "Usar no Builder" / "Editar" / "Excluir"

### Tarefa 5.3 — API route de receitas

- [ ] Criar `src/app/api/recipes/route.ts`:

```typescript
export async function GET(request: Request)   // listar
export async function POST(request: Request)  // criar
```

```typescript
// src/app/api/recipes/[id]/route.ts
export async function GET(request: Request, ctx: RouteContext<'/api/recipes/[id]'>)
export async function PATCH(request: Request, ctx: RouteContext<'/api/recipes/[id]'>)
export async function DELETE(request: Request, ctx: RouteContext<'/api/recipes/[id]'>)
```

- [ ] Commit: `feat: biblioteca de receitas completa`

---

## Fase 6 — Histórico de Builds `/history`

### Objetivo
Visualizar todos os builds com prompt, URL, rating e opção de reenviar.

### Tarefa 6.1 — Página /history

- [ ] Criar `src/app/history/page.tsx` (Server Component):
  - Lista de builds ordenada por data
  - Filtro por site
  - `BuildCard` para cada item

- [ ] Criar `src/components/build-card.tsx`:
  - Prompt truncado (expandível)
  - Site de origem
  - Data/hora
  - Rating (estrelas)
  - Link para a página criada
  - Botão "Usar prompt novamente" → redireciona para builder com o prompt preenchido
  - Botão "Salvar como receita" (se ainda não foi)

- [ ] Commit: `feat: histórico de builds`

---

## Fase 7 — Gerenciador de Conhecimento `/knowledge`

### Objetivo
Interface para visualizar a base de conhecimento e adicionar snippets customizados que enriquecem a IA.

### Tarefa 7.1 — Server Actions de snippets

- [ ] Criar `src/lib/knowledge-actions.ts`:

```typescript
"use server"
export async function getSnippets(): Promise<KnowledgeSnippet[]>
export async function createSnippet(values: Partial<KnowledgeSnippet>): Promise<KnowledgeSnippet>
export async function updateSnippet(id: string, values: Partial<KnowledgeSnippet>): Promise<KnowledgeSnippet>
export async function deleteSnippet(id: string): Promise<void>
export async function toggleSnippet(id: string, isActive: boolean): Promise<void>
```

### Tarefa 7.2 — Página /knowledge

- [ ] Criar `src/app/knowledge/page.tsx`:
  - **Seção 1:** Base Knowledge — accordion com todos os widgets do `base.json` (só leitura)
  - **Seção 2:** Snippets Customizados — lista com toggle ativo/inativo, editar, deletar
  - **Seção 3:** Adicionar snippet — formulário com tipo (widget/tip/recipe/pattern), nome, descrição, conteúdo JSON

- [ ] Criar `src/components/knowledge-snippet-editor.tsx`:
  - Formulário com campo JSON (textarea com syntax básico)
  - Preview do snippet antes de salvar
  - Tipos disponíveis com explicação:
    - `widget` = novo widget ou override de widget existente
    - `tip` = dica textual que vai no system prompt
    - `recipe` = template JSON reutilizável
    - `pattern` = padrão de layout descritivo

- [ ] Commit: `feat: gerenciador de conhecimento`

---

## Fase 8 — Loop de Treinamento

### Objetivo
Fechar o ciclo: builds bons viram receitas, receitas são injetadas nos próximos prompts, a IA fica mais precisa com o tempo.

### Tarefa 8.1 — Auto-sugestão de salvar como receita

- [ ] Após build com `rating >= 4`: popup automático perguntando se quer salvar como receita
- [ ] Formulário rápido: nome, categoria, descrição
- [ ] Salvar e atualizar `builds.saved_as_recipe`

### Tarefa 8.2 — Injeção de receitas top no system prompt (já planejado na Fase 3)

A função `getTopRecipesForPrompt()` já busca as 5 receitas com maior `usage_count`. A cada build que usa uma receita, incrementar `usage_count`.

- [ ] Na route `/api/builder`: quando receita for selecionada, chamar `incrementRecipeUsage(recipeId)`

### Tarefa 8.3 — Métricas no Dashboard

- [ ] Atualizar `src/app/page.tsx` para mostrar:
  - Total de builds realizados
  - Total de receitas salvas
  - Snippets ativos
  - Link rápido para `/recipes`, `/history`, `/knowledge`

- [ ] Commit: `feat: loop de treinamento e métricas no dashboard`

---

## Fase 9 — Navegação Global

### Tarefa 9.1 — Layout com navegação lateral/top

- [ ] Atualizar `src/app/layout.tsx` com navegação global:
  - Dashboard (sites)
  - Receitas
  - Histórico
  - Conhecimento

- [ ] Commit: `feat: navegação global`

---

## Estado Final do Sistema

```
COMANDO DO USUÁRIO
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Builder Chat                                    │
│  [Receita base: Político - Vereador ▼]           │
│  [Textarea: "Crie site para João Silva..."]      │
│  [Construir]                                     │
└────────────────────┬────────────────────────────┘
                     │ POST /api/builder
                     ▼
┌─────────────────────────────────────────────────┐
│  Route Handler SSE                               │
│                                                  │
│  1. Busca site + AI config (Supabase)            │
│  2. Carrega knowledge (base.json + snippets)     │
│  3. Carrega top 5 receitas aprovadas             │
│  4. Monta system prompt dinâmico                 │
│  5. Inicia loop agêntico (max 15 iter)           │
└────────────────────┬────────────────────────────┘
                     │ Tool Use (8 ferramentas)
                     ▼
┌─────────────────────────────────────────────────┐
│  Plugin WP AI Controller (WordPress do cliente)  │
│                                                  │
│  wp_get_status → wp_create_page                  │
│  → wp_elementor_set → wp_manage_menu             │
└────────────────────┬────────────────────────────┘
                     │ Streaming SSE
                     ▼
┌─────────────────────────────────────────────────┐
│  Build salvo no Supabase                         │
│  Rating ⭐⭐⭐⭐⭐ → Salvar como receita?        │
│  Receita salva → aparece nos próximos builds     │
└─────────────────────────────────────────────────┘
```

**O ciclo de treinamento:**
```
Build → Rating → Receita → Injetada no próximo prompt → Build melhor
```

---

## Ordem de Execução Recomendada

1. **Fase 1** (limpeza) — imediato, sem risco
2. **Fase 2** (banco) — executar SQL no Supabase
3. **Fase 3** (builder core) — base de tudo
4. **Fase 8** (loop de treinamento) — depende da Fase 3
5. **Fase 4** (UI do builder) — depende das Fases 3 e 8
6. **Fase 5** (receitas) — independente após Fase 2
7. **Fase 6** (histórico) — independente após Fase 2
8. **Fase 7** (conhecimento) — independente após Fase 1 e 2
9. **Fase 9** (navegação) — ao final de tudo

---

## Critérios de Conclusão

- [ ] Usuário consegue dar um comando e a IA constrói uma página real no WordPress
- [ ] Cada build é salvo automaticamente no histórico
- [ ] Builds podem ser avaliados (1-5 estrelas)
- [ ] Builds ≥ 4 estrelas podem ser salvos como receitas com 1 clique
- [ ] Próximos builds têm as receitas aprovadas injetadas automaticamente no prompt
- [ ] Usuário pode adicionar widgets e dicas customizadas ao knowledge
- [ ] Sistema fica mais inteligente a cada build aprovado
