import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  Loader2,
  Lock,
  LockKeyhole,
  Moon,
  Shield,
  Sun,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme/ThemeProvider";
import { toast } from "sonner";
import {
  adminLogin,
  changeUserPassword,
  createInitialSetup,
  getPasswordChallenge,
  getSetupStatus,
  getUserByMatricula,
  type InitialSetupPayload,
} from "@/services/api";
import { passwordChallengeMessage, resolvePasswordStatus } from "@/lib/passwordChallenge";

import zyntraIcon from "@/icones/android-chrome-512x512.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar · Zytrex Inventory" },
      {
        name: "description",
        content: "Acesse o Zytrex Inventory para controlar estoque, lotes e movimentações.",
      },
    ],
  }),

  component: LoginPage,
});

function BrandLogo({ size = "sm" }: { size?: "sm" | "lg" }) {
  const large = size === "lg";

  return (
    <div className="flex items-center gap-3">
      <img
        src={zyntraIcon}
        alt=""
        className={large ? "h-14 w-14 object-contain sm:h-24 sm:w-24" : "h-9 w-9 object-contain"}
      />
      <div className="leading-none">
        <div
          className={
            large
              ? "text-3xl font-bold tracking-normal text-foreground sm:text-5xl"
              : "text-xl font-bold tracking-normal text-foreground"
          }
        >
          Zytrex
        </div>
        <div
          className={
            large
              ? "mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary sm:mt-2 sm:text-sm sm:tracking-[0.32em]"
              : "mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary"
          }
        >
          Inventory
        </div>
      </div>
    </div>
  );
}

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src={zyntraIcon}
      alt=""
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function ThemeSegmentedControl() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light" as const, label: "Claro", icon: Sun },
    { value: "dark" as const, label: "Escuro", icon: Moon },
  ];

  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-[var(--shadow-soft)]">
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition ${
              active
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-pressed={active}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
            {active && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

function AccessCard({
  icon: Icon,
  title,
  description,
  action,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: () => void;
  tone: "blue" | "purple";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-primary/10 text-primary ring-primary/15"
      : "bg-violet-500/10 text-violet-500 ring-violet-500/15";

  return (
    <button
      type="button"
      onClick={action}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-card)] sm:gap-4 sm:rounded-2xl sm:p-4"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-12 sm:w-12 sm:rounded-2xl ${toneClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 hidden text-sm leading-6 text-muted-foreground sm:block">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-0.5" />
    </button>
  );
}

const defaultSetupPayload: InitialSetupPayload & { master: InitialSetupPayload["master"] & { confirmarSenha: string } } = {
  empresa: {
    nome_empresa: "",
    unidade_empresa: "",
    cnpj_empresa: "",
    cidade_empresa: "",
    uf_empresa: "",
    endereco_empresa: "",
    telefone_empresa: "",
    email_empresa: "",
    logo_url: "",
  },
  sistema: {
    nome_sistema: "Zytrex Inventory",
    tema_padrao: "light",
    dias_alerta_validade: 7,
    permitir_estoque_negativo: false,
    bloquear_saida_produto_vencido: true,
    registrar_vencido_ao_tentar_retirar: true,
    permitir_ignorar_fefo: true,
    exigir_justificativa_fefo: true,
  },
  estoques: ["Estoque Principal", "Estoque VIP", "Estoque Limpeza"],
  master: {
    nome: "",
    matricula: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  },
};

function SetupWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [payload, setPayload] = useState(defaultSetupPayload);
  const [saving, setSaving] = useState(false);
  const steps = ["Boas-vindas", "Empresa", "Estoques", "Master", "Revisao"];

  const updateEmpresa = (key: keyof InitialSetupPayload["empresa"], value: string) =>
    setPayload((current) => ({ ...current, empresa: { ...current.empresa, [key]: value } }));


  const updateMaster = (key: keyof typeof payload.master, value: string) =>
    setPayload((current) => ({ ...current, master: { ...current.master, [key]: value } }));

  const validateStep = (target = step) => {
    if (target === 1 && !payload.empresa.nome_empresa.trim()) {
      toast.error("Informe o nome da empresa");
      return false;
    }
    if (target === 2) {
      const names = payload.estoques.map((item) => item.trim()).filter(Boolean);
      const unique = new Set(names.map((item) => item.toLowerCase()));
      if (!names.length) {
        toast.error("Informe pelo menos um estoque");
        return false;
      }
      if (names.length !== payload.estoques.length) {
        toast.error("Os nomes dos estoques não podem ficar vazios");
        return false;
      }
      if (unique.size !== names.length) {
        toast.error("Remova nomes de estoque duplicados");
        return false;
      }
    }
    if (target === 3) {
      if (!payload.master.nome.trim()) return toast.error("Informe o nome do master"), false;
      if (!payload.master.matricula.trim()) return toast.error("Informe a matrícula do master"), false;
      if (!payload.master.senha) return toast.error("Informe a senha do master"), false;
      if (!payload.master.confirmarSenha) return toast.error("Confirme a senha do master"), false;
      if (payload.master.senha.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return false;
      }
      if (payload.master.senha !== payload.master.confirmarSenha) {
        toast.error("As senhas não coincidem");
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const finish = async () => {
    for (const index of [1, 2, 3]) {
      if (!validateStep(index)) {
        setStep(index);
        return;
      }
    }

    setSaving(true);
    try {
      await createInitialSetup({
        empresa: payload.empresa,
        sistema: {
          ...payload.sistema,
          dias_alerta_validade: Number(payload.sistema.dias_alerta_validade),
        },
        estoques: payload.estoques.map((item) => item.trim()),
        master: {
          nome: payload.master.nome,
          matricula: payload.master.matricula,
          email: payload.master.email,
          senha: payload.master.senha,
        },
      });
      toast.success("Configuração inicial concluída. Faça login com o usuário master.");
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar configuração inicial");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <BrandLogo />
          <ThemeSegmentedControl />
        </header>

        <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] sm:rounded-3xl sm:p-7">
          <div className="mb-5 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-5">
            {steps.map((label, index) => (
              <div
                key={label}
                className={`rounded-lg border px-2 py-2 text-xs font-medium sm:rounded-xl sm:px-3 ${
                  index === step
                    ? "border-primary bg-primary/10 text-primary"
                    : index < step
                      ? "border-primary/25 bg-primary/5 text-foreground"
                      : "bg-background text-muted-foreground"
                }`}
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
                  {index < step ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="grid gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <BrandLogo size="lg" />
              <div className="space-y-4">
                <h1 className="text-2xl font-bold sm:text-3xl">Vamos configurar o Zytrex Inventory para sua empresa.</h1>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Este assistente cria os dados iniciais, estoques e o
                  usuario master para o primeiro acesso.
                </p>
                <Button className="zyntra-gradient border-0" onClick={next}>
                  Começar configuração
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <SetupGrid>
              <SetupField label="Nome da empresa" required>
                <Input value={payload.empresa.nome_empresa} onChange={(e) => updateEmpresa("nome_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="Unidade">
                <Input value={payload.empresa.unidade_empresa} onChange={(e) => updateEmpresa("unidade_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="CNPJ">
                <Input value={payload.empresa.cnpj_empresa} onChange={(e) => updateEmpresa("cnpj_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="Cidade">
                <Input value={payload.empresa.cidade_empresa} onChange={(e) => updateEmpresa("cidade_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="UF">
                <Input maxLength={2} value={payload.empresa.uf_empresa} onChange={(e) => updateEmpresa("uf_empresa", e.target.value.toUpperCase())} />
              </SetupField>
              <SetupField label="Endereço">
                <Input value={payload.empresa.endereco_empresa} onChange={(e) => updateEmpresa("endereco_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="Telefone">
                <Input value={payload.empresa.telefone_empresa} onChange={(e) => updateEmpresa("telefone_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="Email">
                <Input type="email" value={payload.empresa.email_empresa} onChange={(e) => updateEmpresa("email_empresa", e.target.value)} />
              </SetupField>
              <SetupField label="Logo URL">
                <Input value={payload.empresa.logo_url} onChange={(e) => updateEmpresa("logo_url", e.target.value)} />
              </SetupField>
            </SetupGrid>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {payload.estoques.map((nome, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={nome}
                    onChange={(e) =>
                      setPayload((current) => ({
                        ...current,
                        estoques: current.estoques.map((item, itemIndex) =>
                          itemIndex === index ? e.target.value : item,
                        ),
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setPayload((current) => ({
                        ...current,
                        estoques: current.estoques.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    disabled={payload.estoques.length === 1}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setPayload((current) => ({ ...current, estoques: [...current.estoques, ""] }))
                }
              >
                Adicionar estoque
              </Button>
            </div>
          )}

          {step === 3 && (
            <SetupGrid>
              <SetupField label="Nome" required>
                <Input value={payload.master.nome} onChange={(e) => updateMaster("nome", e.target.value)} />
              </SetupField>
              <SetupField label="Matrícula" required>
                <Input value={payload.master.matricula} onChange={(e) => updateMaster("matricula", e.target.value)} />
              </SetupField>
              <SetupField label="Email">
                <Input type="email" value={payload.master.email} onChange={(e) => updateMaster("email", e.target.value)} />
              </SetupField>
              <SetupField label="Senha" required>
                <Input type="password" value={payload.master.senha} onChange={(e) => updateMaster("senha", e.target.value)} />
              </SetupField>
              <SetupField label="Confirmar senha" required>
                <Input type="password" value={payload.master.confirmarSenha} onChange={(e) => updateMaster("confirmarSenha", e.target.value)} />
              </SetupField>
            </SetupGrid>
          )}

          {step === 4 && (
            <div className="grid gap-4 md:grid-cols-2">
              <ReviewBlock title="Empresa" items={[payload.empresa.nome_empresa, payload.empresa.unidade_empresa, [payload.empresa.cidade_empresa, payload.empresa.uf_empresa].filter(Boolean).join(" - ")]} />
              <ReviewBlock title="Estoques" items={payload.estoques} />
              <ReviewBlock title="Usuário master" items={[payload.master.nome, payload.master.matricula, payload.master.email || "Email não informado"]} />
            </div>
          )}

          {step > 0 && (
            <div className="mt-8 flex justify-between gap-3 border-t pt-5">
              <Button variant="outline" onClick={() => setStep((current) => Math.max(0, current - 1))}>
                Voltar
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={next}>Próximo</Button>
              ) : (
                <Button className="zyntra-gradient border-0" onClick={finish} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Finalizar configuração
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SetupGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>;
}

function SetupField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function ReviewBlock({ title, items }: { title: string; items: Array<string | undefined> }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {items.filter(Boolean).map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  const [mode, setMode] = useState<"choose" | "admin">("choose");

  const [matricula, setMatricula] = useState("");
  const [pass, setPass] = useState("");

  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<"first_access" | "expired">("first_access");
  const [currentPassword, setCurrentPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    getSetupStatus()
      .then((status) => setNeedsSetup(status.precisaSetup))
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Erro ao verificar setup inicial");
      })
      .finally(() => setSetupLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!matricula || !pass) {
      toast.error("Informe matrícula e senha");
      return;
    }

    setLoading(true);

    try {
      const response = await adminLogin(matricula, pass);
      setTheme(response.themePreference);

      toast.success(`Bem-vindo, ${response.nome}!`);
      navigate({ to: "/admin" });
    } catch (err: unknown) {
      const challenge = getPasswordChallenge(err);
      if (challenge) {
        setUserId(challenge.usuario.id);
        setCurrentPassword(pass);
        setPasswordStatus(challenge.password_status);
        setShowChangePassword(true);
        toast.warning(passwordChallengeMessage(challenge.password_status));
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "";
      if (/expir|primeiro acesso|troque a senha/i.test(errorMessage)) {
        try {
          const user = await getUserByMatricula(matricula);
          const resolvedStatus = resolvePasswordStatus(user);

          if (resolvedStatus === "expired" || resolvedStatus === "first_access") {
            setUserId(user.id);
            setCurrentPassword(pass);
            setPasswordStatus(resolvedStatus);
            setShowChangePassword(true);
            toast.warning(passwordChallengeMessage(resolvedStatus));
            return;
          }
        } catch {
          // deixa cair para o toast original
        }
      }
      toast.error(err instanceof Error ? err.message : "Erro na operação");
    } finally {
      setLoading(false);
    }
  };

  const changeFirstPassword = async () => {
    if (!userId) {
      toast.error("Usuário inválido");
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast.error("Preencha os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    try {
      await changeUserPassword(userId, currentPassword, newPassword);

      toast.success("Senha alterada com sucesso");
      toast.info("Faça login novamente");

      setShowChangePassword(false);
      setPass("");
      setMatricula("");
      setNewPassword("");
      setConfirmPassword("");
      setUserId(null);
      setCurrentPassword("");
      setPasswordStatus("first_access");
      setMode("admin");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro na operação");
    }
  };

  if (setupLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (needsSetup) {
    return <SetupWizard onDone={() => { setNeedsSetup(false); setMode("admin"); }} />;
  }

  const renderAdminLoginForm = (showBack: boolean) => (
    <form onSubmit={submit} className="space-y-5">
      {showBack && (
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="hidden items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground sm:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      )}

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acesso Administrativo</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Use suas credenciais para entrar no painel Zytrex Inventory.
          </p>
        </div>
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

      <Button
        type="submit"
        className="zyntra-gradient w-full border-0"
        disabled={loading}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );

  return (
    <>
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.11),transparent_28rem),radial-gradient(circle_at_88%_12%,rgba(139,92,246,0.1),transparent_28rem)] dark:bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.08),transparent_28rem),radial-gradient(circle_at_88%_12%,rgba(139,92,246,0.08),transparent_28rem)]" />

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-7">
          <BrandLogo />
          <ThemeSegmentedControl />
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-5 px-4 pb-8 sm:gap-10 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="mx-auto hidden w-full max-w-lg space-y-4 sm:block sm:space-y-8 lg:mx-0">
            <BrandLogo size="lg" />
            <p className="hidden max-w-md text-base leading-7 text-muted-foreground sm:block">
              Plataforma inteligente para controle de estoque, lotes, validade e movimentações.
            </p>
            <div className="hidden h-0.5 w-16 rounded-full bg-[linear-gradient(135deg,#22D3EE_0%,#4F7CFF_45%,#8B5CF6_100%)] sm:block" />
          </section>

          <section className="border-border/80 lg:border-l lg:pl-12">
            <div className="rounded-xl border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur sm:rounded-3xl sm:p-7">
              <div className="sm:hidden">
                {renderAdminLoginForm(false)}
              </div>

              <div className="hidden sm:block">
              {mode === "choose" ? (
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-foreground">Escolha o acesso</h1>
                      <p className="mt-1 hidden max-w-md text-sm leading-6 text-muted-foreground sm:block">
                        Entre no painel administrativo ou acesse o modo operacional para registros
                        rápidos.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <AccessCard
                      icon={Shield}
                      title="Acesso Administrativo"
                      description="Gerencie produtos, estoques, usuários, relatórios e inventários."
                      action={() => setMode("admin")}
                      tone="blue"
                    />
                    <AccessCard
                      icon={UserCog}
                      title="Modo Operacional"
                      description="Registre entradas, saídas, desperdícios e conferências com agilidade."
                      action={() => navigate({ to: "/operador" })}
                      tone="purple"
                    />
                  </div>

                  <p className="hidden items-center justify-center gap-2 pt-2 text-center text-xs text-muted-foreground sm:flex">
                    <Lock className="h-3.5 w-3.5" />
                    Sessão segura e trilha de movimentações.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <button
                    type="button"
                    onClick={() => setMode("choose")}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">Acesso Administrativo</h1>
                      <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                        Use suas credenciais para entrar no painel Zytrex Inventory.
                      </p>
                    </div>
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

                  <Button
                    type="submit"
                    className="zyntra-gradient w-full border-0"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-4">
              <BrandMark />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-foreground">
                  {passwordStatus === "expired" ? "Senha vencida" : "Primeiro acesso"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {passwordStatus === "expired"
                    ? "Sua senha venceu após 7 dias. Crie uma nova senha para continuar. A nova senha não pode ser igual à atual."
                    : "Você está utilizando a senha padrão do sistema. Crie uma nova senha para continuar. A nova senha não pode ser igual à atual."}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button className="zyntra-gradient w-full border-0" onClick={changeFirstPassword}>
              Salvar nova senha
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
