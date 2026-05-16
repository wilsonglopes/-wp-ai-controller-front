import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import type { NextRequest } from "next/server"

export default async function proxy(request: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()

  if (!data.session && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (data.session && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api).*)"],
}
