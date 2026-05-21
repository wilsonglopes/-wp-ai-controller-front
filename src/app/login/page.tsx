"use client"

import { useRouter } from "next/navigation"
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
    <>
      {/* Premium Fonts and Custom Style Tokens */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&family=Inter:wght@300;400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap');

        :root {
          --bg-main: #0a0b0e;
          --bg-card: rgba(16, 18, 22, 0.75);
          --border-color: rgba(255, 255, 255, 0.08);
          --color-brand: #cc0000;
          --color-terracotta: #c4621a;
          --color-text-muted: #8a99ad;
          --font-ui: 'Outfit', sans-serif;
          --font-body: 'Inter', sans-serif;
        }

        .premium-bg {
          background-color: var(--bg-main);
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(204, 0, 0, 0.08) 0%, transparent 45%),
            radial-gradient(circle at 90% 80%, rgba(196, 98, 26, 0.06) 0%, transparent 45%);
          font-family: var(--font-body);
        }

        .premium-glass-card {
          background: var(--bg-card);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-color);
          box-shadow: 
            0 24px 50px rgba(0, 0, 0, 0.6), 
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-glass-card:hover {
          border-color: rgba(196, 98, 26, 0.25);
          box-shadow: 
            0 32px 64px rgba(0, 0, 0, 0.7), 
            0 0 30px rgba(196, 98, 26, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .premium-logo-icon {
          background: linear-gradient(135deg, var(--color-brand) 0%, var(--color-terracotta) 100%);
          box-shadow: 0 4px 20px rgba(204, 0, 0, 0.25);
        }

        .premium-label {
          font-family: var(--font-ui);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--color-text-muted);
        }

        .premium-input {
          background: rgba(10, 11, 14, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #ffffff;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-input:focus {
          border-color: var(--color-brand);
          background: rgba(8, 9, 12, 0.85);
          outline: none;
          box-shadow: 0 0 14px rgba(204, 0, 0, 0.2);
        }

        .premium-button {
          background: linear-gradient(135deg, var(--color-terracotta) 0%, var(--color-brand) 100%);
          font-family: var(--font-ui);
          box-shadow: 0 6px 20px rgba(204, 0, 0, 0.2);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(204, 0, 0, 0.35);
          filter: brightness(1.1);
        }

        .premium-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .premium-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* Subtle glowing grid */
        .cyber-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.007) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.007) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
          z-index: 0;
        }
      `}} />

      <div className="premium-bg min-h-screen w-screen flex items-center justify-center relative overflow-hidden px-4">
        {/* Cyber Grid Background */}
        <div className="cyber-grid" />

        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-800/10 rounded-full blur-[120px] pointer-events-none z-0" />

        <div className="premium-glass-card w-full max-w-[440px] rounded-2xl p-8 md:p-10 relative z-10">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="premium-logo-icon w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform hover:rotate-6 duration-300">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="w-7 h-7 text-white"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-white text-2xl md:text-3xl font-extrabold font-[Outfit] tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              WP AI Co-pilot
            </h1>
            <p className="text-[#8a99ad] text-sm mt-2 font-medium font-[Outfit] tracking-wide">
              {isSignup ? "Criar conta de Administrador" : "Portal de Controle & Inteligência"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="premium-label mb-2 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="nome@exemplo.com"
                required
                className="premium-input w-full rounded-lg px-4 py-3 text-sm font-medium focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="premium-label mb-2 block">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                className="premium-input w-full rounded-lg px-4 py-3 text-sm font-medium focus:outline-none"
              />
            </div>

            {message && (
              <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-sm font-medium leading-relaxed">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="premium-button w-full text-white py-3.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              {isSignup ? "Criar Conta Premium" : "Entrar no Sistema"}
            </button>
          </form>

          {/* Footer toggle */}
          <div className="mt-8 text-center border-t border-white/[0.04] pt-6">
            <p className="text-xs text-[#8a99ad] font-medium">
              {isSignup ? "Já possui uma licença?" : "Ainda não tem conta?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup)
                  setMessage("")
                }}
                className="text-white hover:text-[#c4621a] font-semibold underline transition-colors cursor-pointer ml-1"
              >
                {isSignup ? "Fazer Login" : "Criar uma conta"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

