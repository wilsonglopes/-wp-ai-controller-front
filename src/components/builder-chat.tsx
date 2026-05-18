"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Zap,
  ChevronDown,
} from "lucide-react"
import type { BuilderEvent } from "@/lib/ai-builder"

type LogEntry = BuilderEvent & { id: number }

const TOOL_LABELS: Record<string, string> = {
  wp_get_status: "Verificando site e carregando knowledge base",
  wp_create_page: "Criando página",
  wp_list_pages: "Listando páginas existentes",
  wp_elementor_set: "Aplicando layout Elementor",
  wp_elementor_add_element: "Adicionando elemento",
  wp_elementor_update_element: "Atualizando elemento",
  wp_elementor_get: "Lendo estrutura da página",
  wp_manage_menu: "Configurando menu de navegação",
  wp_set_option: "Configurando opção do site",
}

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? name
}

function extractPageUrl(tool: string, result: unknown): string | null {
  if (tool !== "wp_create_page") return null
  if (result && typeof result === "object" && "permalink" in result) {
    return (result as Record<string, unknown>).permalink as string
  }
  return null
}

export function BuilderChat({ siteId }: { siteId: string }) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [pageUrl, setPageUrl] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)

  const addLog = (event: BuilderEvent) => {
    setLog((prev) => [...prev, { ...event, id: idRef.current++ }])
  }

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [log])

  async function handleSubmit() {
    if (!input.trim() || isLoading) return

    const message = input.trim()
    setInput("")
    setLog([])
    setPageUrl(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, message }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro de comunicação" }))
        addLog({ type: "error", message: err.error ?? "Erro ao iniciar construção" })
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6)) as BuilderEvent
            addLog(event)
            if (event.type === "tool_done") {
              const url = extractPageUrl(event.tool, event.result)
              if (url) setPageUrl(url)
            }
          } catch { /* ignora linhas malformadas */ }
        }
      }
    } catch (err) {
      addLog({
        type: "error",
        message: err instanceof Error ? err.message : "Erro de conexão",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const hasLog = log.length > 0

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Descreva o site que deseja construir...\n\nEx: Crie um site para o vereador João Silva, partido MDB, candidato em São Paulo. Cores azul escuro e dourado. Seções: hero com nome em destaque, propostas (educação, saúde, segurança), conquistas e botão de WhatsApp.`}
          className="min-h-[140px] resize-none font-sans text-sm"
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit()
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ctrl+Enter para enviar</span>
          <Button onClick={handleSubmit} disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isLoading ? "Construindo..." : "Construir"}
          </Button>
        </div>
      </div>

      {/* Log de ações */}
      {hasLog && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[440px] overflow-y-auto p-4 space-y-2 text-sm">
              {log.map((entry) => {
                if (entry.type === "thinking") {
                  return (
                    <p
                      key={entry.id}
                      className="text-muted-foreground italic border-l-2 border-muted pl-3 py-0.5 leading-relaxed"
                    >
                      {entry.text}
                    </p>
                  )
                }

                if (entry.type === "tool_start") {
                  return (
                    <div key={entry.id} className="flex items-center gap-2 text-blue-600">
                      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                      <span>{toolLabel(entry.tool)}</span>
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )
                }

                if (entry.type === "tool_done") {
                  return (
                    <div key={entry.id} className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{toolLabel(entry.tool)}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-green-100 text-green-700 border-0"
                      >
                        OK
                      </Badge>
                    </div>
                  )
                }

                if (entry.type === "tool_error") {
                  return (
                    <div key={entry.id} className="flex items-start gap-2 text-red-600">
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                        <span>{toolLabel(entry.tool)}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{entry.error}</p>
                      </div>
                    </div>
                  )
                }

                if (entry.type === "message") {
                  return (
                    <div
                      key={entry.id}
                      className="bg-muted/60 rounded-md px-3 py-2 leading-relaxed whitespace-pre-wrap"
                    >
                      {entry.text}
                    </div>
                  )
                }

                if (entry.type === "done") {
                  return (
                    <div key={entry.id} className="flex items-center gap-2 text-green-600 font-medium pt-1">
                      <Zap className="w-4 h-4" />
                      Concluído com sucesso!
                    </div>
                  )
                }

                if (entry.type === "error") {
                  return (
                    <div
                      key={entry.id}
                      className="bg-red-50 text-red-700 rounded-md px-3 py-2 border border-red-200"
                    >
                      <strong>Erro:</strong> {entry.message}
                    </div>
                  )
                }

                return null
              })}
              <div ref={logEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link da página criada */}
      {pageUrl && (
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <ExternalLink className="w-4 h-4" />
          Ver página: {pageUrl}
        </a>
      )}
    </div>
  )
}
