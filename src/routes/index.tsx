import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Shield, UserCog, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { adminLogin } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar · Cinépolis Estoque" },
      { name: "description", content: "Acesse o sistema de controle de estoque Cinépolis." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "admin">("choose");
  const [matricula, setMatricula] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricula || !pass) {
      toast.error("Informe matrícula e senha");
      return;
    }
    setLoading(true);
    try {
      const u = await adminLogin(matricula, pass);
      toast.success(`Bem-vindo, ${u.nome}!`);
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err?.message || "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/40 to-accent/40">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-2xl overflow-hidden shadow-[var(--shadow-card)] bg-card border">
        {/* Lado esquerdo */}
        <div className="hidden lg:flex flex-col justify-between p-10 bg-sidebar text-white relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-primary-glow/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[var(--shadow-elegant)]">
                <Film className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold text-lg">Cinépolis</div>
                <div className="text-xs text-white/60">Controle de Estoque</div>
              </div>
            </div>
          </div>
          <div className="relative space-y-3">
            <h2 className="text-3xl font-bold leading-tight">
              Gestão completa do seu estoque, em um só lugar.
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Movimente produtos com leitura de código de barras, controle estoque mínimo e
              acompanhe cada entrada e saída em tempo real.
            </p>
          </div>
          <div className="relative text-xs text-white/50">
            © {new Date().getFullYear()} Cinépolis · Todos os direitos reservados
          </div>
        </div>

        {/* Lado direito */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          {mode === "choose" ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                    <Film className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="font-semibold">Cinépolis</span>
                </div>
                <h1 className="text-2xl font-bold">Bem-vindo</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione como deseja acessar o sistema
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => setMode("admin")}
                  className="group relative text-left rounded-xl border bg-card p-5 hover:border-primary hover:shadow-[var(--shadow-elegant)] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Login Admin</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Acesso total ao sistema. Requer usuário e senha.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate({ to: "/operador/entrada" })}
                  className="group relative text-left rounded-xl border bg-card p-5 hover:border-primary hover:shadow-[var(--shadow-elegant)] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-lg bg-accent text-accent-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition">
                      <UserCog className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Modo Operador</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Entrada e retirada de produtos. Matrícula e senha solicitados a cada movimentação.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-center text-muted-foreground">
                Ao entrar você concorda com as políticas internas de uso do sistema.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <div>
                <h1 className="text-2xl font-bold">Acesso administrativo</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Use suas credenciais de administrador.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">Matrícula</Label>
                <Input
                  id="user"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  placeholder="Sua matrícula"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">Senha</Label>
                <Input
                  id="pass"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Entrar
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
