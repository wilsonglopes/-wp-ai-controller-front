import { getSites, getAiConfig } from "@/lib/actions"
import { logout } from "@/lib/auth"
import { SiteCard } from "@/components/site-card"
import { AddSiteDialog } from "@/components/add-site-dialog"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export default async function DashboardPage() {
  const sites = await getSites().catch(() => [])

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">WP AI Controller</h1>
            <p className="text-sm text-muted-foreground">Gerenciador de Sites com IA</p>
          </div>
          <div className="flex items-center gap-2">
            <AddSiteDialog />
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {sites.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-lg font-medium text-muted-foreground">
              Nenhum site cadastrado
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em &quot;Novo Site&quot; para começar
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
