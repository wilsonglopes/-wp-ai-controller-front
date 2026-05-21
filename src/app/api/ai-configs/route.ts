import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

// GET /api/ai-configs?site_id=XYZ -> Obter config de IA de um site
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("site_id")

    if (!siteId) {
      return NextResponse.json({ error: "site_id é obrigatório" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("ai_configs")
      .select("*")
      .eq("site_id", siteId)
      .single()

    if (error && error.code !== "PGRST116") { // PGRST116 significa "nenhum resultado encontrado"
      throw error
    }

    return NextResponse.json(data || null)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/ai-configs -> Criar ou atualizar config de IA de um site
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { site_id, provider, api_key, model } = body

    if (!site_id || !provider || !model) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("ai_configs")
      .upsert({
        site_id,
        provider,
        api_key: api_key || "",
        model
      }, { onConflict: "site_id" })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
