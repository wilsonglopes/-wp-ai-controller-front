import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { callWpApi } from "./wp-client"

// ─── Tipos de eventos SSE ────────────────────────────────────────────────────

export type BuilderEvent =
  | { type: "thinking"; text: string }
  | { type: "tool_start"; tool: string; args: Record<string, unknown> }
  | { type: "tool_done"; tool: string; result: unknown }
  | { type: "tool_error"; tool: string; error: string }
  | { type: "message"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

// ─── Definições de ferramentas ───────────────────────────────────────────────

const TOOL_DEFS = [
  {
    name: "wp_get_status",
    description:
      "Obtém status do WordPress, versão do Elementor e knowledge base completo (widgets, recipes, schemas). SEMPRE chame como primeiro passo para entender o site.",
    parameters: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "wp_create_page",
    description:
      "Cria nova página no WordPress. Retorna post_id (necessário para wp_elementor_set) e permalink.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título da página" },
        content: { type: "string", description: "Conteúdo HTML (string vazia se usar Elementor)" },
        status: { type: "string", enum: ["draft", "publish"] },
        post_type: { type: "string", description: "Tipo: 'page' ou 'post'. Padrão: 'page'" },
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
        post_type: { type: "string", description: "'page' ou 'post'" },
        limit: { type: "number" },
        post_status: { type: "string", enum: ["publish", "draft", "any"] },
      },
      required: [] as string[],
    },
  },
  {
    name: "wp_elementor_set",
    description:
      "Define a estrutura Elementor completa de uma página de uma vez. 'data' é array de containers raiz. Use page_settings: {template: 'elementor_canvas'} para página sem header/footer.",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "number", description: "ID do post (retornado por wp_create_page)" },
        data: {
          type: "array",
          description: "Array de containers/elementos Elementor de nível raiz",
          items: { type: "object" },
        },
        page_settings: {
          type: "object",
          description: "Configurações: {template: 'elementor_canvas'} para sem header/footer",
        },
      },
      required: ["post_id", "data"] as string[],
    },
  },
  {
    name: "wp_elementor_add_element",
    description: "Adiciona um elemento (container ou widget) a uma página Elementor existente",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "number" },
        element: {
          type: "object",
          description: "Elemento com: id (8 hex chars), elType, settings, elements",
        },
        target_id: { type: "string", description: "ID do container pai. Omita para nível raiz." },
        position: { type: "number", description: "Posição no pai (0 = início)" },
      },
      required: ["post_id", "element"] as string[],
    },
  },
  {
    name: "wp_elementor_update_element",
    description: "Atualiza settings de um elemento Elementor existente",
    parameters: {
      type: "object",
      properties: {
        post_id: { type: "number" },
        element_id: { type: "string", description: "ID hex do elemento" },
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
        action: {
          type: "string",
          enum: ["list", "create", "add_items", "set_location"],
          description: "Ação a executar",
        },
        menu_name: { type: "string" },
        menu_id: { type: "number" },
        items: {
          type: "array",
          description:
            "Itens para add_items: [{type:'post_type', object:'page', object_id:123, title:'Home'}]",
          items: { type: "object" },
        },
        location: { type: "string", description: "Ex: primary, footer" },
      },
      required: ["action"] as string[],
    },
  },
]

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um especialista em construção de sites WordPress com Elementor para campanhas políticas e sites institucionais.

Você recebe instruções em português e constrói páginas profissionais usando a API REST do plugin WP AI Controller.

## FLUXO OBRIGATÓRIO:
1. Chame wp_get_status PRIMEIRO para entender o site e obter o knowledge base do Elementor
2. Crie a página com wp_create_page com status "publish" (guarde o post_id retornado)
3. Construa o layout completo com wp_elementor_set usando o post_id
4. Configure menu de navegação se solicitado (wp_manage_menu)
5. Informe ao usuário o permalink da página criada

## ESTRUTURA JSON DO ELEMENTOR:

O campo "data" do wp_elementor_set é um array de containers de nível raiz.

Container (layout flex):
{
  "id": "abc12345",
  "elType": "container",
  "settings": {
    "content_width": "boxed",
    "flex_direction": "column",
    "background_color": "#1a1a2e",
    "padding": {"unit":"px","top":"80","right":"20","bottom":"80","left":"20","isLinked":false},
    "min_height": {"unit":"vh","size":100}
  },
  "elements": [...]
}

Widget:
{
  "id": "def67890",
  "elType": "widget",
  "widgetType": "heading",
  "settings": { ... },
  "elements": []
}

## WIDGETS PRINCIPAIS:

heading:
  title, header_size ("h1"–"h6"), align ("left"/"center"/"right"),
  title_color, typography_font_size: {"unit":"px","size":60}, typography_font_weight: "700"

text-editor:
  editor: "<p>Texto HTML</p>"

image:
  image: {"url":"https://..."}, image_size: "full", align: "center"

button:
  text, link: {"url":"https://..."}, background_color, button_text_color,
  border_radius: {"unit":"px","top":"4","right":"4","bottom":"4","left":"4","isLinked":true}

spacer:
  space: {"unit":"px","size":50}

divider:
  color: {"color":"#cccccc"}, weight: {"unit":"px","size":1}

icon-box:
  icon: {"value":"fas fa-check","library":"fa-solid"}, title_text, description_text

## REGRAS DE IDs:
- Gere IDs hex de 8 caracteres ÚNICOS para cada elemento
- Exemplos válidos: "a1b2c3d4", "f9e8d7c6", "12345678"

## SITES POLÍTICOS — SEÇÕES RECOMENDADAS:
- Hero: foto do candidato + nome em destaque + slogan + botão de ação
- Sobre: trajetória e valores
- Propostas: ícones + texto para cada bandeira
- Conquistas/Realizações
- Galeria de fotos
- Contato / WhatsApp

## REGRAS:
- Construa a página COMPLETA em uma única chamada wp_elementor_set
- Use containers aninhados para layouts em colunas (flex_direction: "row" no pai)
- Adapte cores exatamente às instruções do usuário
- Se não tiver URL de imagem, use background_color como placeholder
- Sempre informe o permalink ao final para o usuário visualizar
- Consulte o knowledge base retornado por wp_get_status para widgets avançados`

// ─── Executor de ferramentas ─────────────────────────────────────────────────

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
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`)
  }
}

// ─── Loop agnético — Claude ──────────────────────────────────────────────────

async function runClaudeLoop(
  apiKey: string,
  model: string,
  userMessage: string,
  wpUrl: string,
  wpApiKey: string,
  sendEvent: (e: BuilderEvent) => void
) {
  const client = new Anthropic({ apiKey })

  const claudeTools: Anthropic.Tool[] = TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }))

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }]
  const MAX_ITER = 15

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
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
        .filter((b) => b.type === "text")
        .map((b) => (b as Anthropic.TextBlock).text)
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
        const result = await executeTool(tool.name, args, wpUrl, wpApiKey)
        sendEvent({ type: "tool_done", tool: tool.name, result })
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: JSON.stringify(result),
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
}

// ─── Loop agnético — OpenAI / DeepSeek / Gemini ──────────────────────────────

function getOpenAIClient(provider: string, apiKey: string): OpenAI {
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
  sendEvent: (e: BuilderEvent) => void
) {
  const client = getOpenAIClient(provider, apiKey)

  const tools: OpenAI.Chat.ChatCompletionTool[] = TOOL_DEFS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ]

  const MAX_ITER = 15

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.chat.completions.create({ model, max_tokens: 8096, tools, messages })
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
      const fnCall = call as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall

      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(fnCall.function.arguments)
      } catch { /* args vazio */ }

      sendEvent({ type: "tool_start", tool: fnCall.function.name, args })
      try {
        const result = await executeTool(fnCall.function.name, args, wpUrl, wpApiKey)
        sendEvent({ type: "tool_done", tool: fnCall.function.name, result })
        messages.push({ role: "tool", tool_call_id: fnCall.id, content: JSON.stringify(result) })
      } catch (err) {
        const error = err instanceof Error ? err.message : "Erro desconhecido"
        sendEvent({ type: "tool_error", tool: fnCall.function.name, error })
        messages.push({ role: "tool", tool_call_id: fnCall.id, content: `Erro: ${error}` })
      }
    }
  }
}

// ─── Entrada pública ─────────────────────────────────────────────────────────

export async function runBuilder(opts: {
  provider: string
  model: string
  apiKey: string
  wpUrl: string
  wpApiKey: string
  userMessage: string
  sendEvent: (e: BuilderEvent) => void
}) {
  const { provider, model, apiKey, wpUrl, wpApiKey, userMessage, sendEvent } = opts

  if (provider === "claude") {
    await runClaudeLoop(apiKey, model, userMessage, wpUrl, wpApiKey, sendEvent)
  } else {
    await runOpenAILoop(provider, apiKey, model, userMessage, wpUrl, wpApiKey, sendEvent)
  }
}
