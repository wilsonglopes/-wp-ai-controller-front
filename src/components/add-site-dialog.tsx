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
import { PlusCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createSite } from "@/lib/actions"

export function AddSiteDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get("name") as string,
      wp_url: form.get("wp_url") as string,
      api_key: form.get("api_key") as string,
    }

    try {
      await createSite(data)
      toast.success("Site adicionado!")
      setOpen(false)
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
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do site</Label>
            <Input id="name" name="name" placeholder="Meu Site" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wp_url">URL do WordPress</Label>
            <Input
              id="wp_url"
              name="wp_url"
              placeholder="https://meusite.com.br"
              type="url"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api_key">Chave API do Plugin</Label>
            <Input
              id="api_key"
              name="api_key"
              placeholder="Copie do WP Admin → AI Controller"
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
