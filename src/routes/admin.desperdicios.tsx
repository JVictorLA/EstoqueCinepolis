import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eraser,
  PackageX,
  Printer,
  RefreshCw,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, StatCard, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
import { addPdfBrand, escapeHtml, reportBrandHtml, reportBrandStyles } from "@/lib/reportBrand";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/desperdicios")({
  head: () => ({ meta: [{ title: "Desperdícios · Zytrex Inventory" }] }),
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

const CUIABA_TIME_ZONE = "America/Cuiaba";

function todayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CUIABA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function firstDayOfMonth(value = todayDate()) {
  return `${value.slice(0, 7)}-01`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDateRange(start: string, end: string) {
  if (!start || !end) return [];
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return [];

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getDefaultFilters(): WasteFiltersState {
  const today = todayDate();
  return {
    estoque_id: "all",
    produto_id: "all",
    usuario_id: "all",
    motivo_id: "all",
    data_inicial: firstDayOfMonth(today),
    data_final: today,
  };
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: CUIABA_TIME_ZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: CUIABA_TIME_ZONE,
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: CUIABA_TIME_ZONE,
  }).format(date);
}

function filtersDescription(filters: WasteFiltersState, names: {
  estoque: string;
  produto: string;
  usuario: string;
  motivo: string;
}) {
  const period =
    filters.data_inicial || filters.data_final
      ? `${filters.data_inicial || "inicio"} ate ${filters.data_final || "fim"}`
      : "Todos os periodos";

  return [
    `Periodo: ${period}`,
    `Estoque: ${names.estoque}`,
    `Produto: ${names.produto}`,
    `Funcionário: ${names.usuario}`,
    `Motivo: ${names.motivo}`,
  ].join(" | ");
}

type WasteFiltersState = {
  estoque_id: string;
  produto_id: string;
  usuario_id: string;
  motivo_id: string;
  data_inicial: string;
  data_final: string;
};

type ChartType = "bar" | "line" | "pie";
type ChartMetric = "quantidade" | "valor";

function DesperdiciosPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [reasons, setReasons] = useState<WasteReason[]>([]);
  const [wastes, setWastes] = useState<Waste[]>([]);
  const [summary, setSummary] = useState<WasteSummary>(emptySummary);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("valor");
  const [selectedDay, setSelectedDay] = useState(todayDate());
  const [filters, setFilters] = useState<WasteFiltersState>(() => getDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<WasteFiltersState>(() => getDefaultFilters());

  const apiFilters = useMemo(
    () => ({
      estoque_id: appliedFilters.estoque_id,
      produto_id: appliedFilters.produto_id === "all" ? undefined : Number(appliedFilters.produto_id),
      usuario_id: appliedFilters.usuario_id === "all" ? undefined : Number(appliedFilters.usuario_id),
      motivo_id: appliedFilters.motivo_id === "all" ? undefined : appliedFilters.motivo_id,
      data_inicial: appliedFilters.data_inicial || undefined,
      data_final: appliedFilters.data_final || undefined,
    }),
    [appliedFilters],
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
    load().catch(() => toast.error("Erro ao carregar desperdícios"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters]);

  const topProduct = summary.por_produto[0]?.produto_nome ?? "-";
  const topReason = summary.por_motivo[0]?.motivo_nome ?? "-";
  const filterNames = useMemo(
    () => ({
      estoque:
        appliedFilters.estoque_id === "all"
          ? "Todos"
          : estoques.find((estoque) => estoque.id === Number(appliedFilters.estoque_id))?.nome ?? "Selecionado",
      produto:
        appliedFilters.produto_id === "all"
          ? "Todos"
          : products.find((product) => product.id === Number(appliedFilters.produto_id))?.name ?? "Selecionado",
      usuario:
        appliedFilters.usuario_id === "all"
          ? "Todos"
          : users.find((user) => user.id === Number(appliedFilters.usuario_id))?.name ?? "Selecionado",
      motivo:
        appliedFilters.motivo_id === "all"
          ? "Todos"
          : reasons.find((reason) => reason.id === Number(appliedFilters.motivo_id))?.nome ?? "Selecionado",
    }),
    [appliedFilters, estoques, products, reasons, users],
  );
  const chartData = useMemo(() => {
    const byDay = new Map(
      summary.por_dia.map((row) => [
        String(row.dia ?? ""),
        {
          quantidade: Number(row.quantidade || 0),
          valor: Number(row.valor_total || 0),
        },
      ]),
    );

    if (!appliedFilters.data_inicial && !appliedFilters.data_final) {
      return summary.por_dia
        .map((row) => String(row.dia ?? ""))
        .filter(Boolean)
        .sort()
        .map((day) => {
          const row = byDay.get(day);
          return {
            name: formatShortDate(day),
            fullDate: day,
            quantidade: row?.quantidade ?? 0,
            valor: row?.valor ?? 0,
          };
        });
    }

    return buildDateRange(appliedFilters.data_inicial, appliedFilters.data_final).map((day) => {
      const row = byDay.get(day);
      return {
        name: formatShortDate(day),
        fullDate: day,
        quantidade: row?.quantidade ?? 0,
        valor: row?.valor ?? 0,
      };
    });
  }, [appliedFilters, summary]);
  const reportSubtitle = filtersDescription(appliedFilters, filterNames);

  const setDayFilter = (date: string) => {
    const dayFilters = {
      ...filters,
      data_inicial: date,
      data_final: date,
    };
    setSelectedDay(date);
    setFilters(dayFilters);
    setAppliedFilters(dayFilters);
  };

  const clearFilters = () => {
    const nextFilters = getDefaultFilters();
    setSelectedDay(nextFilters.data_final);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const showAllPeriods = () => {
    const nextFilters = {
      ...filters,
      data_inicial: "",
      data_final: "",
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const applyFilters = () => {
    setSelectedDay(filters.data_final || filters.data_inicial || selectedDay);
    setAppliedFilters(filters);
  };

  const printReport = () => {
    const rows = wastes
      .map(
        (waste) => `
          <tr>
            <td>${escapeHtml(waste.productName)}</td>
            <td>${escapeHtml(waste.estoqueNome)}</td>
            <td>${escapeHtml(waste.motivoNome)}</td>
            <td>${escapeHtml(waste.userName)}</td>
            <td>${escapeHtml(waste.quantity)}</td>
            <td>${escapeHtml(money(waste.totalValue))}</td>
            <td>${escapeHtml(formatDateTime(waste.createdAt))}</td>
          </tr>`,
      )
      .join("");
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de desperdícios</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            p { margin: 4px 0; color: #4b5563; font-size: 12px; }
            header { border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 18px; }
            ${reportBrandStyles()}
            table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
            th { background: #f3f4f6; }
            .totals { margin-top: 16px; font-weight: 700; }
          </style>
        </head>
        <body>
          ${reportBrandHtml()}
          <h1>Relatório de Desperdícios</h1>
          <p>Gerado em ${formatDateTime(new Date().toISOString())}</p>
          <p>${reportSubtitle}</p>
          <table>
            <thead>
              <tr>
                <th>Produto</th><th>Estoque</th><th>Motivo</th><th>Funcionário</th>
                <th>Quantidade</th><th>Valor</th><th>Data</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">Registros: ${summary.totais.registros} | Quantidade: ${summary.totais.quantidade_total.toFixed(2)} | Valor: ${money(summary.totais.valor_total)}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    addPdfBrand(doc, 220, 8);
    doc.setFontSize(16);
    doc.text("Relatório de Desperdícios", 14, 16);
    doc.setFontSize(9);
    doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, 14, 24);
    doc.text(reportSubtitle, 14, 30);

    autoTable(doc, {
      startY: 38,
      head: [["Produto", "Estoque", "Motivo", "Funcionário", "Quantidade", "Valor", "Data"]],
      body: wastes.map((waste) => [
        waste.productName,
        waste.estoqueNome,
        waste.motivoNome,
        waste.userName,
        waste.quantity,
        money(waste.totalValue),
        formatDateTime(waste.createdAt),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [35, 48, 70] },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 38;
    doc.text(
      `Registros: ${summary.totais.registros} | Quantidade: ${summary.totais.quantidade_total.toFixed(2)} | Valor: ${money(summary.totais.valor_total)}`,
      14,
      finalY + 10,
    );
    doc.save(`relatorio-desperdicios-${appliedFilters.data_inicial || "inicio"}-${appliedFilters.data_final || "fim"}.pdf`);
  };

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
        title="Desperdícios"
        subtitle="Perdas, vencimentos e valor descartado por estoque"
        actions={
          <>
            <Button
              variant="outline"
              className="hidden gap-2 md:inline-flex"
              onClick={processExpired}
              disabled={processing}
            >
              <RefreshCw className={`h-4 w-4 ${processing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Processar vencidos</span>
              <span className="sm:hidden">Vencidos</span>
            </Button>
            <Button className="w-full gap-2 sm:w-auto" onClick={() => setDialogOpen(true)}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Criar desperdício</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </>
        }
      />

      <div className="mb-4 overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] md:hidden">
        <div className="border-b px-3 py-3">
          <div className="font-semibold">Historico recente</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Ultimos desperdicios registrados.
          </div>
        </div>
        {wastes.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title="Sem desperdicios"
            description="Os registros recentes aparecerao aqui."
          />
        ) : (
          <div className="divide-y">
            {wastes.slice(0, 12).map((waste) => (
              <div key={waste.id} className="p-3">
                <div className="line-clamp-2 text-sm font-medium leading-snug">
                  {waste.productName}
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span>Funcionario</span>
                    <span className="truncate font-medium text-foreground">{waste.userName}</span>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span>Motivo</span>
                    <span className="truncate font-medium text-foreground">{waste.motivoNome}</span>
                  </div>
                  <div>{formatDateTime(waste.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 hidden grid-cols-2 gap-3 sm:mb-6 sm:gap-4 md:grid lg:grid-cols-4">
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

      <div className="mb-4 hidden overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:mb-6 sm:rounded-xl md:block">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDayFilter(addDays(selectedDay, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center sm:min-w-72">
              <div className="text-xs uppercase text-muted-foreground">Dia exibido</div>
              <div className="line-clamp-1 font-semibold capitalize">{formatDateLabel(selectedDay)}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setDayFilter(addDays(selectedDay, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center">
            <Button type="button" className="gap-2" onClick={applyFilters}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Aplicar filtros</span>
              <span className="sm:hidden">Aplicar</span>
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={clearFilters}>
              <Eraser className="h-4 w-4" />
              <span className="hidden sm:inline">Limpar filtros</span>
              <span className="sm:hidden">Limpar</span>
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={showAllPeriods}>
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Todos os períodos</span>
              <span className="sm:hidden">Tudo</span>
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={printReport}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={downloadPdf}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Baixar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-2 xl:grid-cols-6">
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
            <Label>Funcionário</Label>
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
            <Label>Início</Label>
            <Input
              type="date"
              value={filters.data_inicial}
              onChange={(e) => {
                setSelectedDay(e.target.value || selectedDay);
                setFilters((current) => ({ ...current, data_inicial: e.target.value }));
              }}
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

      <div className="mb-4 hidden overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:mb-6 sm:rounded-xl md:block">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <BarChart3 className="h-4 w-4" />
              Gráfico de desperdícios
            </div>
            <div className="mt-1 hidden text-sm text-muted-foreground sm:block">
              Valor perdido por dia conforme data e filtros selecionados.
              {appliedFilters.produto_id !== "all" ? ` Produto: ${filterNames.produto}.` : ""}
            </div>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <Select value={chartMetric} onValueChange={(value) => setChartMetric(value as ChartMetric)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">Valor perdido</SelectItem>
                <SelectItem value="quantidade">Quantidade descartada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
              <SelectTrigger className="sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras</SelectItem>
                <SelectItem value="line">Linha</SelectItem>
                <SelectItem value="pie">Pizza</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-4">
          {chartData.length === 0 ? (
            <EmptyState icon={BarChart3} title="Sem dados para o gráfico" />
          ) : (
            <WasteChart type={chartType} metric={chartMetric} data={chartData} />
          )}
        </div>
      </div>

      <div className="mb-4 hidden gap-4 sm:mb-6 md:grid lg:grid-cols-2">
        <SummaryList title="Por dia" rows={summary.por_dia} labelKey="dia" />
        <SummaryList title="Por produto" rows={summary.por_produto} labelKey="produto_nome" />
        <SummaryList
          title="Por funcionário"
          rows={summary.por_funcionario}
          labelKey="usuario_nome"
        />
        <SummaryList title="Por motivo" rows={summary.por_motivo} labelKey="motivo_nome" />
      </div>

      <div className="hidden overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl md:block">
        {wastes.length === 0 ? (
          <EmptyState
            icon={PackageX}
            title="Sem desperdícios"
            description="Os registros aparecerão aqui."
          />
        ) : (
          <>
          <div className="divide-y md:hidden">
            {wastes.map((waste) => (
              <div key={waste.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{waste.productName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {waste.estoqueNome} · {waste.motivoNome}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(waste.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-destructive">{money(waste.totalValue)}</div>
                    <div className="text-xs text-muted-foreground">{waste.quantity} un.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Funcionário</TableHead>
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
                  <TableCell>{formatDateTime(waste.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:mt-6 sm:rounded-xl md:block">
        <div className="border-b px-4 py-3 font-semibold">Ranking dos maiores desperdícios</div>
        <div className="divide-y md:hidden">
          {summary.ranking.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{item.produto_nome}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.motivo_nome}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-destructive">{money(item.valor_total)}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(item.quantidade).toFixed(2)} un.
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Funcionário</TableHead>
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
    <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
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

function WasteChart({
  type,
  metric,
  data,
}: {
  type: ChartType;
  metric: ChartMetric;
  data: Array<{ name: string; fullDate: string; quantidade: number; valor: number }>;
}) {
  const config = {
    valor: {
      label: "Valor",
      color: "var(--chart-4)",
    },
    quantidade: {
      label: "Quantidade",
      color: "var(--chart-1)",
    },
  };
  const colors = [
    "var(--chart-4)",
    "var(--chart-1)",
    "var(--chart-3)",
    "var(--chart-2)",
    "var(--chart-5)",
  ];
  const metricLabel = metric === "valor" ? "Valor perdido" : "Quantidade";
  const metricColor = metric === "valor" ? "var(--color-valor)" : "var(--color-quantidade)";
  const chartWidth = Math.max(760, data.length * 78);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollLeft = container.scrollWidth;
  }, [data, type, metric, chartWidth]);

  if (type === "pie") {
    return (
      <ChartContainer config={config} className="h-[360px] w-full aspect-auto">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
          <Pie
            data={data}
            dataKey={metric}
            nameKey="name"
            innerRadius={78}
            outerRadius={138}
            paddingAngle={2}
            labelLine={false}
            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`${entry.fullDate}-${entry.name}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
    );
  }

  if (type === "line") {
    return (
      <>
        <div ref={scrollRef} className="overflow-x-auto pb-2">
          <div style={{ width: chartWidth }}>
            <ChartContainer config={config} className="h-64 w-full aspect-auto">
              <LineChart data={data} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => String(value).slice(0, 12)}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey={metric}
                  name={metricLabel}
                  stroke={metricColor}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div style={{ width: chartWidth }}>
          <ChartContainer config={config} className="h-64 w-full aspect-auto">
            <BarChart data={data} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => String(value).slice(0, 12)}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey={metric} name={metricLabel} fill={metricColor} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </>
  );
}
