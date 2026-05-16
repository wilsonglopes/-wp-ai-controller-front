"use server"

import { createClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import type { Site, AiConfig } from "@/lib/types"

export async function getSites(): Promise<Site[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("sites").select("*").order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function getSite(id: string): Promise<Site | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("sites").select("*").eq("id", id).single()
  if (error) return null
  return data
}

export async function createSite(values: { name: string; wp_url: string; api_key: string }) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("sites")
    .insert({ ...values, user_id: user.user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/")
  return data
}

export async function deleteSite(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sites").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/")
}

export async function getAiConfig(siteId: string): Promise<AiConfig | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ai_configs")
    .select("*")
    .eq("site_id", siteId)
    .single()
  if (error) return null
  return data
}

export async function saveAiConfig(values: {
  site_id: string
  provider: string
  api_key: string
  model: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ai_configs")
    .upsert(values, { onConflict: "site_id" })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(`/sites/${values.site_id}`)
  return data
}
