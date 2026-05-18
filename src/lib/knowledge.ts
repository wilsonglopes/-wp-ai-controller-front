import fs from "fs"
import path from "path"
import { createClient } from "./supabase-server"

function readKnowledgeFile(filename: string): unknown {
  try {
    const filePath = path.join(process.cwd(), "knowledge", filename)
    return JSON.parse(fs.readFileSync(filePath, "utf-8"))
  } catch {
    return {}
  }
}

export async function getBuilderKnowledge(): Promise<string> {
  const base = readKnowledgeFile("base.json") as Record<string, unknown>
  const advanced = readKnowledgeFile("elementor-advanced.json") as Record<string, unknown>
  const political = readKnowledgeFile("political-recipe.json") as Record<string, unknown>

  let snippetWidgets: Record<string, unknown> = {}
  let snippetTips: string[] = []

  try {
    const supabase = await createClient()
    const { data: snippets } = await supabase
      .from("knowledge_snippets")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (snippets) {
      for (const s of snippets) {
        if (s.type === "widget") snippetWidgets[s.name] = s.content
        if (s.type === "tip") snippetTips.push(`• ${s.name}: ${s.description ?? JSON.stringify(s.content)}`)
      }
    }
  } catch { /* supabase indisponível — continua sem snippets */ }

  const merged = {
    ...base,
    widgets: {
      ...(base.widgets as Record<string, unknown> ?? {}),
      ...snippetWidgets,
    },
    container_advanced: advanced.container_advanced,
    typography_guide: advanced.typography_guide,
    animations: advanced.animations,
    font_awesome_icons: advanced.font_awesome_icons,
    special_widgets: advanced.special_widgets,
    color_palettes: advanced.color_palettes,
    responsive_guide: advanced.responsive_guide,
    political_campaign_template: (political as Record<string, unknown>).political_campaign_template,
  }

  let result = JSON.stringify(merged, null, 2)

  if (snippetTips.length > 0) {
    result += `\n\n--- DICAS CUSTOMIZADAS DO USUÁRIO ---\n${snippetTips.join("\n")}`
  }

  return result
}

export async function getTopRecipesContext(limit = 5): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: recipes } = await supabase
      .from("recipes")
      .select("name, description, category, prompt_example")
      .order("usage_count", { ascending: false })
      .limit(limit)

    if (!recipes || recipes.length === 0) return ""

    const lines = recipes.map(
      (r) =>
        `• [${r.category.toUpperCase()}] ${r.name}: ${r.description ?? ""}${r.prompt_example ? ` — Exemplo: "${r.prompt_example}"` : ""}`
    )

    return `\n\n## RECEITAS APROVADAS PELO USUÁRIO (use como referência de qualidade):\n${lines.join("\n")}`
  } catch {
    return ""
  }
}
