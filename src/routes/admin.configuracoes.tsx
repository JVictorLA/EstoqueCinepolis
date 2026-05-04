import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Cinépolis" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Preferências do sistema e da unidade" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Unidade">
          <Field label="Nome da unidade"><Input defaultValue="Cinépolis · Unidade Central" /></Field>
          <Field label="CNPJ"><Input placeholder="00.000.000/0000-00" /></Field>
        </Section>
        <Section title="Estoque">
          <ToggleRow label="Alertas de estoque baixo" hint="Notificar quando atingir estoque mínimo" defaultChecked />
          <ToggleRow label="Bloquear retirada sem estoque" hint="Não permitir retirada se estoque = 0" defaultChecked />
        </Section>
        <Section title="Notificações">
          <ToggleRow label="E-mail diário de movimentações" />
          <ToggleRow label="Resumo semanal de inventário" defaultChecked />
        </Section>
        <Section title="Segurança">
          <ToggleRow label="Exigir senha em toda movimentação" defaultChecked />
          <Button className="w-fit">Salvar alterações</Button>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)] space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function ToggleRow({ label, hint, defaultChecked }: { label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
