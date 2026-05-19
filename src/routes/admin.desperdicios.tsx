import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, DollarSign, PackageX, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WasteDialog } from "@/components/waste/WasteDialog";
import {
  getEstoques,
  getProducts,
  getUsers,
  getWasteReasons,
  getWastes,
  getWasteSummary,
  processExpiredWastes,
} from "@/services/api";
import type {
  Estoque,
  Product,
  SystemUser,
  Waste,
  WasteReason,
  WasteSummary,
  WasteSummaryGroup,
} from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/desperdicios")({
  head: () => ({ meta: [{ title: "Desperdicios · Cinepolis" }] }),
  component: DesperdiciosPage,
});

const emptySummary: WasteSummary = {
  totais: { valor_total: 0, quantidade_total: 0, registros: 0 },
  por_dia: [],
  por_produto: [],
  por_funcionario: [],
  por_motivo: [],
  ranking: [],
};

function money(value: number | string) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DesperdiciosPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [reasons, setReasons] = useState<WasteReason[]>([]);
  const [wastes, setWastes] = useState<Waste[]>([]);
  const [summary, setSummary] = useState<WasteSummary>(emptySummary);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filters, setFilters] = useState({
    estoque_id: "all",
    produto_id: "all",
    usuario_id: "all",
    motivo_id: "all",
    data_inicial: "",
    data_final: "",
  });

  const apiFilters = useMemo(
    () => ({
      estoque_id: filters.estoque_id,
      produto_id: filters.produto_id === "all" ? undefined : Number(filters.produto_id),
      usuario_id: filters.usuario_id === "all" ? undefined : Number(filters.usuario_id),
      motivo_id: filters.motivo_id === "all" ? undefined : filters.motivo_id,
      data_inicial: filters.data_inicial || undefined,
      data_final: filters.data_final || undefined,
    }),
    [filters],
  );

  const load = async () => {
    const [wasteRows, summaryData] = await Promise.all([
      getWastes(apiFilters),
      getWasteSummary(apiFilters),
    ]);
    setWastes(wasteRows);
    setSummary(summaryData);
  };

  useEffect(() => {
    Promise.all([getEstoques(), getProducts("all"), getUsers(), getWasteReasons()])
      .then(([estoqueRows, productRows, userRows, reasonRows]) => {
        setEstoques(estoqueRows);
        setProducts(productRows);
        setUsers(userRows);
        setReasons(reasonRows);
      })
      .catch(() => toast.error("Erro ao carregar filtros"));
  }, []);

  useEffect(() => {
    load().catch(() => toast.error("Erro ao carregar desperdicios"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  const topProduct = summary.por_produto[0]?.produto_nome ?? "-";
  const topReason = summary.por_motivo[0]?.motivo_nome ?? "-";

  const processExpired = async () => {
    setProcessing(true);
    try {
      const result = await processExpiredWastes();
      toast.success(`${result.processados} item(ns) vencido(s) processado(s)`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar vencidos");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Desperdicios"
        subtitle="Perdas, vencimentos e valor descartado por estoque"
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={processExpired}
              disabled={processing}
            >
              <RefreshCw className={`h-4 w-4 ${processing ? "animate-spin" : ""}`} />
              Processar vencidos
            </Button>
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Criar desperdicio
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Valor perdido"
          value={money(summary.totais.valor_total)}
          icon={DollarSign}
          tone="destructive"
        />
        <StatCard
          label="Quantidade total"
          value={summary.totais.quantidade_total.toFixed(2)}
          icon={PackageX}
        />
        <StatCard label="Maior produto" value={topProduct} icon={Trash2} />
        <StatCard label="Motivo recorrente" value={topReason} icon={CalendarDays} tone="warning" />
      </div>

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden mb-6">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2">
            <Label>Estoque</Label>
            <Select
              value={filters.estoque_id}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, estoque_id: value }))
              }
            >
              <SelectTrigger>
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
          </div>

          <div className="space-y-2">
            <Label>Produto</Label>
            <Select
              value={filters.produto_id}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, produto_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={String(product.id)}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select
              value={filters.motivo_id}
              onValueChange={(value) => setFilters((current) => ({ ...current, motivo_id: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {reasons.map((reason) => (
                  <SelectItem key={reason.id} value={String(reason.id)}>
                    {reason.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Funcionario</Label>
            <Select
              value={filters.usuario_id}
              onValueChange={(value) =>
                setFilters((current) => ({ ...current, usuario_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Inicio</Label>
            <Input
              type="date"
              value={filters.data_inicial}
              onChange={(e) =>
                setFilters((current) => ({ ...current, data_inicial: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Fim</Label>
            <Input
              type="date"
              value={filters.data_final}
              onChange={(e) =>
                setFilters((current) => ({ ...current, data_final: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 mb-6">
        <SummaryList title="Por dia" rows={summary.por_dia} labelKey="dia" />
        <SummaryList title="Por produto" rows={summary.por_produto} labelKey="produto_nome" />
        <SummaryList
          title="Por funcionario"
          rows={summary.por_funcionario}
          labelKey="usuario_nome"
        />
        <SummaryList title="Por motivo" rows={summary.por_motivo} labelKey="motivo_nome" />
      </div>

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
        {wastes.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title="Sem desperdicios"
            description="Os registros aparecerao aqui."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Funcionario</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wastes.map((waste) => (
                <TableRow key={waste.id}>
                  <TableCell>{waste.productName}</TableCell>
                  <TableCell>{waste.estoqueNome}</TableCell>
                  <TableCell>{waste.motivoNome}</TableCell>
                  <TableCell>{waste.userName}</TableCell>
                  <TableCell>{waste.quantity}</TableCell>
                  <TableCell>{money(waste.totalValue)}</TableCell>
                  <TableCell>{new Date(waste.createdAt).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden mt-6">
        <div className="border-b px-4 py-3 font-semibold">Ranking dos maiores desperdicios</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Funcionario</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.ranking.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.produto_nome}</TableCell>
                <TableCell>{item.motivo_nome}</TableCell>
                <TableCell>{item.usuario_nome}</TableCell>
                <TableCell>{Number(item.quantidade).toFixed(2)}</TableCell>
                <TableCell>{money(item.valor_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <WasteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        estoques={estoques}
        onSaved={load}
      />
    </>
  );
}

function SummaryList({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows: WasteSummaryGroup[];
  labelKey: keyof WasteSummaryGroup;
}) {
  return (
    <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="border-b px-4 py-3 font-semibold">{title}</div>
      <div className="divide-y">
        {rows.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Sem dados no periodo.</div>
        ) : (
          rows.slice(0, 8).map((row, index) => (
            <div
              key={`${title}-${index}`}
              className="flex items-center justify-between gap-4 p-4 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{row[labelKey] ?? "-"}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(row.quantidade || 0).toFixed(2)} unidade(s)
                </div>
              </div>
              <div className="font-semibold text-destructive">{money(row.valor_total)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
