import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { createClient } from "@/lib/supabase-server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()

  // Se não estiver logado, redireciona para login (garantia dupla além do middleware)
  if (!data.session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Lê o arquivo estático do dashboard premium
  const filePath = path.join(process.cwd(), "public", "ai-copilot-dashboard.html")
  const html = fs.readFileSync(filePath, "utf8")

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}
