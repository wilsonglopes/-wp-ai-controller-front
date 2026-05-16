import Link from "next/link"
import { getSite, getAiConfig } from "@/lib/actions"
import { SiteDetailTabs } from "@/components/site-detail-tabs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const site = await getSite(id)

  if (!site) notFound()

  const aiConfig = await getAiConfig(id)

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-lg font-semibold">{site.name}</h1>
            <p className="text-sm text-muted-foreground">
              {site.wp_url.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <SiteDetailTabs site={site} aiConfig={aiConfig} />
      </main>
    </div>
  )
}
