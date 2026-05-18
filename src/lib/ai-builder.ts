import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { callWpApi } from "./wp-client"
import { getBuilderKnowledge, getTopRecipesContext } from "./knowledge"

// ─── Tipos de eventos SSE ────────────────────────────────────────────────────

export type BuilderEvent =
  | { type: "thinking"; text: string }
  | { type: "tool_start"; tool: string; args: Record<string, unknown> }
  | { type: "tool_done"; tool: string; result: unknown }
  | { type: "tool_error"; tool: string; error: string }
  | { type: "message"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

export type BuilderResult = {
  pageUrl?: string
  pageId?: number
}

// ─── Definições de ferramentas ───────────────────────────────────────────────

const TOOL_DEFS = [
  {
    name: "wp_get_status",
    description:
      "Obtém status do WordPress e versão do Elementor. Chame para confirmar que o site está ativo antes de construir.",
    parameters: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "wp_create_page",
    description:
      "Cria nova página no WordPress. Retorna post_id (use no wp_elementor_set) e permalink. Use status 'publish' para publicar diretamente.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título da página" },
        content: { type: "string", description: "Conteúdo HTML (string vazia ao usar Elementor)" },
        status: { type: "string", enum: ["draft", "publish"], description: "Use 'publish'" },
        post_type: { type: "string", description: "'page' ou 'post'. Padrão: 'page'" },
      },
      required: ["title"] as string[],
    },
  },
  {
    name: "wp_list_pages",
    description: "Lista páginas existentes no WordPress",
    parameters: {
      type: "object",
      properties: {
        post_type: { type: "string" },
        limit: { type: "number" },
        post_status: { type: "string", enum: ["publish", "draft", "any"] },
      },
      required: [] as string[],
    },
  },
  {
    name: "wp_elementor_set",
    description:
      "Define toda a estrutura Elementor de uma página de uma vez. 'data' é o array de containers raiz. Esta é a ferramenta principal de construção — use-a com um JSON completo e bem estruturado.",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "number", description: "ID do post (retornado por wp_create_page)" },
        data: {
          type: "array",
          description: "Array de containers/elementos Elementor de nível raiz. Construa a página COMPLETA aqui.",
          items: { type: "object" },
        },
        page_settings: {
          type: "object",
          description: "Use {template: 'elementor_canvas'} para página sem header/footer do tema",
        },
      },
      required: ["post_id", "data"] as string[],
    },
  },
  {
    name: "wp_elementor_add_element",
    description: "Adiciona um elemento a uma página Elementor existente. Use para refinamentos após wp_elementor_set.",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "number" },
        element: { type: "object", description: "Elemento com id (8 hex), elType, settings, elements" },
        target_id: { type: "string", description: "ID do container pai. Omita para raiz." },
        position: { type: "number" },
      },
      required: ["post_id", "element"] as string[],
    },
  },
  {
    name: "wp_elementor_update_element",
    description: "Atualiza settings de um elemento existente",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "number" },
        element_id: { type: "string" },
        settings: { type: "object" },
        merge: { type: "boolean", description: "Merge com settings existentes (padrão: true)" },
      },
      required: ["post_id", "element_id", "settings"] as string[],
    },
  },
  {
    name: "wp_elementor_get",
    description: "Lê a estrutura Elementor atual de uma página",
    parameters: {
      type: "object",
      properties: { post_id: { type: "number" } },
      required: ["post_id"] as string[],
    },
  },
  {
    name: "wp_manage_menu",
    description: "Gerencia menus de navegação do WordPress",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "create", "add_items", "set_location"] },
        menu_name: { type: "string" },
        menu_id: { type: "number" },
        items: {
          type: "array",
          description: "Para add_items: [{type:'post_type', object:'page', object_id:123, title:'Home'}]",
          items: { type: "object" },
        },
        location: { type: "string", description: "Ex: primary, footer" },
      },
      required: ["action"] as string[],
    },
  },
  {
    name: "wp_set_option",
    description: "Define uma opção global do WordPress (wp_options)",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get", "set"] },
        option_name: { type: "string", description: "Nome da opção (ex: blogname, blogdescription)" },
        option_value: { type: "string", description: "Valor a definir (para action=set)" },
      },
      required: ["action", "option_name"] as string[],
    },
  },
]

// ─── Construtor do system prompt dinâmico ────────────────────────────────────

function buildSystemPrompt(knowledge: string, recipesCtx: string, recipeBase?: string): string {
  return `Você é o WP AI Builder — um agente especialista em construção de páginas WordPress com o Elementor.

Você recebe comandos em português e constrói páginas profissionais e completas usando a API REST do plugin WP AI Controller.
${recipeBase ? `\n## 🎯 RECEITA BASE SELECIONADA PELO USUÁRIO:\n${recipeBase}\n\nAdapte esta receita exatamente às instruções fornecidas pelo usuário.\n` : ""}${recipesCtx}

## FLUXO DE TRABALHO OBRIGATÓRIO:
1. Chame wp_get_status para verificar que o site está ativo
2. Crie a página com wp_create_page (status: "publish")
3. Construa o layout COMPLETO com wp_elementor_set em uma única chamada
4. Configure menu de navegação se solicitado (wp_manage_menu)
5. Informe o permalink da página ao usuário

## REGRAS ABSOLUTAS DE CONSTRUÇÃO:

### IDs dos elementos
- Cada elemento DEVE ter um "id" único de 8 caracteres hexadecimais
- Exemplos válidos: "a1b2c3d4", "ff123abc", "90e8d7c6"
- NUNCA repita o mesmo ID em uma página

### Estrutura obrigatória de cada elemento
Container:
{
  "id": "XXXXXXXX",
  "elType": "container",
  "settings": { ... },
  "elements": [ ... ]
}

Widget:
{
  "id": "XXXXXXXX",
  "elType": "widget",
  "widgetType": "NOME_DO_WIDGET",
  "settings": { ... },
  "elements": []
}

### Layouts em colunas (FUNDAMENTAL)
Para colocar dois blocos lado a lado:
- Container PAI: flex_direction="row", flex_wrap="wrap", gap={unit:"px",size:40}
- Containers FILHOS: width={unit:"%",size:50}
Para 3 colunas: filhos com width={unit:"%",size:30}

### Backgrounds com imagem e overlay (ESSENCIAL para heroes)
{
  "background_background": "classic",
  "background_image": {"url": "URL_AQUI", "id": 0},
  "background_size": "cover",
  "background_position": "center center",
  "background_overlay_background": "classic",
  "background_overlay_color": "rgba(0,0,0,0.65)"
}

### Botão WhatsApp (sempre incluir em sites políticos)
Use widget "html" com o SVG do WhatsApp — veja special_widgets.whatsapp_button no knowledge.

### Tipografia responsiva
Desktop: typography_font_size: {unit:"px", size:72}
Mobile:  typography_font_size_mobile: {unit:"px", size:36}

### Animações de entrada
Adicione nas settings de qualquer widget:
"animation": "fadeInUp", "animation_duration": "normal", "animation_delay": 200

## TEMPLATE DE CAMPANHA POLÍTICA
O knowledge.json contém political_campaign_template com estrutura completa.
Quando o usuário pedir site político, use esse template como base e substitua todos os placeholders [NOME], [CARGO], [COR_PRINCIPAL], etc.

## IMPORTANTE:
- Construa a página COMPLETA em uma única chamada wp_elementor_set
- Use page_settings: {template: "elementor_canvas"} para sites políticos (sem header/footer do tema)
- Adapte EXATAMENTE as cores solicitadas em TODOS os elementos, incluindo inline styles dos widgets HTML
- Para ícones FontAwesome, use o formato: {value:"fas fa-NOME", library:"fa-solid"} ou {value:"fab fa-NOME", library:"fa-brands"}
- Sempre finalize informando o permalink para o usuário visualizar o resultado

## KNOWLEDGE BASE COMPLETO:
${knowledge}`
}

// ─── Executor de ferramentas ─────────────────────────────────────────────────

function extractResult(tool: string, result: unknown): Partial<BuilderResult> {
  if (!result || typeof result !== "object") return {}
  const r = result as Record<string, unknown>
  if (tool === "wp_create_page") {
    return {
      pageUrl: r.permalink as string | undefined,
      pageId: r.post_id as number | undefined,
    }
  }
  return {}
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  wpUrl: string,
  wpApiKey: string
): Promise<unknown> {
  switch (name) {
    case "wp_get_status":
      return callWpApi(wpUrl, wpApiKey, "/status", "GET")
    case "wp_create_page":
      return callWpApi(wpUrl, wpApiKey, "/posts/create", "POST", args)
    case "wp_list_pages":
      return callWpApi(wpUrl, wpApiKey, "/posts/query", "POST", args)
    case "wp_elementor_set":
      return callWpApi(wpUrl, wpApiKey, "/elementor/set", "POST", args)
    case "wp_elementor_add_element":
      return callWpApi(wpUrl, wpApiKey, "/elementor/add-element", "POST", args)
    case "wp_elementor_update_element":
      return callWpApi(wpUrl, wpApiKey, "/elementor/update-element", "POST", args)
    case "wp_elementor_get":
      return callWpApi(wpUrl, wpApiKey, "/elementor/get", "POST", args)
    case "wp_manage_menu":
      return callWpApi(wpUrl, wpApiKey, "/menus/manage", "POST", args)
    case "wp_set_option":
      return callWpApi(wpUrl, wpApiKey, "/options", "POST", args)
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}

// ─── Loop agêntico — Claude ──────────────────────────────────────────────────

async function runClaudeLoop(
  apiKey: string,
  model: string,
  userMessage: string,
  wpUrl: string,
  wpApiKey: string,
  systemPrompt: string,
  sendEvent: (e: BuilderEvent) => void
): Promise<BuilderResult> {
  const client = new Anthropic({ apiKey })

  const claudeTools: Anthropic.Tool[] = TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }))

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }]
  const result: BuilderResult = {}
  const MAX_ITER = 20

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      tools: claudeTools,
      messages,
    })

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        sendEvent({ type: "thinking", text: block.text })
      }
    }

    if (response.stop_reason !== "tool_use") {
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim()
      if (finalText) sendEvent({ type: "message", text: finalText })
      break
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const tool of toolUses) {
      const args = tool.input as Record<string, unknown>
      sendEvent({ type: "tool_start", tool: tool.name, args })
      try {
        const res = await executeTool(tool.name, args, wpUrl, wpApiKey)
        sendEvent({ type: "tool_done", tool: tool.name, result: res })
        Object.assign(result, extractResult(tool.name, res))
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: JSON.stringify(res),
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : "Erro desconhecido"
        sendEvent({ type: "tool_error", tool: tool.name, error })
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: `Erro: ${error}`,
          is_error: true,
        })
      }
    }

    messages = [
      ...messages,
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    ]
  }

  return result
}

// ─── Loop agêntico — OpenAI / DeepSeek / Gemini ──────────────────────────────

function makeOpenAIClient(provider: string, apiKey: string): OpenAI {
  const baseURLs: Record<string, string> = {
    deepseek: "https://api.deepseek.com",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  }
  return new OpenAI({ apiKey, ...(baseURLs[provider] ? { baseURL: baseURLs[provider] } : {}) })
}

async function runOpenAILoop(
  provider: string,
  apiKey: string,
  model: string,
  userMessage: string,
  wpUrl: string,
  wpApiKey: string,
  systemPrompt: string,
  sendEvent: (e: BuilderEvent) => void
): Promise<BuilderResult> {
  const client = makeOpenAIClient(provider, apiKey)

  const tools: OpenAI.Chat.ChatCompletionTool[] = TOOL_DEFS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ]

  const result: BuilderResult = {}
  const MAX_ITER = 20

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 16000,
      tools,
      messages,
    })

    const choice = response.choices[0]

    if (choice.message.content?.trim()) {
      sendEvent({ type: "thinking", text: choice.message.content })
    }

    if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls?.length) {
      if (choice.message.content?.trim()) {
        sendEvent({ type: "message", text: choice.message.content })
      }
      break
    }

    messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

    for (const call of choice.message.tool_calls) {
      if (!("function" in call)) continue
      const fn = call as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall

      let args: Record<string, unknown> = {}
      try { args = JSON.parse(fn.function.arguments) } catch { /* args vazio */ }

      sendEvent({ type: "tool_start", tool: fn.function.name, args })
      try {
        const res = await executeTool(fn.function.name, args, wpUrl, wpApiKey)
        sendEvent({ type: "tool_done", tool: fn.function.name, result: res })
        Object.assign(result, extractResult(fn.function.name, res))
        messages.push({ role: "tool", tool_call_id: fn.id, content: JSON.stringify(res) })
      } catch (err) {
        const error = err instanceof Error ? err.message : "Erro desconhecido"
        sendEvent({ type: "tool_error", tool: fn.function.name, error })
        messages.push({ role: "tool", tool_call_id: fn.id, content: `Erro: ${error}` })
      }
    }
  }

  return result
}

// ─── Entrada pública ─────────────────────────────────────────────────────────

export async function runBuilder(opts: {
  provider: string
  model: string
  apiKey: string
  wpUrl: string
  wpApiKey: string
  userMessage: string
  recipeBase?: string
  sendEvent: (e: BuilderEvent) => void
}): Promise<BuilderResult> {
  const { provider, model, apiKey, wpUrl, wpApiKey, userMessage, recipeBase, sendEvent } = opts

  const [knowledge, recipesCtx] = await Promise.all([
    getBuilderKnowledge(),
    getTopRecipesContext(5),
  ])

  const systemPrompt = buildSystemPrompt(knowledge, recipesCtx, recipeBase)

  if (provider === "claude") {
    return runClaudeLoop(apiKey, model, userMessage, wpUrl, wpApiKey, systemPrompt, sendEvent)
  }
  return runOpenAILoop(provider, apiKey, model, userMessage, wpUrl, wpApiKey, systemPrompt, sendEvent)
}
