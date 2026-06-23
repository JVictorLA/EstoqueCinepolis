import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Archive, Clock, Loader2, Plus, Trash2, Warehouse } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { archiveEstoque, createEstoque, getEstoques, setEstoqueStatus } from "@/services/api";
import type { Estoque } from "@/types";
import { toast } from "sonner";

type StockView = "estoques" | "arquivados";
type StockType = "permanente" | "temporario";

export const Route = createFileRoute("/admin/estoques")({
  head: () => ({ meta: [{ title: "Estoques · Zytrex Inventory" }] }),
  component: EstoquesPage,
});

function EstoquesPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [open, setOpen] = useState(false);
  const [newStockType, setNewStockType] = useState<StockType>("permanente");
  const [view, setView] = useState<StockView>("estoques");
  const [stockToArchive, setStockToArchive] = useState<Estoque | null>(null);
  const [archiving, setArchiving] = useState(false);

  const visibleEstoques = estoques.filter((estoque) =>
    view === "arquivados" ? estoque.arquivado : !estoque.arquivado,
  );
  const visibleCountLabel =
    view === "arquivados"
      ? `${visibleEstoques.length} ${
          visibleEstoques.length === 1 ? "estoque arquivado" : "estoques arquivados"
        }`
      : `${visibleEstoques.length} ${
          visibleEstoques.length === 1 ? "estoque cadastrado" : "estoques cadastrados"
        }`;

  const loadEstoques = async () => {
    const data = await getEstoques();
    setEstoques(data);
  };

  useEffect(() => {
    loadEstoques();
  }, []);

  const toggleStatus = async (id: number, ativo: boolean) => {
    try {
      const atualizado = await setEstoqueStatus(id, ativo);
      setEstoques((prev) => prev.map((estoque) => (estoque.id === id ? atualizado : estoque)));
      toast.success(`Estoque ${ativo ? "ativado" : "desativado"}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao atualizar status"));
    }
  };

  const handleArchive = (estoque: Estoque) => {
    if (estoque.tipo !== "temporario" || estoque.arquivado || archiving) return;
    setStockToArchive(estoque);
  };

  const confirmArchive = async () => {
    if (!stockToArchive) return;

    setArchiving(true);
    try {
      const atualizado = await archiveEstoque(stockToArchive.id);
      setEstoques((prev) =>
        prev.map((item) => (item.id === stockToArchive.id ? atualizado : item)),
      );
      toast.success("Estoque temporário arquivado");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao arquivar estoque"));
    } finally {
      setArchiving(false);
      setStockToArchive(null);
    }
  };

  const openCreateDialog = (tipo: StockType) => {
    setNewStockType(tipo);
    setOpen(true);
  };

  const emptyTitle =
    view === "arquivados" ? "Nenhum estoque arquivado" : "Nenhum estoque cadastrado";
  const emptyDescription =
    view === "arquivados"
      ? "Estoques temporários arquivados aparecerão aqui."
      : "Cadastre o primeiro estoque para separar os saldos por local.";

  return (
    <>
      <PageHeader
        title="Estoques"
        subtitle={visibleCountLabel}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <div className="flex flex-wrap gap-2">
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={() => setNewStockType("permanente")}>
                  <Plus className="h-4 w-4" /> Novo estoque
                </Button>
              </DialogTrigger>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => openCreateDialog("temporario")}
              >
                <Clock className="h-4 w-4" /> Estoque Temporário
              </Button>
            </div>
            <NewEstoqueDialog
              tipo={newStockType}
              onClose={() => setOpen(false)}
              onSuccess={loadEstoques}
            />
          </Dialog>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        <div className="border-b bg-muted/20 p-3 sm:p-4">
          <Tabs value={view} onValueChange={(value) => setView(value as StockView)}>
            <TabsList>
              <TabsTrigger value="estoques">Estoques</TabsTrigger>
              <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {visibleEstoques.length === 0 ? (
          <EmptyState
            icon={view === "arquivados" ? Archive : Warehouse}
            title={emptyTitle}
            description={emptyDescription}
            action={
              view === "estoques" ? (
                <Button onClick={() => openCreateDialog("permanente")} className="gap-2">
                  <Plus className="h-4 w-4" /> Novo estoque
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="divide-y md:hidden">
              {visibleEstoques.map((estoque) => (
                <div key={estoque.id} className="p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{estoque.nome}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <StockBadges estoque={estoque} />
                        </div>
                      </div>
                    </div>
                    <div className="flex w-24 shrink-0 flex-col items-end gap-2">
                      <Switch
                        checked={estoque.ativo}
                        disabled={estoque.arquivado}
                        onCheckedChange={(checked) => toggleStatus(estoque.id, checked)}
                      />
                      {estoque.tipo === "temporario" && !estoque.arquivado && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleArchive(estoque)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Arquivar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">Nome</TableHead>
                    <TableHead className="w-[112px]">Status</TableHead>
                    <TableHead className="w-[120px]">Tipo</TableHead>
                    <TableHead className="w-[170px]">Criado em</TableHead>
                    <TableHead className="w-[260px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEstoques.map((estoque) => (
                    <TableRow key={estoque.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                            <Warehouse className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 truncate text-sm font-medium">{estoque.nome}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StockStatusBadge estoque={estoque} />
                      </TableCell>
                      <TableCell>
                        <StockTypeBadge estoque={estoque} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(estoque.criadoEm)}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[240px] items-center gap-2">
                          <Switch
                            checked={estoque.ativo}
                            disabled={estoque.arquivado}
                            onCheckedChange={(checked) => toggleStatus(estoque.id, checked)}
                          />
                          <span className="w-16 shrink-0 text-xs text-muted-foreground">
                            {estoque.arquivado ? "Arquivado" : estoque.ativo ? "Ativo" : "Inativo"}
                          </span>
                          {estoque.tipo === "temporario" && !estoque.arquivado && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive"
                              onClick={() => handleArchive(estoque)}
                            >
                              <Archive className="h-4 w-4" />
                              Arquivar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <AlertDialog
        open={!!stockToArchive}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archiving) setStockToArchive(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-destructive" />
              Arquivar estoque temporário?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O estoque temporário "{stockToArchive?.nome}" sumirá das telas operacionais, mas
              continuará disponível no histórico. A ação será bloqueada se ainda houver saldo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiving}
              onClick={(event) => {
                event.preventDefault();
                confirmArchive();
              }}
            >
              {archiving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Arquivando...
                </>
              ) : (
                "Arquivar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NewEstoqueDialog({
  tipo,
  onClose,
  onSuccess,
}: {
  tipo: StockType;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const nomeNormalizado = nome.trim();

    if (!nomeNormalizado) {
      toast.error("Informe o nome do estoque");
      return;
    }

    setLoading(true);
    try {
      await createEstoque({ nome: nomeNormalizado, ativo: true, tipo });
      toast.success(tipo === "temporario" ? "Estoque temporário criado" : "Estoque criado");
      setNome("");
      await onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Erro ao criar estoque"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {tipo === "temporario" ? "Novo estoque temporário" : "Novo estoque"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={tipo === "temporario" ? "Estoque temporário" : "Ex: Estoque VIP"}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            Cadastrar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function StockBadges({ estoque }: { estoque: Estoque }) {
  return (
    <>
      <StockStatusBadge estoque={estoque} />
      <StockTypeBadge estoque={estoque} />
    </>
  );
}

function StockStatusBadge({ estoque }: { estoque: Estoque }) {
  if (estoque.arquivado) {
    return (
      <Badge variant="secondary" className="inline-flex w-24 justify-center">
        Arquivado
      </Badge>
    );
  }
  return (
    <Badge
      variant={estoque.ativo ? "default" : "secondary"}
      className="inline-flex w-24 justify-center"
    >
      {estoque.ativo ? "Ativo" : "Inativo"}
    </Badge>
  );
}

function StockTypeBadge({ estoque }: { estoque: Estoque }) {
  return (
    <Badge variant="outline" className="inline-flex w-24 justify-center">
      {estoque.tipo === "temporario" ? "Temporário" : "Permanente"}
    </Badge>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
