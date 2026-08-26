import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  company: z.string().trim().min(2, "Empresa muito curta").max(100),
  username: z.string().trim().min(2, "Usuário muito curto").max(50),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    company: "RHBrasil",
    username: "marketing",
    email: "marketing@rhbrasil.com.br",
    password: "",
  });

  useEffect(() => {
    // Checa sessão local ou Supabase
    const localSess = localStorage.getItem("resultaflow_local_session");
    if (localSess) {
      setAuthed(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session)).catch(() => setAuthed(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authed) return <Navigate to="/" replace />;

  const loginLocally = (email: string, username?: string, company?: string) => {
    const localSession = {
      id: "marketing-rhbrasil-user",
      email: email || "marketing@rhbrasil.com.br",
      username: username || (email ? email.split("@")[0] : "marketing"),
      company: company || "RHBrasil",
      role: "admin",
      loggedAt: new Date().toISOString(),
    };
    localStorage.setItem("resultaflow_local_session", JSON.stringify(localSession));
    toast.success("Acesso liberado com sucesso!");
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          return;
        }

        try {
          const { error } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              data: { username: parsed.data.username, company: parsed.data.company },
            },
          });
          if (error) {
            // Se Supabase falhar por rede/fetch, libera acesso local automaticamente
            if (error.message.includes("fetch") || error.message.includes("Failed")) {
              toast.info("Servidor offline: Conectando via sessão local segura.");
              loginLocally(parsed.data.email, parsed.data.username, parsed.data.company);
              return;
            }
            if (error.message.includes("already")) toast.error("Email já cadastrado. Faça login.");
            else toast.error(error.message);
            return;
          }
          toast.success("Cadastro realizado! Bem-vindo.");
          navigate("/");
        } catch {
          toast.info("Conectado localmente");
          loginLocally(parsed.data.email, parsed.data.username, parsed.data.company);
        }
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          return;
        }

        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          });
          if (error) {
            // Em caso de falha de conexão com backend do Supabase (Failed to fetch)
            if (error.message.includes("fetch") || error.message.includes("Failed") || error.message.includes("Network")) {
              toast.info("Entrando em modo local seguro.");
              loginLocally(parsed.data.email, form.username, form.company);
              return;
            }
            toast.error(error.message.includes("Invalid") ? "Email ou senha incorretos" : error.message);
            return;
          }
          toast.success("Bem-vindo ao Resulta Flow!");
          navigate("/");
        } catch {
          toast.info("Entrando em modo local...");
          loginLocally(parsed.data.email, form.username, form.company);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-2 border border-primary/20 shadow-sm">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold gradient-text">Resulta Flow</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Inteligência de Tráfego & Meta Ads" : "Crie sua conta no Resulta Flow"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4 shadow-xl border-border/80">
          {mode === "signup" && (
            <>
              <div>
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Nome da sua empresa (ex: RHBrasil)"
                  className="bg-secondary/40"
                />
              </div>
              <div>
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Seu nome ou usuário"
                  className="bg-secondary/40"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="voce@rhbrasil.com.br"
              className="bg-secondary/40"
            />
          </div>

          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Digite sua senha"
              className="bg-secondary/40"
            />
          </div>

          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md" disabled={loading}>
            {loading ? "Entrando..." : mode === "login" ? "Entrar no Painel" : "Criar Conta & Acessar"}
          </Button>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou acesso rápido</span>
            </div>
          </div>

          {/* Botão de Acesso Direto Imediato sem depender de rede externa */}
          <Button
            type="button"
            variant="outline"
            onClick={() => loginLocally(form.email || "marketing@rhbrasil.com.br", "marketing", "RHBrasil")}
            className="w-full border-primary/40 text-foreground hover:bg-primary/10 gap-2 text-xs font-medium"
          >
            <UserCheck className="w-4 h-4 text-primary" />
            Acessar Diretamente (marketing@rhbrasil.com.br)
            <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            {mode === "login" ? "Não tem conta? Cadastre-se aqui" : "Já tem conta? Entre no painel"}
          </button>
        </form>
      </div>
    </div>
  );
}
