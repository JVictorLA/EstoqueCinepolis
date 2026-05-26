import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Warehouse } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createEstoque, getEstoques, setEstoqueStatus } from "@/services/api";
import type { Estoque } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/estoques")({
  head: () => ({ meta: [{ title: "Estoques · Zytrex Inventory" }] }),
  component: EstoquesPage,
});

function EstoquesPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <PageHeader
        title="Estoques"
        subtitle={`${estoques.length} ${estoques.length === 1 ? "estoque cadastrado" : "estoques cadastrados"}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo estoque
              </Button>
            </DialogTrigger>
            <NewEstoqueDialog onClose={() => setOpen(false)} onSuccess={loadEstoques} />
          </Dialog>
        }
      />

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
        {estoques.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Nenhum estoque cadastrado"
            description="Cadastre o primeiro estoque para separar os saldos por local."
            action={
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Novo estoque
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estoques.map((estoque) => (
                  <TableRow key={estoque.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                          <Warehouse className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="font-medium text-sm">{estoque.nome}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={estoque.ativo ? "default" : "secondary"}>
                        {estoque.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(estoque.criadoEm)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={estoque.ativo}
                          onCheckedChange={(checked) => toggleStatus(estoque.id, checked)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {estoque.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}

function NewEstoqueDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeNormalizado = nome.trim();

    if (!nomeNormalizado) {
      toast.error("Informe o nome do estoque");
      return;
    }

    setLoading(true);
    try {
      await createEstoque({ nome: nomeNormalizado, ativo: true });
      toast.success("Estoque criado");
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
        <DialogTitle>Novo estoque</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Estoque VIP"
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
