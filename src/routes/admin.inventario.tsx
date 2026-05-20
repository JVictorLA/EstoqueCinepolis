import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileText,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { PageHeader, EmptyState, StatCard } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BarcodeInput } from "@/components/scanner/BarcodeInput";
import {
  createConference,
  deleteConferenceItem,
  finalizeConference,
  getConference,
  getConferences,
  getEstoques,
  getInventoryCurrent,
  saveConferenceItem,
  searchConferenceProduct,
  updateConference,
} from "@/services/api";
import type {
  Conference,
  ConferenceHistory,
  ConferenceItem,
  ConferenceProductOption,
  Estoque,
  InventoryCurrentItem,
  InventoryStatus,
} from "@/types";

export const Route = createFileRoute("/admin/inventario")({
  head: () => ({ meta: [{ title: "Inventário · Cinépolis" }] }),
  component: InventarioPage,
});

const statusLabel: Record<InventoryStatus, string> = {
  ok: "OK",
  estoque_baixo: "Estoque baixo",
  sem_estoque: "Sem estoque",
  vencido: "Vencido",
  proximo_vencimento: "Próximo do vencimento",
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function selectedStockName(estoques: Estoque[], value: string | number | null | undefined) {
  if (value === "all" || value === null || value === undefined) return "Todos os estoques";
  return estoques.find((estoque) => estoque.id === Number(value))?.nome ?? "Estoque selecionado";
}

function inventoryStatusBadge(status: InventoryStatus) {
  if (status === "ok") {
    return (
      <Badge variant="secondary" className="bg-success/15 text-success border-success/30">
        OK
      </Badge>
    );
  }
  if (status === "vencido" || status === "sem_estoque") {
    return <Badge variant="destructive">{statusLabel[status]}</Badge>;
  }
  return (
    <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
      {statusLabel[status]}
    </Badge>
  );
}

function conferenceStatusBadge(status: ConferenceItem["status"]) {
  if (status === "ok") {
    return (
      <Badge variant="secondary" className="gap-1 bg-success/15 text-success border-success/30">
        <CheckCircle2 className="h-3 w-3" /> OK
      </Badge>
    );
  }
  if (status === "sobra") {
    return (
      <Badge variant="secondary" className="gap-1 bg-warning/15 text-warning border-warning/30">
        <AlertTriangle className="h-3 w-3" /> Sobra
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" /> Falta
    </Badge>
  );
}

function openPrintWindow(title: string, html: string) {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    toast.error("Não foi possível abrir a janela de impressão");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          p { margin: 4px 0; color: #4b5563; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
          th { background: #f3f4f6; }
          .totals { margin-top: 16px; font-weight: 700; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function inventoryPrintHtml(items: InventoryCurrentItem[], stockName: string) {
  const totalUnits = items.reduce((sum, item) => sum + item.stock, 0);
  const totalValue = items.reduce((sum, item) => sum + item.stock * item.price, 0);
  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.barcode}</td>
          <td>${item.categoryName ?? "-"}</td>
          <td>${item.stock}</td>
          <td>${item.minStock}</td>
          <td>${formatDate(item.expirationDate)}</td>
          <td>${statusLabel[item.status]}</td>
          <td>${item.estoques.map((stock) => stock.estoqueNome).join(", ") || item.estoqueNome || "-"}</td>
        </tr>`,
    )
    .join("");

  return `
    <h1>Relatório de Inventário</h1>
    <p>Gerado em ${formatDateTime(new Date().toISOString())}</p>
    <p>Estoque selecionado: ${stockName}</p>
    <table>
      <thead>
        <tr>
          <th>Produto</th><th>Código</th><th>Categoria</th><th>Estoque</th>
          <th>Mínimo</th><th>Validade</th><th>Status</th><th>Estoques</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">Produtos: ${items.length} | Unidades: ${totalUnits} | Valor: ${money(totalValue)}</div>
  `;
}

function conferencePrintHtml(conference: Conference) {
  const totals = getConferenceTotals(conference.items);
  const rows = conference.items
    .map(
      (item) => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.barcode}</td>
          <td>${item.estoqueNome ?? "-"}</td>
          <td>${item.systemQuantity}</td>
          <td>${item.countedQuantity}</td>
          <td>${item.difference > 0 ? `+${item.difference}` : item.difference}</td>
          <td>${item.status.toUpperCase()}</td>
        </tr>`,
    )
    .join("");

  return `
    <h1>Relatório de Conferência de Estoque</h1>
    <p>ID da conferência: ${conference.id}</p>
    <p>Estoque: ${conference.estoqueNome ?? "Todos os estoques"}</p>
    <p>Responsável: ${conference.userName ?? "-"}</p>
    <p>Criada em: ${formatDateTime(conference.createdAt)} | Status: ${conference.status}</p>
    <table>
      <thead>
        <tr>
          <th>Produto</th><th>Código</th><th>Estoque</th><th>Sistema</th>
          <th>Contado</th><th>Diferença</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">Conferidos: ${totals.items} | Divergências: ${totals.divergences} | Faltas: ${totals.shortages} | Sobras: ${totals.surpluses}</div>
  `;
}

function exportInventoryPdf(items: InventoryCurrentItem[], stockName: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const totalUnits = items.reduce((sum, item) => sum + item.stock, 0);
  const totalValue = items.reduce((sum, item) => sum + item.stock * item.price, 0);

  doc.setFontSize(16);
  doc.text("Relatório de Inventário", 14, 16);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${formatDateTime(new Date().toISOString())}`, 14, 24);
  doc.text(`Estoque selecionado: ${stockName}`, 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [["Produto", "Código", "Categoria", "Estoque", "Mínimo", "Validade", "Status", "Estoques"]],
    body: items.map((item) => [
      item.productName,
      item.barcode,
      item.categoryName ?? "-",
      item.stock,
      item.minStock,
      formatDate(item.expirationDate),
      statusLabel[item.status],
      item.estoques.map((stock) => stock.estoqueNome).join(", ") || item.estoqueNome || "-",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [35, 48, 70] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 38;
  doc.text(`Totais gerais: ${items.length} produtos | ${totalUnits} unidades | ${money(totalValue)}`, 14, finalY + 10);
  doc.save(`relatorio-inventario-${Date.now()}.pdf`);
}

function exportConferencePdf(conference: Conference) {
  const doc = new jsPDF({ orientation: "landscape" });
  const totals = getConferenceTotals(conference.items);

  doc.setFontSize(16);
  doc.text("Relatório de Conferência de Estoque", 14, 16);
  doc.setFontSize(10);
  doc.text(`ID: ${conference.id}`, 14, 24);
  doc.text(`Estoque: ${conference.estoqueNome ?? "Todos os estoques"}`, 14, 30);
  doc.text(`Responsável: ${conference.userName ?? "-"}`, 14, 36);
  doc.text(`Criada em: ${formatDateTime(conference.createdAt)} | Status: ${conference.status}`, 14, 42);

  autoTable(doc, {
    startY: 50,
    head: [["Produto", "Código", "Estoque", "Sistema", "Contado", "Diferença", "Status"]],
    body: conference.items.map((item) => [
      item.productName,
      item.barcode,
      item.estoqueNome ?? "-",
      item.systemQuantity,
      item.countedQuantity,
      item.difference > 0 ? `+${item.difference}` : item.difference,
      item.status.toUpperCase(),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [35, 48, 70] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50;
  doc.text(
    `Total de produtos conferidos: ${totals.items} | Divergências: ${totals.divergences} | Faltas: ${totals.shortages} | Sobras: ${totals.surpluses}`,
    14,
    finalY + 10,
  );
  doc.save(`relatorio-conferencia-${conference.id}.pdf`);
}

function getConferenceTotals(items: ConferenceItem[]) {
  return {
    items: items.length,
    divergences: items.filter((item) => item.status !== "ok").length,
    shortages: items.filter((item) => item.status === "falta").length,
    surpluses: items.filter((item) => item.status === "sobra").length,
    countedUnits: items.reduce((sum, item) => sum + item.countedQuantity, 0),
  };
}

function InventarioPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [activeTab, setActiveTab] = useState("estoque");
  const [inventoryStock, setInventoryStock] = useState("all");
  const [inventoryItems, setInventoryItems] = useState<InventoryCurrentItem[]>([]);
  const [history, setHistory] = useState<ConferenceHistory[]>([]);
  const [activeConference, setActiveConference] = useState<Conference | null>(null);
  const [newConferenceOpen, setNewConferenceOpen] = useState(false);
  const [newConferenceStock, setNewConferenceStock] = useState("all");
  const [barcode, setBarcode] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [productPreview, setProductPreview] = useState<ConferenceProductOption | null>(null);
  const [stockOptions, setStockOptions] = useState<ConferenceProductOption[]>([]);
  const [pendingBarcode, setPendingBarcode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeEstoques = useMemo(() => estoques.filter((estoque) => estoque.ativo), [estoques]);
  const inventoryStockName = selectedStockName(estoques, inventoryStock);
  const conferenceTotals = useMemo(
    () => getConferenceTotals(activeConference?.items ?? []),
    [activeConference],
  );
  const inventorySummary = useMemo(
    () => ({
      products: inventoryItems.length,
      units: inventoryItems.reduce((sum, item) => sum + item.stock, 0),
      low: inventoryItems.filter((item) => item.status === "estoque_baixo").length,
      critical: inventoryItems.filter((item) => item.status === "sem_estoque" || item.status === "vencido").length,
    }),
    [inventoryItems],
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const [stocks, current, conferences] = await Promise.all([
        getEstoques(),
        getInventoryCurrent(inventoryStock),
        getConferences(),
      ]);
      setEstoques(stocks);
      setInventoryItems(current);
      setHistory(conferences);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar inventário");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    getInventoryCurrent(inventoryStock)
      .then(setInventoryItems)
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Erro ao filtrar estoque"));
  }, [inventoryStock]);

  const refreshHistory = async () => {
    const rows = await getConferences();
    setHistory(rows);
  };

  const startConference = async () => {
    setSaving(true);
    try {
      const conference = await createConference({
        estoque_id: newConferenceStock === "all" ? null : Number(newConferenceStock),
      });
      setActiveConference(conference);
      setNote(conference.note ?? "");
      setBarcode("");
      setProductPreview(null);
      setCountedQuantity("1");
      setNewConferenceOpen(false);
      setActiveTab("conferencia");
      await refreshHistory();
      toast.success("Conferência criada");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conferência");
    } finally {
      setSaving(false);
    }
  };

  const loadConference = async (id: number) => {
    setSaving(true);
    try {
      const conference = await getConference(id);
      setActiveConference(conference);
      setNote(conference.note ?? "");
      setBarcode("");
      setProductPreview(null);
      setStockOptions([]);
      setActiveTab("conferencia");
      toast.success(conference.status === "finalizada" ? "Conferência carregada para visualização" : "Conferência aberta para edição");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar conferência");
    } finally {
      setSaving(false);
    }
  };

  const saveConferenceMeta = async () => {
    if (!activeConference) return;
    setSaving(true);
    try {
      const updated = await updateConference(activeConference.id, { observacao: note });
      setActiveConference(updated);
      await refreshHistory();
      toast.success("Conferência salva");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar conferência");
    } finally {
      setSaving(false);
    }
  };

  const addConferenceItem = async (selectedStockId?: number) => {
    if (!activeConference) {
      setNewConferenceOpen(true);
      toast.error("Crie uma conferência antes de adicionar itens");
      return;
    }
    if (activeConference.status === "finalizada") {
      toast.error("Conferência finalizada não pode ser editada");
      return;
    }

    const code = (selectedStockId ? pendingBarcode : barcode).trim();
    const quantity = Number(countedQuantity);
    if (!code) return;
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("Informe uma quantidade contada válida");
      return;
    }

    setSaving(true);
    try {
      if (!selectedStockId && activeConference.estoqueId === null && productPreview?.barcode === code) {
        selectedStockId = productPreview.estoqueId;
      }

      if (!selectedStockId && activeConference.estoqueId === null) {
        const options = await searchConferenceProduct(code, "all");
        if (options.length > 1) {
          setPendingBarcode(code);
          setStockOptions(options);
          return;
        }
      }

      const updated = await saveConferenceItem(activeConference.id, {
        codigo_barras: code,
        quantidade_contada: quantity,
        estoque_id: selectedStockId,
      });
      setActiveConference(updated);
      setBarcode("");
      setProductPreview(null);
      setPendingBarcode("");
      setStockOptions([]);
      await refreshHistory();
      toast.success("Item conferido");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao conferir item");
    } finally {
      setSaving(false);
    }
  };

  const previewConferenceProduct = async (rawCode?: string) => {
    if (!activeConference) {
      setNewConferenceOpen(true);
      toast.error("Crie uma conferÃªncia antes de bipar produtos");
      return;
    }
    if (activeConference.status === "finalizada") {
      toast.error("ConferÃªncia finalizada nÃ£o pode ser editada");
      return;
    }

    const code = (rawCode ?? barcode).trim();
    if (!code) return;

    setSaving(true);
    try {
      const options = await searchConferenceProduct(code, activeConference.estoqueId ?? "all");
      if (options.length > 1) {
        setPendingBarcode(code);
        setStockOptions(options);
        return;
      }

      const [option] = options;
      if (!option) {
        setProductPreview(null);
        toast.error("Produto nÃ£o encontrado");
        return;
      }

      setBarcode(code);
      setProductPreview(option);
      toast.success("Produto localizado");
    } catch (err: unknown) {
      setProductPreview(null);
      toast.error(err instanceof Error ? err.message : "Erro ao buscar produto");
    } finally {
      setSaving(false);
    }
  };

  const removeConferenceItem = async (itemId: number) => {
    if (!activeConference) return;
    setSaving(true);
    try {
      await deleteConferenceItem(activeConference.id, itemId);
      const updated = await getConference(activeConference.id);
      setActiveConference(updated);
      await refreshHistory();
      toast.success("Item removido");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover item");
    } finally {
      setSaving(false);
    }
  };

  const updateLocalItemCount = (itemId: number, value: number) => {
    setActiveConference((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id !== itemId) return item;
          const difference = value - item.systemQuantity;
          return {
            ...item,
            countedQuantity: value,
            difference,
            status: difference === 0 ? "ok" : difference > 0 ? "sobra" : "falta",
          };
        }),
      };
    });
  };

  const finishConference = async (id = activeConference?.id) => {
    if (!id) return;
    setSaving(true);
    try {
      const finished = await finalizeConference(id);
      setActiveConference(finished);
      await refreshHistory();
      toast.success("Conferência finalizada");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao finalizar conferência");
    } finally {
      setSaving(false);
    }
  };

  const printInventory = () => openPrintWindow("Relatório de Inventário", inventoryPrintHtml(inventoryItems, inventoryStockName));
  const printConference = async (conference?: Conference | ConferenceHistory) => {
    const full = "items" in (conference ?? {}) ? (conference as Conference) : conference ? await getConference(conference.id) : activeConference;
    if (!full) return;
    openPrintWindow("Relatório de Conferência de Estoque", conferencePrintHtml(full));
  };
  const exportConference = async (conference?: Conference | ConferenceHistory) => {
    const full = "items" in (conference ?? {}) ? (conference as Conference) : conference ? await getConference(conference.id) : activeConference;
    if (!full) return;
    exportConferencePdf(full);
  };

  return (
    <>
      <PageHeader
        title="Inventário"
        subtitle="Visão física e virtual do estoque, com conferência auditável por produto."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={loadAll} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button className="gap-2" onClick={() => setNewConferenceOpen(true)}>
              <Plus className="h-4 w-4" /> Criar nova conferência
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produtos no filtro" value={inventorySummary.products} icon={PackageCheck} />
        <StatCard label="Unidades virtuais" value={inventorySummary.units} icon={ClipboardList} tone="success" />
        <StatCard label="Estoque baixo" value={inventorySummary.low} icon={AlertTriangle} tone="warning" />
        <StatCard label="Críticos" value={inventorySummary.critical} icon={XCircle} tone="destructive" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6 space-y-4">
        <TabsList>
          <TabsTrigger value="estoque">Estoque Atual</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="estoque">
          <Card>
            <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <CardTitle>Estoque atual</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Posição virtual consolidada por estoque e validade.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="w-full min-w-56 space-y-2">
                  <Label>Estoque exibido</Label>
                  <Select value={inventoryStock} onValueChange={setInventoryStock}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os estoques</SelectItem>
                      {activeEstoques.map((estoque) => (
                        <SelectItem key={estoque.id} value={String(estoque.id)}>
                          {estoque.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="gap-2" onClick={printInventory}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => exportInventoryPdf(inventoryItems, inventoryStockName)}>
                  <Download className="h-4 w-4" /> Exportar PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {inventoryItems.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nenhum produto encontrado" />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Estoque atual</TableHead>
                        <TableHead>Estoque mínimo</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Estoques</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryItems.map((item) => (
                        <TableRow key={`${item.productId}-${item.estoqueId ?? "all"}`}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">{item.categoryName ?? "Sem categoria"}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.barcode}</TableCell>
                          <TableCell className="font-semibold">{item.stock}</TableCell>
                          <TableCell>{item.minStock}</TableCell>
                          <TableCell>{formatDate(item.expirationDate)}</TableCell>
                          <TableCell>{inventoryStatusBadge(item.status)}</TableCell>
                          <TableCell className="min-w-48">
                            {inventoryStock === "all"
                              ? item.estoques.map((stock) => `${stock.estoqueNome} (${stock.stock})`).join(", ")
                              : item.estoqueNome}
                          </TableCell>
                          <TableCell>{money(item.stock * item.price)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conferencia">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Conferência ativa</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeConference
                      ? `#${activeConference.id} · ${activeConference.estoqueNome ?? "Todos os estoques"} · ${activeConference.status}`
                      : "Crie ou edite uma conferência para começar a contagem física."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => setNewConferenceOpen(true)}>
                    <Plus className="h-4 w-4" /> Nova
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={saveConferenceMeta} disabled={!activeConference || activeConference.status === "finalizada" || saving}>
                    <Save className="h-4 w-4" /> Salvar
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => printConference()} disabled={!activeConference}>
                    <Printer className="h-4 w-4" /> Imprimir
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => exportConference()} disabled={!activeConference}>
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button className="gap-2" onClick={() => finishConference()} disabled={!activeConference || activeConference.status === "finalizada" || saving}>
                    <ClipboardCheck className="h-4 w-4" /> Finalizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeConference ? (
                  <>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto] lg:items-end">
                      <BarcodeInput
                        value={barcode}
                        onChange={(value) => {
                          setBarcode(value);
                          if (productPreview && value.trim() !== productPreview.barcode) {
                            setProductPreview(null);
                          }
                        }}
                        onSubmit={previewConferenceProduct}
                        label="Código de barras"
                        placeholder="Bipe ou digite o código"
                      />
                      <div className="space-y-2">
                        <Label>Quantidade contada</Label>
                        <Input
                          type="number"
                          min={0}
                          value={countedQuantity}
                          onChange={(event) => setCountedQuantity(event.target.value)}
                          disabled={activeConference.status === "finalizada"}
                        />
                      </div>
                      <Button className="gap-2" onClick={() => addConferenceItem()} disabled={saving || activeConference.status === "finalizada"}>
                        <Search className="h-4 w-4" /> Conferir
                      </Button>
                    </div>
                    {productPreview && (
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="text-xs font-medium uppercase text-muted-foreground">
                              Produto localizado
                            </div>
                            <div className="mt-1 text-lg font-semibold">{productPreview.productName}</div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{productPreview.barcode}</span>
                              <span>{productPreview.estoqueNome}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
                            <div className="rounded-md border bg-background px-3 py-2">
                              <div className="text-[11px] text-muted-foreground">Sistema</div>
                              <div className="text-base font-bold">{productPreview.systemQuantity}</div>
                            </div>
                            <div className="rounded-md border bg-background px-3 py-2">
                              <div className="text-[11px] text-muted-foreground">Contado</div>
                              <div className="text-base font-bold">{Number(countedQuantity) || 0}</div>
                            </div>
                            <div className="rounded-md border bg-background px-3 py-2">
                              <div className="text-[11px] text-muted-foreground">DiferenÃ§a</div>
                              <div
                                className={`text-base font-bold ${
                                  (Number(countedQuantity) || 0) - productPreview.systemQuantity === 0
                                    ? "text-success"
                                    : (Number(countedQuantity) || 0) - productPreview.systemQuantity > 0
                                      ? "text-warning"
                                      : "text-destructive"
                                }`}
                              >
                                {(Number(countedQuantity) || 0) - productPreview.systemQuantity > 0
                                  ? `+${(Number(countedQuantity) || 0) - productPreview.systemQuantity}`
                                  : (Number(countedQuantity) || 0) - productPreview.systemQuantity}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Observação</Label>
                      <Textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={activeConference.status === "finalizada"}
                        placeholder="Notas internas da conferência"
                      />
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Estoque</TableHead>
                            <TableHead>Sistema</TableHead>
                            <TableHead>Contado</TableHead>
                            <TableHead>Diferença</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeConference.items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7}>
                                <EmptyState icon={ClipboardList} title="Nenhum item conferido" description="Bipe um produto e informe a quantidade física contada." />
                              </TableCell>
                            </TableRow>
                          ) : (
                            activeConference.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <div className="font-medium">{item.productName}</div>
                                  <div className="font-mono text-xs text-muted-foreground">{item.barcode}</div>
                                </TableCell>
                                <TableCell>{item.estoqueNome ?? "-"}</TableCell>
                                <TableCell>{item.systemQuantity}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    className="w-24"
                                    value={item.countedQuantity}
                                    disabled={activeConference.status === "finalizada" || saving}
                                    onChange={(event) => {
                                      updateLocalItemCount(item.id, Math.max(0, Number(event.target.value) || 0));
                                    }}
                                    onBlur={(event) =>
                                      saveConferenceItem(activeConference.id, {
                                        codigo_barras: item.barcode,
                                        quantidade_contada: Number(event.target.value),
                                        estoque_id: item.estoqueId,
                                      })
                                        .then((updated) => {
                                          setActiveConference(updated);
                                          refreshHistory();
                                        })
                                        .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Erro ao atualizar contagem"))
                                    }
                                  />
                                </TableCell>
                                <TableCell className={item.difference === 0 ? "" : item.difference > 0 ? "text-warning" : "text-destructive"}>
                                  {item.difference > 0 ? `+${item.difference}` : item.difference}
                                </TableCell>
                                <TableCell>{conferenceStatusBadge(item.status)}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    disabled={activeConference.status === "finalizada" || saving}
                                    onClick={() => removeConferenceItem(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="Nenhuma conferência ativa"
                    description="Crie uma nova conferência ou continue uma conferência aberta pelo histórico."
                    action={<Button onClick={() => setNewConferenceOpen(true)}>Criar nova conferência</Button>}
                  />
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <StatCard label="Itens conferidos" value={conferenceTotals.items} icon={ClipboardList} />
              <StatCard label="Unidades contadas" value={conferenceTotals.countedUnits} icon={PackageCheck} tone="success" />
              <StatCard label="Divergências" value={conferenceTotals.divergences} icon={AlertTriangle} tone="warning" />
              <StatCard label="Faltas / Sobras" value={`${conferenceTotals.shortages} / ${conferenceTotals.surpluses}`} icon={XCircle} tone="destructive" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de conferências</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={FileText} title="Sem conferências salvas" />
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead>Atualizada em</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Itens</TableHead>
                        <TableHead>Divergências</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">#{row.id}</TableCell>
                          <TableCell>{row.estoqueNome ?? "Todos os estoques"}</TableCell>
                          <TableCell>{row.userName ?? "-"}</TableCell>
                          <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                          <TableCell>{formatDateTime(row.updatedAt)}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === "finalizada" ? "secondary" : "default"}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.itemsCount}</TableCell>
                          <TableCell>{row.divergencesCount}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => loadConference(row.id)}>
                                {row.status === "finalizada" ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printConference(row)}>
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportConference(row)}>
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={row.status === "finalizada" || saving}
                                onClick={() => finishConference(row.id)}
                              >
                                <ClipboardCheck className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={newConferenceOpen} onOpenChange={setNewConferenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova conferência</DialogTitle>
            <DialogDescription>Escolha o estoque que será contado fisicamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Estoque</Label>
            <Select value={newConferenceStock} onValueChange={setNewConferenceStock}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estoques</SelectItem>
                {activeEstoques.map((estoque) => (
                  <SelectItem key={estoque.id} value={String(estoque.id)}>
                    {estoque.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewConferenceOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={startConference} disabled={saving}>
              Criar conferência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOptions.length > 1} onOpenChange={(open) => !open && setStockOptions([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolha o estoque do produto</DialogTitle>
            <DialogDescription>Este código existe em mais de um estoque.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {stockOptions.map((option) => (
              <Button
                key={option.estoqueId}
                variant="outline"
                className="h-auto justify-between gap-4 p-3"
                onClick={() => {
                  setBarcode(pendingBarcode);
                  setProductPreview(option);
                  setStockOptions([]);
                }}
              >
                <span className="text-left">
                  <span className="block font-medium">{option.estoqueNome}</span>
                  <span className="block text-xs text-muted-foreground">{option.productName}</span>
                </span>
                <span className="text-sm">Sistema: {option.systemQuantity}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
