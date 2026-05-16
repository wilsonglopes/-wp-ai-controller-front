export type Site = {
  id: string
  name: string
  wp_url: string
  api_key: string
  created_at: string
}

export type AiConfig = {
  id: string
  site_id: string
  provider: "gemini" | "deepseek" | "openai" | "claude"
  api_key: string
  model: string
  created_at: string
}

export type Project = {
  id: string
  site_id: string
  title: string
  status: "draft" | "published"
  elementor_json: unknown | null
  created_at: string
}

export const AI_PROVIDERS = [
  { id: "gemini", label: "Gemini", models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"] },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"] },
  { id: "claude", label: "Claude", models: ["claude-sonnet-4-20250514", "claude-haiku-3.5"] },
] as const

export type AiProvider = (typeof AI_PROVIDERS)[number]["id"]
