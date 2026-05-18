"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Globe, Key, Plug, Zap, Copy, Loader2, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { deleteSite, saveAiConfig } from "@/lib/actions"
import { useRouter } from "next/navigation"
import { AI_PROVIDERS } from "@/lib/types"
import type { Site, AiConfig } from "@/lib/types"
import { BuilderChat } from "@/components/builder-chat"

export function SiteDetailTabs({
  site,
  aiConfig,
}: {
  site: Site
  aiConfig: AiConfig | null
}) {
  const router = useRouter()
  const [provider, setProvider] = useState(aiConfig?.provider || "")
  const [aiKey, setAiKey] = useState(aiConfig?.api_key || "")
  const [model, setModel] = useState(aiConfig?.model || "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSaveAiConfig() {
    if (!provider || !aiKey || !model) {
      toast.error("Preencha todos os campos")
      return
    }
    setSaving(true)
    try {
      await saveAiConfig({ site_id: site.id, provider, api_key: aiKey, model })
      toast.success("Configuração salva!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm("Tem certeza? Esta ação não pode ser desfeita.")) return
    setDeleting(true)
    try {
      await deleteSite(site.id)
      toast.success("Site removido")
      router.push("/")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover")
    }
    setDeleting(false)
  }

  function copyKey() {
    navigator.clipboard.writeText(site.api_key)
    toast.success("Chave copiada!")
  }

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === provider)

  return (
    <Tabs defaultValue="info" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="info">Informações</TabsTrigger>
        <TabsTrigger value="ai">IA</TabsTrigger>
        <TabsTrigger value="builder">Construtor</TabsTrigger>
      </TabsList>

      <TabsContent value="info" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="w-5 h-5 text-green-500" />
              Conexão WordPress
            </CardTitle>
            <CardDescription>
              Dados de conexão com o plugin WP AI Controller
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                URL
              </div>
              <a
                href={site.wp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {site.wp_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Key className="w-4 h-4 text-muted-foreground" />
                Chave API
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm bg-muted px-2 py-0.5 rounded">••••••••</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyKey}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Plug className="w-4 h-4 text-muted-foreground" />
                Status
              </div>
              <Badge className="bg-green-500/10 text-green-600 border-green-200">
                Conectado
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover Site
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="ai" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Provedor de IA</CardTitle>
            <CardDescription>
              Escolha qual IA vai operar o construtor de páginas deste site
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Provedor</Label>
              <Select value={provider} onValueChange={(v) => { setProvider(v || ""); setModel("") }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProvider && (
              <div className="grid gap-2">
                <Label>Modelo</Label>
                <Select value={model} onValueChange={(v) => setModel(v || "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider.models.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="ai-key">Chave API do Provedor</Label>
              <Input
                id="ai-key"
                type="password"
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder="sk-..."
              />
            </div>

            <Button onClick={handleSaveAiConfig} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Configuração
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="builder" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Construtor IA</CardTitle>
            <CardDescription>
              Descreva o site que deseja construir e a IA operará o Elementor automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!aiConfig ? (
              <p className="text-sm text-muted-foreground">
                Configure um provedor de IA na aba <strong>IA</strong> antes de usar o construtor.
              </p>
            ) : (
              <BuilderChat siteId={site.id} />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
