import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Loader2,
  PackageCheck,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  changeUserPassword,
  getOperationalKit,
  getOperationalKits,
  getPasswordChallenge,
  getUserByMatricula,
  receiveKit,
  withdrawKit,
} from "@/services/api";
import type { Estoque, Kit, KitStatus } from "@/types";

function hasMaintenanceBlock(data: unknown) {
  return (
    !!data && typeof data === "object" && (data as Record<string, unknown>).modo_manutencao === true
  );
}

export const Route = createFileRoute("/operador/kits")({
  head: () => ({ meta: [{ title: "Retirada de Kit · Zytrex Inventory" }] }),
  component: OperatorKitsPage,
});

type ActionType = "retirar" | "receber";

const statusLabels: Record<KitStatus, string> = {
  pronto_para_retirada: "Pronto para retirada",
  em_uso: "Em uso",
  aguardando_recebimento: "Em uso",
  kit_incompleto: "Kit incompleto",
};

function statusVariant(status: KitStatus) {
  if (status === "pronto_para_retirada") return "default";
  if (status === "kit_incompleto") return "destructive";
  return "secondary";
}

function statusStyle(status: KitStatus) {
  if (status === "pronto_para_retirada") {
    return {
      border: "border-l-primary",
      icon: "bg-primary/10 text-primary",
      badge: "bg-primary/10 text-primary border-primary/20",
    };
  }
  if (status === "kit_incompleto") {
    return {
      border: "border-l-destructive",
      icon: "bg-destructive/10 text-destructive",
      badge: "bg-destructive/10 text-destructive border-destructive/20",
    };
  }
  return {
    border: "border-l-amber-500",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  };
}

function statusIcon(status: KitStatus) {
  if (status === "pronto_para_retirada") return CheckCircle2;
  if (status === "kit_incompleto") return AlertTriangle;
  return UserCheck;
}

function getStoredOperatorStock(): Estoque | null {
  const raw = localStorage.getItem("cinepolis.estoque");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Estoque;
  } catch {
    return null;
  }
}

function OperatorKitsPage() {
  const navigate = useNavigate();
  const [estoque, setEstoque] = useState<Estoque | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionType | null>(null);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);

  const loadKits = async (stock: Estoque) => {
    setLoading(true);
    try {
      const rows = await getOperationalKits(stock.id);
      setKits(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar kits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const stored = getStoredOperatorStock();
    if (!stored?.id) {
      navigate({ to: "/operador" });
      return;
    }
    setEstoque(stored);
    loadKits(stored);
  }, [navigate]);

  const openAction = async (kit: Kit, type: ActionType) => {
    if (!estoque) return;
    setAction(type);
    setSelectedKit(kit);
    if (type === "receber") {
      try {
        const detailed = await getOperationalKit(kit.id, estoque.id);
        setSelectedKit(detailed);
      } catch (error) {
        setAction(null);
        setSelectedKit(null);
        toast.error(error instanceof Error ? error.message : "Erro ao abrir kit");
      }
    }
  };

  const handleDone = () => {
    setAction(null);
    setSelectedKit(null);
    if (estoque) loadKits(estoque);
  };

  const readyCount = kits.filter((kit) => kit.status === "pronto_para_retirada").length;
  const inUseCount = kits.filter(
    (kit) => kit.status === "em_uso" || kit.status === "aguardando_recebimento",
  ).length;
  const incompleteCount = kits.filter((kit) => kit.status === "kit_incompleto").length;

  return (
    <>
      <PageHeader
        title="Retirada de Kit"
        subtitle={estoque ? `Kits disponiveis no estoque ${estoque.nome}` : "Estoque selecionado"}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => estoque && loadKits(estoque)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <StatusSummaryCard
          icon={CheckCircle2}
          label="Prontos para retirada"
          value={readyCount}
          className="border-primary/20 bg-primary/5 text-primary"
        />
        <StatusSummaryCard
          icon={UserCheck}
          label="Em uso"
          value={inUseCount}
          className="border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300"
        />
        <StatusSummaryCard
          icon={AlertTriangle}
          label="Incompletos"
          value={incompleteCount}
          className="border-destructive/20 bg-destructive/5 text-destructive"
        />
      </div>

      <div className="rounded-lg border bg-card/80 p-3 shadow-[var(--shadow-soft)] sm:rounded-2xl">
        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : kits.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum kit neste estoque"
            description="Os kits criados para o estoque selecionado aparecerão aqui."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {kits.map((kit) => (
              <KitOperationCard key={kit.id} kit={kit} onAction={openAction} />
            ))}
          </div>
        )}
      </div>

      <OperatorKitActionDialog
        action={action}
        kit={selectedKit}
        onClose={() => {
          setAction(null);
          setSelectedKit(null);
        }}
        onDone={handleDone}
      />
    </>
  );
}

function StatusSummaryCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Boxes;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 shadow-[var(--shadow-soft)] sm:rounded-xl sm:p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 line-clamp-1 text-xs font-medium text-foreground sm:text-sm">
            {label}
          </div>
        </div>
        <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-background/80 sm:flex">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function KitOperationCard({
  kit,
  onAction,
}: {
  kit: Kit;
  onAction: (kit: Kit, type: ActionType) => void;
}) {
  const style = statusStyle(kit.status);
  const Icon = statusIcon(kit.status);
  const isReady = kit.status === "pronto_para_retirada";
  const isInUse = kit.status === "em_uso" || kit.status === "aguardando_recebimento";

  return (
    <article
      className={`flex min-h-44 flex-col rounded-lg border border-l-4 ${style.border} bg-background p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] sm:min-h-52 sm:rounded-xl sm:p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant={statusVariant(kit.status)} className={`border ${style.badge}`}>
          {statusLabels[kit.status]}
        </Badge>
      </div>

      <div className="mt-4 min-w-0 flex-1">
        <h3 className="truncate text-lg font-semibold">{kit.name}</h3>
        <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            Responsavel atual
          </div>
          <div className="mt-1 font-medium">{kit.responsibleName ?? "Sem responsavel em uso"}</div>
        </div>
      </div>

      <div className="mt-4">
        {isReady && (
          <Button className="h-11 w-full gap-2" onClick={() => onAction(kit, "retirar")}>
            <UserCheck className="h-4 w-4" />
            Retirar Kit
          </Button>
        )}
        {isInUse && (
          <Button className="h-11 w-full gap-2" onClick={() => onAction(kit, "receber")}>
            <RotateCcw className="h-4 w-4" />
            Voltar Kit
          </Button>
        )}
        {kit.status === "kit_incompleto" && (
          <Button className="h-11 w-full" variant="outline" disabled>
            Kit incompleto
          </Button>
        )}
      </div>
    </article>
  );
}

function OperatorKitActionDialog({
  action,
  kit,
  onClose,
  onDone,
}: {
  action: ActionType | null;
  kit: Kit | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [note, setNote] = useState("");
  const [received, setReceived] = useState<Record<number, string>>({});
  const [operationReplenishment, setOperationReplenishment] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<"first_access" | "expired">("first_access");
  const [challengeUserId, setChallengeUserId] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const open = !!action && !!kit;

  useEffect(() => {
    if (!kit || action !== "receber") return;
    const nextReceived: Record<number, string> = {};
    const nextReplenishment: Record<number, string> = {};
    kit.items?.forEach((item) => {
      nextReceived[item.productId] = String(item.currentQuantity);
      nextReplenishment[item.productId] = "0";
    });
    setReceived(nextReceived);
    setOperationReplenishment(nextReplenishment);
  }, [kit, action]);

  useEffect(() => {
    if (open) return;
    setMatricula("");
    setSenha("");
    setNote("");
    setReceived({});
    setOperationReplenishment({});
    setChangePasswordOpen(false);
    setPasswordStatus("first_access");
    setChallengeUserId(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [open]);

  const submit = async () => {
    if (!kit || !action) return;
    setLoading(true);
    try {
      if (action === "retirar") {
        await withdrawKit(kit.id, { matricula, senha, observacao: note });
        toast.success("Kit retirado");
      } else {
        await receiveKit(kit.id, {
          matricula,
          senha,
          observacao: note,
          itens:
            kit.items?.map((item) => ({
              produto_id: item.productId,
              quantidade_atual: Number(received[item.productId] ?? 0),
              reposicao_operacao: Number(operationReplenishment[item.productId] ?? 0),
            })) ?? [],
        });
        toast.success("Kit recebido");
      }
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && hasMaintenanceBlock(error.data)) {
        toast.warning(error.message);
        onClose();
        return;
      }
      const challenge = getPasswordChallenge(error);
      if (challenge) {
        setChallengeUserId(challenge.usuario.id);
        setCurrentPassword(senha);
        setPasswordStatus(challenge.password_status);
        setChangePasswordOpen(true);
        toast.warning(
          challenge.password_status === "expired"
            ? "Sua senha venceu. Troque-a para continuar."
            : "Primeiro acesso detectado. Crie uma nova senha.",
        );
        return;
      }
      const errorMessage = error instanceof Error ? error.message : "";
      if (/expir|primeiro acesso|troque a senha/i.test(errorMessage) && matricula.trim()) {
        try {
          const lookup = await getUserByMatricula(matricula.trim());
          const resolvedStatus =
            lookup?.passwordStatus ??
            lookup?.password_status ??
            (lookup?.senhaExpirada || lookup?.senha_expirada ? "expired" : null) ??
            (lookup?.precisaTrocarSenha || lookup?.precisa_trocar_senha ? "first_access" : null);
          if (resolvedStatus === "expired" || resolvedStatus === "first_access") {
            setChallengeUserId(lookup.id);
            setCurrentPassword(senha);
            setPasswordStatus(resolvedStatus);
            setChangePasswordOpen(true);
            toast.warning(
              resolvedStatus === "expired"
                ? "Sua senha venceu. Troque-a para continuar."
                : "Primeiro acesso detectado. Crie uma nova senha.",
            );
            return;
          }
        } catch {
          // segue para o tratamento original
        }
      }
      toast.error(error instanceof Error ? error.message : "Erro ao processar kit");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!challengeUserId) {
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
      await changeUserPassword(challengeUserId, currentPassword, newPassword);
      toast.success("Senha alterada com sucesso");
      toast.info("Repita a operação do kit usando a nova senha");
      setSenha("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("first_access");
      setChangePasswordOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{action === "retirar" ? "Retirar Kit" : "Voltar Kit"}</DialogTitle>
            <DialogDescription>{kit?.name}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={matricula} onChange={(event) => setMatricula(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
              />
            </div>
          </div>

          {action === "receber" && (
            <div className="overflow-x-auto rounded-lg border bg-muted/20">
              {!kit?.items ? (
                <div className="flex min-h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade padrao</TableHead>
                      <TableHead className="text-right">Quantidade inicial do kit</TableHead>
                      <TableHead className="text-right">Reposicao durante operacao</TableHead>
                      <TableHead className="text-right">Quantidade que sobrou</TableHead>
                      <TableHead className="text-right">Consumo calculado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kit.items.map((item) => {
                      const replenishment = Number(operationReplenishment[item.productId] ?? 0);
                      const leftover = Number(received[item.productId] ?? 0);
                      const consumption = item.currentQuantity + replenishment - leftover;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="min-w-48">
                            <div className="font-medium">{item.productName}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {item.barcode}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.defaultQuantity}</TableCell>
                          <TableCell className="text-right">{item.currentQuantity}</TableCell>
                          <TableCell className="w-40">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="text-right"
                              value={operationReplenishment[item.productId] ?? ""}
                              onChange={(event) =>
                                setOperationReplenishment((current) => ({
                                  ...current,
                                  [item.productId]: event.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-40">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="text-right"
                              value={received[item.productId] ?? ""}
                              onChange={(event) =>
                                setReceived((current) => ({
                                  ...current,
                                  [item.productId]: event.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold">{consumption}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {action === "retirar" && (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <PackageCheck className="h-4 w-4 text-primary" />
                Confirme a retirada do kit com matrícula e senha.
              </div>
              <p className="mt-1">O kit ficará em uso no nome do funcionário informado.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observacao</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={loading || (action === "receber" && !kit?.items)}>
              {loading ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {passwordStatus === "expired" ? "Senha vencida" : "Primeiro acesso"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {passwordStatus === "expired"
                ? "Sua senha venceu após 7 dias. Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. A ação do kit não foi executada."
                : "Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. A ação do kit não foi executada."}
            </p>

            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={changePassword} className="w-full sm:w-auto">
              Salvar nova senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
