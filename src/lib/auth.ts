"use server"

import { createClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"

export async function login(formData: FormData): Promise<{ error: string } | void> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
}

export async function signup(formData: FormData): Promise<{ error: string } | { success: string }> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message }

  return { success: "Verifique seu email para confirmar o cadastro." }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function getSession() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}
