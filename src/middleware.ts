import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import type { NextRequest } from "next/server"

export default async function middleware(request: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()

  // Se não estiver logado e não estiver na página de login, redireciona para /login
  if (!data.session && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Se estiver logado e tentar ir para /login, redireciona para / (dashboard)
  if (data.session && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
}
