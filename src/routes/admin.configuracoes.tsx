import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  getStoredUser,
  getSystemConfigs,
  setStoredUser,
  updateMyPreferences,
  updateSystemConfigs,
} from "@/services/api";

type ConfigUpdate = Parameters<typeof updateSystemConfigs>[0][number];

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Zytrex Inventory" }] }),
  component: ConfigPage,
});

type SettingsState = {
  nomeEmpresa: string;
  unidadeEmpresa: string;
  cnpjEmpresa: string;
  temaPreferido: "light" | "dark";
  exigirSenhaMovimentacao: boolean;
  bloquearSaidaProdutoVencido: boolean;
  registrarVencidoAoTentarRetirar: boolean;
  permitirIgnorarFefo: boolean;
  exigirJustificativaFefo: boolean;
  modoManutencao: boolean;
};

const defaults: SettingsState = {
  nomeEmpresa: "",
  unidadeEmpresa: "Zytrex Inventory · Unidade Central",
  cnpjEmpresa: "",
  temaPreferido: "light",
  exigirSenhaMovimentacao: true,
  bloquearSaidaProdutoVencido: true,
  registrarVencidoAoTentarRetirar: true,
  permitirIgnorarFefo: true,
  exigirJustificativaFefo: true,
  modoManutencao: false,
};

function boolFromConfig(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  const normalized = value.toLowerCase();
  if (["true", "1", "sim", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function ConfigPage() {
  const { theme, setTheme } = useTheme();
  const user = getStoredUser();
  const isMaster = user?.tipo === "master";
  const [settings, setSettings] = useState<SettingsState>({
    ...defaults,
    temaPreferido: user?.themePreference ?? theme,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    getSystemConfigs()
      .then((configs) => {
        if (!active) return;
        const byKey = new Map(configs.map((item) => [item.chave, item.valor]));
        const next: SettingsState = {
          nomeEmpresa: byKey.get("nome_empresa") ?? defaults.nomeEmpresa,
          unidadeEmpresa: byKey.get("unidade_empresa") ?? defaults.unidadeEmpresa,
          cnpjEmpresa: byKey.get("cnpj_empresa") ?? defaults.cnpjEmpresa,
          temaPreferido: user?.themePreference === "dark" ? "dark" : "light",
          exigirSenhaMovimentacao: boolFromConfig(
            byKey.get("exigir_senha_movimentacao"),
            defaults.exigirSenhaMovimentacao,
          ),
          bloquearSaidaProdutoVencido: boolFromConfig(
            byKey.get("bloquear_saida_produto_vencido"),
            defaults.bloquearSaidaProdutoVencido,
          ),
          registrarVencidoAoTentarRetirar: boolFromConfig(
            byKey.get("registrar_vencido_ao_tentar_retirar"),
            defaults.registrarVencidoAoTentarRetirar,
          ),
          permitirIgnorarFefo: boolFromConfig(
            byKey.get("permitir_ignorar_fefo"),
            defaults.permitirIgnorarFefo,
          ),
          exigirJustificativaFefo: boolFromConfig(
            byKey.get("exigir_justificativa_fefo"),
            defaults.exigirJustificativaFefo,
          ),
          modoManutencao: boolFromConfig(byKey.get("modo_manutencao"), defaults.modoManutencao),
        };
        setSettings(next);
        setTheme(next.temaPreferido);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar configurações");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setTheme, user?.themePreference]);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "temaPreferido") setTheme(value as "light" | "dark");
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateMyPreferences({ themePreference: settings.temaPreferido });
      if (user) {
        setStoredUser({ ...user, themePreference: settings.temaPreferido });
      }

      const configs: ConfigUpdate[] = [
        {
          chave: "exigir_senha_movimentacao",
          valor: settings.exigirSenhaMovimentacao,
          categoria: "seguranca",
          nivelAcesso: "admin" as const,
        },
      ];

      if (isMaster) {
        configs.push(
          {
            chave: "nome_empresa",
            valor: settings.nomeEmpresa,
            categoria: "empresa",
            nivelAcesso: "master",
          },
          {
            chave: "unidade_empresa",
            valor: settings.unidadeEmpresa,
            categoria: "empresa",
            nivelAcesso: "master",
          },
          {
            chave: "cnpj_empresa",
            valor: settings.cnpjEmpresa,
            categoria: "empresa",
            nivelAcesso: "master",
          },
          {
            chave: "bloquear_saida_produto_vencido",
            valor: settings.bloquearSaidaProdutoVencido,
            categoria: "validade",
            nivelAcesso: "master",
          },
          {
            chave: "registrar_vencido_ao_tentar_retirar",
            valor: settings.registrarVencidoAoTentarRetirar,
            categoria: "desperdicio",
            nivelAcesso: "master",
          },
          {
            chave: "permitir_ignorar_fefo",
            valor: settings.permitirIgnorarFefo,
            categoria: "fefo",
            nivelAcesso: "master",
          },
          {
            chave: "exigir_justificativa_fefo",
            valor: settings.exigirJustificativaFefo,
            categoria: "fefo",
            nivelAcesso: "master",
          },
          {
            chave: "modo_manutencao",
            valor: settings.modoManutencao,
            categoria: "seguranca",
            nivelAcesso: "master",
          },
        );
      }

      await updateSystemConfigs(configs);
      toast.success("Configurações salvas com sucesso");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Preferências do sistema e da unidade"
        actions={
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Aparência" description="Escolha o tema visual da sua conta administrativa.">
          <RadioGroup
            value={settings.temaPreferido}
            onValueChange={(value) =>
              update("temaPreferido", value === "dark" ? "dark" : "light")
            }
          >
            <ThemeOption
              value="light"
              title="Claro"
              description="Melhor para ambientes administrativos e uso diurno"
              onSelect={() => update("temaPreferido", "light")}
            />
            <ThemeOption
              value="dark"
              title="Escuro"
              description="Melhor para baixa luminosidade e operação noturna"
              onSelect={() => update("temaPreferido", "dark")}
            />
          </RadioGroup>
        </Section>

        <Section title="Unidade">
          <Field label="Nome da unidade">
            <Input
              value={settings.unidadeEmpresa}
              onChange={(event) => update("unidadeEmpresa", event.target.value)}
              disabled={!isMaster}
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={settings.cnpjEmpresa}
              onChange={(event) => update("cnpjEmpresa", event.target.value)}
              placeholder="00.000.000/0000-00"
              disabled={!isMaster}
            />
          </Field>
          {!isMaster && (
            <p className="text-xs text-muted-foreground">
              Dados da unidade só podem ser alterados pelo usuário master.
            </p>
          )}
        </Section>

        <Section title="Estoque">
          <p className="text-sm leading-6 text-muted-foreground">
            Regras básicas de estoque, como bloqueio de retirada sem saldo e alertas de estoque
            baixo, permanecem ativas no sistema e não podem ser desligadas por aqui.
          </p>
        </Section>

        <Section title="Segurança">
          <ToggleRow
            label="Exigir senha em toda movimentação"
            checked={settings.exigirSenhaMovimentacao}
            onCheckedChange={(checked) => update("exigirSenhaMovimentacao", checked)}
          />
        </Section>

        {isMaster && (
          <Section
            title="Configurações avançadas"
            description="Opções reservadas para o usuário master."
          >
            <Field label="Nome da empresa">
              <Input
                value={settings.nomeEmpresa}
                onChange={(event) => update("nomeEmpresa", event.target.value)}
                placeholder="Nome exibido nos relatórios e cabeçalhos"
              />
            </Field>
            <ToggleRow
              label="Bloquear saída de produto vencido"
              hint="Impede movimentações de saída para lotes vencidos"
              checked={settings.bloquearSaidaProdutoVencido}
              onCheckedChange={(checked) => update("bloquearSaidaProdutoVencido", checked)}
            />
            <ToggleRow
              label="Registrar vencido como desperdício"
              hint="Ao tentar retirar lote vencido, bloqueia a saída e registra o lote inteiro como desperdício"
              checked={settings.registrarVencidoAoTentarRetirar}
              onCheckedChange={(checked) => update("registrarVencidoAoTentarRetirar", checked)}
            />
            <ToggleRow
              label="Permitir ignorar FEFO"
              hint="Permite retirar lote fora da ordem recomendada quando confirmado"
              checked={settings.permitirIgnorarFefo}
              onCheckedChange={(checked) => update("permitirIgnorarFefo", checked)}
            />
            <ToggleRow
              label="Exigir justificativa FEFO"
              hint="Solicita justificativa quando a ordem FEFO for ignorada"
              checked={settings.exigirJustificativaFefo}
              onCheckedChange={(checked) => update("exigirJustificativaFefo", checked)}
            />
            <ToggleRow
              label="Modo manutencao"
              hint="Reservado para operacoes assistidas"
              checked={settings.modoManutencao}
              onCheckedChange={(checked) => update("modoManutencao", checked)}
            />
          </Section>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ThemeOption({
  value,
  title,
  description,
  onSelect,
}: {
  value: "light" | "dark";
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <Label
      htmlFor={`theme-${value}`}
      onClick={onSelect}
      className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-4 transition hover:border-primary/35 hover:bg-muted/60"
    >
      <RadioGroupItem id={`theme-${value}`} value={value} className="mt-1" />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </Label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
