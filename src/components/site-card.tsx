"use client"

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Settings, Globe, ExternalLink } from "lucide-react"
import type { Site } from "@/lib/types"

export function SiteCard({ site }: { site: Site }) {
  const cleanUrl = site.wp_url.replace(/^https?:\/\//, "")

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{site.name}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <Globe className="w-3 h-3" />
              {cleanUrl}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Badge variant="outline">Conectado</Badge>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Link
          href={`/sites/${site.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="w-4 h-4" />
          Configurar
        </Link>
        <a
          href={site.wp_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Visitar
        </a>
      </CardFooter>
    </Card>
  )
}
