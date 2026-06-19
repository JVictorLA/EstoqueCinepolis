import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  RotateCw,
  UserCheck,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  changeUserPassword,
  createKit,
  getEstoques,
  getKit,
  getKitHistory,
  getKitProducts,
  getKits,
  getPasswordChallenge,
  getUserByMatricula,
  mountKit,
  receiveKit,
  replenishKit,
  updateKit,
  withdrawKit,
  type SaveKitPayload,
} from "@/services/api";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import type { Estoque, Kit, KitItem, KitMovementHistory, KitMovementType, KitProductOption, KitStatus } from "@/types";

export const Route = createFileRoute("/admin/kits")({
  head: () => ({ meta: [{ title: "Montagem de Kit · Zytrex Inventory" }] }),
  component: KitsPage,
});

const statusLabels: Record<KitStatus, string> = {
  pronto_para_retirada: "Pronto para retirada",
  em_uso: "Em uso",
  aguardando_recebimento: "Aguardando recebimento",
  kit_incompleto: "Kit incompleto",
};

const movementLabels: Record<KitMovementType, string> = {
  criacao: "Criação",
  montagem: "Montagem",
  retirada: "Retirada",
  recebimento: "Recebimento",
  reposicao: "Reposição",
  ajuste: "Ajuste",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Sem movimentação";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function visualStatus(kit: Kit): KitStatus {
  if (kit.status !== "em_uso") return kit.status;
  const now = new Date();
  if (now.getHours() >= 21) return "aguardando_recebimento";
  return kit.status;
}

function statusClass(status: KitStatus) {
  if (status === "pronto_para_retirada") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "em_uso") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "aguardando_recebimento") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function missingQuantity(item: KitItem) {
  return Math.max(0, item.defaultQuantity - item.currentQuantity);
}

function KitItemsSummary({ items }: { items?: KitItem[] }) {
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground">Itens carregados ao abrir a ação.</p>;
  }

  return (
    <div className="rounded-lg border bg-muted/20">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Padrão</TableHead>
            <TableHead className="text-right">Atual</TableHead>
            <TableHead className="text-right">Falta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.productName}</div>
                <div className="font-mono text-xs text-muted-foreground">{item.barcode}</div>
              </TableCell>
              <TableCell className="text-right">{item.defaultQuantity}</TableCell>
              <TableCell className="text-right">{item.currentQuantity}</TableCell>
              <TableCell className="text-right font-semibold">{missingQuantity(item)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function KitsPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("all");
  const [kits, setKits] = useState<Kit[]>([]);
  const [history, setHistory] = useState<KitMovementHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [actionKit, setActionKit] = useState<Kit | null>(null);
  const [actionType, setActionType] = useState<"montar" | "repor" | "retirar" | "receber" | null>(null);

  const hasSpecificStock = selectedEstoqueId !== "all";

  const loadKits = () => {
    setLoading(true);
    getKits(selectedEstoqueId)
      .then(setKits)
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar kits");
        setKits([]);
      })
      .finally(() => setLoading(false));
  };

  const loadHistory = () => {
    setHistoryLoading(true);
    getKitHistory({ estoque_id: selectedEstoqueId })
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    getEstoques().then((rows) => setEstoques(rows.filter((estoque) => estoque.ativo)));
  }, []);

  useEffect(() => {
    loadKits();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEstoqueId]);

  const selectedStock = estoques.find((estoque) => String(estoque.id) === selectedEstoqueId);

  const openAction = async (kit: Kit, type: typeof actionType) => {
    if (!type) return;
    if (!hasSpecificStock) {
      toast.error("Selecione um estoque especifico para montar, retirar ou receber kit.");
      return;
    }

    try {
      const fullKit = await getKit(kit.id);
      setActionKit(fullKit);
      setActionType(type);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar kit");
    }
  };

  const refreshAll = () => {
    loadKits();
    loadHistory();
  };

  const stats = useMemo(
    () => ({
      total: kits.length,
      ready: kits.filter((kit) => kit.status === "pronto_para_retirada").length,
      inUse: kits.filter((kit) => kit.status === "em_uso").length,
      incomplete: kits.filter((kit) => kit.status === "kit_incompleto").length,
    }),
    [kits],
  );

  return (
    <>
      <PageHeader
        title="Montagem de Kit"
        subtitle="Controle de kits por estoque, retirada por atendente e recebimento no fim do turno"
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              if (!hasSpecificStock) {
                toast.error("Selecione um estoque especifico para criar um kit.");
                return;
              }
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Criar Kit Caixa</span>
            <span className="sm:hidden">Criar</span>
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 md:grid-cols-[260px_repeat(4,minmax(0,1fr))]">
        <div className="col-span-2 rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)] sm:rounded-xl sm:p-4 md:col-span-1">
          <Label>Estoque</Label>
          <Select value={selectedEstoqueId} onValueChange={setSelectedEstoqueId}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {estoques.map((estoque) => (
                <SelectItem key={estoque.id} value={String(estoque.id)}>
                  {estoque.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hasSpecificStock && (
            <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
              Em "Todos", a página fica apenas para visualização.
            </p>
          )}
        </div>
        <Metric label="Kits" value={stats.total} />
        <Metric label="Prontos" value={stats.ready} tone="success" />
        <Metric label="Em uso" value={stats.inUse} tone="info" />
        <Metric label="Incompletos" value={stats.incomplete} tone="danger" />
      </div>

      <Tabs defaultValue="kits" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="kits" className="gap-2">
            <Boxes className="h-4 w-4" />
            Kits
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kits">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center rounded-xl border bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : kits.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Nenhum kit cadastrado"
              description="Selecione um estoque especifico e crie o primeiro Kit Caixa."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {kits.map((kit) => {
                const displayStatus = visualStatus(kit);
                const canAct = hasSpecificStock;
                return (
                  <article key={kit.id} className="rounded-lg border bg-card p-3 shadow-[var(--shadow-soft)] sm:rounded-xl sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-foreground">{kit.name}</h2>
                        <p className="text-sm text-muted-foreground">{kit.estoqueNome}</p>
                      </div>
                      <Badge variant="outline" className={cn("rounded-full", statusClass(displayStatus))}>
                        {statusLabels[displayStatus]}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <InfoRow label="Responsável atual" value={kit.responsibleName || "Sem responsável"} />
                      <InfoRow
                        label="Última movimentação"
                        value={
                          kit.lastMovementType
                            ? `${movementLabels[kit.lastMovementType]} · ${formatDateTime(kit.lastMovementAt)}`
                            : "Sem movimentação"
                        }
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {kit.status !== "em_uso" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={!canAct}
                          onClick={() => {
                            getKit(kit.id).then(setEditingKit).catch(() => toast.error("Erro ao carregar kit"));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                      )}
                      {kit.status === "kit_incompleto" && (
                        <Button size="sm" className="gap-2" disabled={!canAct} onClick={() => openAction(kit, "montar")}>
                          <PackagePlus className="h-4 w-4" />
                          Montar Kit
                        </Button>
                      )}
                      {kit.status === "pronto_para_retirada" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={!canAct}
                          onClick={() => openAction(kit, "retirar")}
                        >
                          <UserCheck className="h-4 w-4" />
                          Retirar Kit
                        </Button>
                      )}
                      {kit.status === "em_uso" && (
                        <Button size="sm" className="gap-2" disabled={!canAct} onClick={() => openAction(kit, "receber")}>
                          <CheckCircle2 className="h-4 w-4" />
                          Receber Kit
                        </Button>
                      )}
                      {kit.status !== "em_uso" && kit.status !== "kit_incompleto" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={!canAct}
                          onClick={() => openAction(kit, "repor")}
                        >
                          <RotateCw className="h-4 w-4" />
                          Repor Kit
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico">
          <HistoryPanel history={history} loading={historyLoading} />
        </TabsContent>
      </Tabs>

      <KitFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        selectedStock={selectedStock ?? null}
        onSaved={() => {
          setCreateOpen(false);
          refreshAll();
        }}
      />

      <KitFormDialog
        open={!!editingKit}
        onOpenChange={(open) => {
          if (!open) setEditingKit(null);
        }}
        selectedStock={selectedStock ?? null}
        kit={editingKit}
        onSaved={() => {
          setEditingKit(null);
          refreshAll();
        }}
      />

      <KitActionDialog
        kit={actionKit}
        type={actionType}
        onClose={() => {
          setActionKit(null);
          setActionType(null);
        }}
        onDone={() => {
          setActionKit(null);
          setActionType(null);
          refreshAll();
        }}
      />
    </>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "info" | "danger" }) {
  const color =
    tone === "success"
      ? "text-emerald-700"
      : tone === "info"
        ? "text-blue-700"
        : tone === "danger"
          ? "text-rose-700"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold", color)}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

type KitDraftItem = {
  productId: string;
  defaultQuantity: string;
};

function KitFormDialog({
  open,
  onOpenChange,
  selectedStock,
  kit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStock: Estoque | null;
  kit?: Kit | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [products, setProducts] = useState<KitProductOption[]>([]);
  const [templates, setTemplates] = useState<Kit[]>([]);
  const [items, setItems] = useState<KitDraftItem[]>([{ productId: "", defaultQuantity: "" }]);
  const [loading, setLoading] = useState(false);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selectedStock) return;
    getKitProducts(selectedStock.id).then(setProducts).catch(() => setProducts([]));
    if (!kit) {
      getKits(selectedStock.id).then(setTemplates).catch(() => setTemplates([]));
    }
  }, [open, selectedStock]);

  useEffect(() => {
    if (!open) return;
    setName(kit?.name ?? "");
    setItems(
      kit?.items?.length
        ? kit.items.map((item) => ({
            productId: String(item.productId),
            defaultQuantity: String(item.defaultQuantity),
          }))
        : [{ productId: "", defaultQuantity: "" }],
    );
  }, [open, kit]);

  const applyTemplate = async (templateId: string) => {
    setLoadingTemplateId(templateId);
    try {
      const template = await getKit(Number(templateId));
      if (!template.items?.length) {
        toast.error("Esse kit não possui produtos para copiar.");
        return;
      }
      setItems(
        template.items.map((item) => ({
          productId: String(item.productId),
          defaultQuantity: String(item.defaultQuantity),
        })),
      );
      toast.success("Produtos do kit modelo adicionados");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao copiar kit modelo");
    } finally {
      setLoadingTemplateId(null);
    }
  };

  const addItem = () => setItems((current) => [...current, { productId: "", defaultQuantity: "" }]);
  const removeItem = (index: number) =>
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const updateItem = (index: number, patch: Partial<KitDraftItem>) =>
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStock) {
      toast.error("Selecione um estoque especifico.");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe o nome do kit.");
      return;
    }

    const payloadItems = items
      .map((item) => ({
        produto_id: Number(item.productId),
        quantidade_padrao: Number(item.defaultQuantity),
      }))
      .filter((item) => item.produto_id);

    const uniqueProducts = new Set(payloadItems.map((item) => item.produto_id));
    if (!payloadItems.length) return toast.error("Adicione pelo menos um produto.");
    if (uniqueProducts.size !== payloadItems.length) return toast.error("Remova produtos duplicados do kit.");
    if (payloadItems.some((item) => !Number.isFinite(item.quantidade_padrao) || item.quantidade_padrao <= 0)) {
      return toast.error("Informe quantidade padrao maior que zero.");
    }

    const payload: SaveKitPayload = {
      estoque_id: selectedStock.id,
      nome: name.trim(),
      itens: payloadItems,
    };

    setLoading(true);
    try {
      if (kit) {
        await updateKit(kit.id, payload);
        toast.success("Kit atualizado");
      } else {
        await createKit(payload);
        toast.success("Kit criado");
      }
      onSaved();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar kit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kit ? "Editar Kit Caixa" : "Criar Kit Caixa"}</DialogTitle>
          <DialogDescription>
            Produtos do kit serao vinculados ao estoque {selectedStock?.nome ?? "selecionado"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="space-y-2">
              <Label>Nome do kit</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Kit Caixa VIP 01" />
            </div>
            <div className="space-y-2">
              <Label>Estoque</Label>
              <Input value={selectedStock?.nome ?? ""} disabled />
            </div>
          </div>

          {!kit && templates.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label>Usar produtos de outro kit</Label>
              <Select value="" onValueChange={applyTemplate} disabled={!!loadingTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingTemplateId ? "Copiando produtos..." : "Escolha um kit modelo"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Copia os mesmos produtos e quantidades padrão do kit escolhido.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Produtos do kit</Label>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Produto
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => {
                const selectedProduct = products.find((product) => String(product.id) === item.productId);
                return (
                  <div key={index} className="grid gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-end">
                    <div className="space-y-2">
                      <Label>Produto</Label>
                      <Select value={item.productId} onValueChange={(value) => updateItem(index, { productId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder={products.length ? "Selecione o produto" : "Nenhum produto vinculado"} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={String(product.id)}>
                              {product.name} · saldo {product.stock}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProduct && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{selectedProduct.barcode}</span>
                          <span>{selectedProduct.categoryName ?? "Sem categoria"}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Qtd. padrão</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.defaultQuantity}
                        onChange={(event) => updateItem(index, { defaultQuantity: event.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={items.length === 1}
                      onClick={() => removeItem(index)}
                    >
                      Remover
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !selectedStock}>
              {loading ? "Salvando..." : kit ? "Salvar alterações" : "Criar kit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KitActionDialog({
  kit,
  type,
  onClose,
  onDone,
}: {
  kit: Kit | null;
  type: "montar" | "repor" | "retirar" | "receber" | null;
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
  const isMobile = useIsMobile();
  const open = !!kit && !!type;

  useEffect(() => {
    if (!kit || type !== "receber") return;
    const next: Record<number, string> = {};
    const nextReplenishment: Record<number, string> = {};
    kit.items?.forEach((item) => {
      next[item.productId] = String(item.currentQuantity);
      nextReplenishment[item.productId] = "0";
    });
    setReceived(next);
    setOperationReplenishment(nextReplenishment);
  }, [kit, type]);

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
    if (!kit || !type) return;
    setLoading(true);
    try {
      if (type === "montar") {
        await mountKit(kit.id, note);
        toast.success("Kit montado");
      }
      if (type === "repor") {
        await replenishKit(kit.id, note);
        toast.success("Kit reposto");
      }
      if (type === "retirar") {
        await withdrawKit(kit.id, { matricula, senha, observacao: note });
        toast.success("Kit retirado");
      }
      if (type === "receber") {
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
    } catch (error: unknown) {
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

  const title =
    type === "montar"
      ? "Montar Kit"
      : type === "repor"
        ? "Repor Kit"
        : type === "retirar"
          ? "Retirar Kit"
          : "Receber Kit";

  if (isMobile && (type === "montar" || type === "repor")) {
    return (
      <MobileKitSupplyDrawer
        open={open}
        kit={kit}
        type={type}
        note={note}
        loading={loading}
        onNoteChange={setNote}
        onClose={onClose}
        onSubmit={submit}
      />
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kit?.name} · {kit?.estoqueNome}
          </DialogDescription>
        </DialogHeader>

        {(type === "montar" || type === "repor") && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O sistema vai pegar do estoque somente a diferença entre a quantidade padrão e a quantidade atual.
            </p>
            <KitItemsSummary items={kit?.items} />
          </div>
        )}

        {(type === "retirar" || type === "receber") && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={matricula} onChange={(event) => setMatricula(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} />
            </div>
          </div>
        )}

        {type === "receber" && (
          <div className="overflow-x-auto rounded-lg border bg-muted/20">
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
                {kit?.items?.map((item) => {
                  const replenishment = Number(operationReplenishment[item.productId] ?? 0);
                  const leftover = Number(received[item.productId] ?? 0);
                  const consumption = item.currentQuantity + replenishment - leftover;

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="min-w-48">
                        <div className="font-medium">{item.productName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{item.barcode}</div>
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
          </div>
        )}

        <div className="space-y-2">
          <Label>Observação</Label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Processando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{passwordStatus === "expired" ? "Senha vencida" : "Primeiro acesso"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {passwordStatus === "expired"
              ? "Sua senha venceu após 7 dias. Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. A ação do kit não foi executada."
              : "Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. A ação do kit não foi executada."}
          </p>

          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
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

function MobileKitSupplyDrawer({
  open,
  kit,
  type,
  note,
  loading,
  onNoteChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  kit: Kit | null;
  type: "montar" | "repor";
  note: string;
  loading: boolean;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const items = kit?.items ?? [];
  const missingItems = items.filter((item) => missingQuantity(item) > 0);
  const displayStatus = kit ? visualStatus(kit) : "kit_incompleto";
  const isMount = type === "montar";
  const title = isMount ? "Montar Kit" : "Repor Kit";
  const itemsLabel = isMount ? "Itens para montar" : "Itens para repor";
  const confirmLabel = isMount ? "Confirmar montagem" : "Confirmar reposicao";

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{kit?.name ?? "Kit selecionado"}</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{kit?.name ?? "Kit"}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {kit?.estoqueNome ?? "Estoque selecionado"}
                </div>
              </div>
              <Badge variant="outline" className={cn("shrink-0 rounded-full", statusClass(displayStatus))}>
                {statusLabels[displayStatus]}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>{itemsLabel}</Label>
              {items.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {missingItems.length} com falta
                </span>
              ) : null}
            </div>

            {!items.length ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Itens carregados ao abrir a acao.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const missing = missingQuantity(item);
                  const hasMissing = missing > 0;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border bg-background p-3",
                        hasMissing && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-medium leading-snug">
                          {item.productName}
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {item.barcode}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-muted-foreground">Padrao</div>
                          <div className="mt-1 font-semibold text-foreground">
                            {item.defaultQuantity}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-muted-foreground">Atual</div>
                          <div className="mt-1 font-semibold text-foreground">
                            {item.currentQuantity}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "rounded-md p-2",
                            hasMissing ? "bg-primary text-primary-foreground" : "bg-muted/50",
                          )}
                        >
                          <div className={hasMissing ? "text-primary-foreground/80" : "text-muted-foreground"}>
                            Falta
                          </div>
                          <div className="mt-1 font-semibold">{missing}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observacao</Label>
            <Textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DrawerFooter className="border-t bg-background">
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "Processando..." : confirmLabel}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function HistoryPanel({ history, loading }: { history: KitMovementHistory[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!history.length) {
    return <EmptyState icon={Clock} title="Sem histórico" description="As movimentações dos kits aparecerão aqui." />;
  }

  return (
    <div className="space-y-3">
      {history.map((movement) => (
        <article key={movement.id} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{movement.kitName}</h3>
                <Badge variant="outline">{movementLabels[movement.type]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {movement.estoqueNome} · {movement.userName} · {formatDateTime(movement.createdAt)}
              </p>
            </div>
            {movement.note && <div className="text-sm text-muted-foreground">{movement.note}</div>}
          </div>

          {movement.items.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Inicial/Anterior</TableHead>
                    <TableHead className="text-right">Reposicao operacao</TableHead>
                    <TableHead className="text-right">Consumo/Movimentada</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movement.items.map((item) => (
                    <TableRow key={`${movement.id}-${item.productId}`}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">{item.previousQuantity}</TableCell>
                      <TableCell className="text-right">{item.operationReplenishment}</TableCell>
                      <TableCell className="text-right">{item.movedQuantity}</TableCell>
                      <TableCell className="text-right font-semibold">{item.finalQuantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
