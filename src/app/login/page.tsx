"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { login, signup } from "@/lib/auth"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    const form = new FormData(e.currentTarget)

    if (isSignup) {
      const result = await signup(form)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        setMessage(result.success)
      }
    } else {
      const result = await login(form)
      if (result?.error) {
        toast.error(result.error)
      } else {
        router.push("/")
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">WP AI Controller</CardTitle>
          <CardDescription>
            {isSignup ? "Crie sua conta" : "Entre para gerenciar seus sites"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="voce@email.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {message && (
              <p className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{message}</p>
            )}
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-4">
            {isSignup ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button
              onClick={() => { setIsSignup(!isSignup); setMessage("") }}
              className="text-primary hover:underline font-medium"
            >
              {isSignup ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
