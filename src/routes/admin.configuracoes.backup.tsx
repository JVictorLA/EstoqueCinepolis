import { createFileRoute, Link } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, HardDriveDownload, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BackupConfig,
  BackupRecord,
  createManualBackup,
  deleteBackup,
  downloadBackup,
  getBackups,
  getStoredUser,
  updateBackupConfig,
} from "@/services/api";

export const Route = createFileRoute("/admin/configuracoes/backup")({
  head: () => ({ meta: [{ title: "Backup · Zytrex Inventory" }] }),
  component: BackupPage,
});

const defaultConfig: BackupConfig = {
  backup_automatico_ativo: false,
  backup_horario: "02:00",
  backup_retencao_dias: 30,
  backup_pasta: "backups",
  backup_compactar: true,
  backup_ultimo_status: "",
  backup_ultimo_em: "",
  backup_notificar_falha: true,
};

function formatDate(value?: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value?: number | null) {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function statusVariant(status?: string): "default" | "secondary" | "destructive" {
  return status === "falha" ? "destructive" : status === "sucesso" ? "default" : "secondary";
}

function BackupPage() {
  const user = getStoredUser();
  const isMaster = user?.tipo === "master";
  const [config, setConfig] = useState<BackupConfig>(defaultConfig);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [latest, setLatest] = useState<BackupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const failedLatest = latest?.status === "falha";
  const sortedBackups = useMemo(() => backups, [backups]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getBackups();
      setConfig({ ...defaultConfig, ...data.config });
      setBackups(data.backups);
      setLatest(data.latest);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar backups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMaster) void load();
    else setLoading(false);
  }, [isMaster]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const updated = await updateBackupConfig(config);
      setConfig({ ...defaultConfig, ...updated });
      toast.success("Configuracoes de backup salvas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configuracoes");
    } finally {
      setSaving(false);
    }
  };

  const runBackup = async () => {
    setRunning(true);
    try {
      await createManualBackup();
      toast.success("Backup gerado com sucesso");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar backup");
      await load();
    } finally {
      setRunning(false);
    }
  };

  const download = async (backup: BackupRecord) => {
    setBusyId(backup.id);
    try {
      await downloadBackup(backup.id, backup.fileName);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar backup");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (backup: BackupRecord) => {
    const confirmed = window.confirm(`Excluir o backup ${backup.fileName}?`);
    if (!confirmed) return;

    setBusyId(backup.id);
    try {
      await deleteBackup(backup.id);
      toast.success("Backup excluido");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir backup");
    } finally {
      setBusyId(null);
    }
  };

  if (!isMaster) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-4 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold">Acesso restrito ao master</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Backups contem dados sensiveis e so podem ser acessados pelo usuario master.
        </p>
        <Button asChild className="mt-6">
          <Link to="/admin/configuracoes">Voltar para configuracoes</Link>
        </Button>
      </div>
    );
  }

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
        title="Backup"
        subtitle="Backups locais do banco de dados, historico e agendamento"
        actions={
          <Button onClick={runBackup} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <HardDriveDownload className="h-4 w-4" />
            )}
            Fazer backup agora
          </Button>
        }
      />

      {failedLatest && (
        <div className="mb-4 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          Ultimo backup falhou: {latest?.errorMessage || "verifique o historico para detalhes"}.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="font-semibold">Status do backup</h2>
            <p className="text-sm text-muted-foreground">Ultima execucao registrada no servidor.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Ultimo backup" value={formatDate(latest?.createdAt)} />
            <Info
              label="Status"
              value={
                latest ? (
                  <Badge variant={statusVariant(latest.status)}>{latest.status}</Badge>
                ) : (
                  <Badge variant="secondary">sem registro</Badge>
                )
              }
            />
            <Info label="Tipo" value={latest?.type || "-"} />
            <Info label="Tamanho" value={formatBytes(latest?.sizeBytes)} />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="font-semibold">Backup automatico</h2>
            <p className="text-sm text-muted-foreground">
              Agendamento diario executado pelo backend.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ToggleRow
              label="Ativar automatico"
              checked={config.backup_automatico_ativo}
              onCheckedChange={(checked) =>
                setConfig((current) => ({ ...current, backup_automatico_ativo: checked }))
              }
            />
            <ToggleRow
              label="Compactar .gz"
              checked={config.backup_compactar}
              onCheckedChange={(checked) =>
                setConfig((current) => ({ ...current, backup_compactar: checked }))
              }
            />
            <Field label="Horario">
              <Input
                type="time"
                value={config.backup_horario}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, backup_horario: event.target.value }))
                }
              />
            </Field>
            <Field label="Retencao em dias">
              <Input
                type="number"
                min={1}
                value={config.backup_retencao_dias}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    backup_retencao_dias: Number(event.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Pasta no servidor">
              <Input
                value={config.backup_pasta}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, backup_pasta: event.target.value }))
                }
              />
            </Field>
            <ToggleRow
              label="Alertar falha"
              checked={config.backup_notificar_falha}
              onCheckedChange={(checked) =>
                setConfig((current) => ({ ...current, backup_notificar_falha: checked }))
              }
            />
          </div>

          <Button onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuracoes
          </Button>
        </section>
      </div>

      <section className="mt-4 space-y-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="font-semibold">Historico de backups</h2>
          <p className="text-sm text-muted-foreground">Arquivos gerados e tentativas com falha.</p>
        </div>

        {sortedBackups.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBackups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>{formatDate(backup.createdAt)}</TableCell>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs">
                    {backup.fileName}
                    {backup.errorMessage && (
                      <div className="mt-1 truncate font-sans text-xs text-destructive">
                        {backup.errorMessage}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{backup.type}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(backup.status)}>{backup.status}</Badge>
                  </TableCell>
                  <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
                  <TableCell>{backup.createdByName || "-"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === backup.id || backup.status !== "sucesso"}
                        onClick={() => download(backup)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === backup.id}
                        onClick={() => remove(backup)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum backup registrado ainda.
          </div>
        )}
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
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
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
