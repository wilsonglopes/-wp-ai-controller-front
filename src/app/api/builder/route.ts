import { createClient } from "@/lib/supabase-server"
import { runBuilder, type BuilderEvent } from "@/lib/ai-builder"

export async function POST(request: Request) {
  const body = await request.json()
  const { site_id, message, recipe_base } = body as {
    site_id?: string
    message?: string
    recipe_base?: string
  }

  if (!site_id || !message?.trim()) {
    return Response.json({ error: "Campos obrigatórios: site_id, message" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 })
  }

  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", site_id)
    .single()

  if (!site) {
    return Response.json({ error: "Site não encontrado" }, { status: 404 })
  }

  const { data: aiConfig } = await supabase
    .from("ai_configs")
    .select("*")
    .eq("site_id", site_id)
    .single()

  if (!aiConfig) {
    return Response.json(
      { error: "IA não configurada. Configure um provedor na aba IA antes de usar o construtor." },
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BuilderEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        const result = await runBuilder({
          provider: aiConfig.provider,
          model: aiConfig.model,
          apiKey: aiConfig.api_key,
          wpUrl: site.wp_url,
          wpApiKey: site.api_key,
          userMessage: message,
          recipeBase: recipe_base,
          sendEvent: send,
        })

        // Salvar build no histórico silenciosamente
        if (result.pageUrl || result.pageId) {
          supabase.from("builds").insert({
            user_id: user.id,
            site_id,
            prompt: message,
            page_url: result.pageUrl ?? null,
            page_id: result.pageId ?? null,
          }).then(
            () => {},
            (err: unknown) => console.error("build save error:", err)
          )
        }

        send({ type: "done" })
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Erro desconhecido",
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
