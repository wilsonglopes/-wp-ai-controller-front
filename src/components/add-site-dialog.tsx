"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"
import { createSite } from "@/lib/actions"

const ARGIMINAS_PRESET = {
  name: "Argiminas Local",
  wp_url: "http://127.0.0.1:8080/argiminas/",
  api_key: "V7ZIXRuPJC2h3ucs3lI2T0IlyDGGIQVebGFDGauuAQmHbPmH",
}

export function AddSiteDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [wpUrl, setWpUrl] = useState("")
  const [apiKey, setApiKey] = useState("")

  function fillArgiminas() {
    setName(ARGIMINAS_PRESET.name)
    setWpUrl(ARGIMINAS_PRESET.wp_url)
    setApiKey(ARGIMINAS_PRESET.api_key)
    toast.success("Dados do Argiminas Local preenchidos!")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      await createSite({ name, wp_url: wpUrl, api_key: apiKey })
      toast.success("Site adicionado!")
      setOpen(false)
      setName("")
      setWpUrl("")
      setApiKey("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar site")
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        <PlusCircle className="w-4 h-4" />
        Novo Site
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Site WordPress</DialogTitle>
          <DialogDescription>
            Conecte um site com o plugin WP AI Controller instalado
          </DialogDescription>
        </DialogHeader>

        {/* Quick-fill preset */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fillArgiminas}
          className="w-full border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors gap-2"
        >
          <Zap className="w-3.5 h-3.5" />
          Autopreencher Argiminas Local
        </Button>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do site</Label>
            <Input
              id="name"
              name="name"
              placeholder="Meu Site"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wp_url">URL do WordPress</Label>
            <Input
              id="wp_url"
              name="wp_url"
              placeholder="https://meusite.com.br"
              type="url"
              value={wpUrl}
              onChange={(e) => setWpUrl(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api_key">Chave API do Plugin</Label>
            <Input
              id="api_key"
              name="api_key"
              placeholder="Copie do WP Admin → AI Controller"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Encontre em: WordPress Admin → Configurações → AI Controller
            </p>
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? "Adicionando..." : "Adicionar Site"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
