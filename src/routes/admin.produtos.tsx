import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Package,
  AlertTriangle,
  XCircle,
  DollarSign,
  Search,
  Filter,
  FolderOpen,
  Plus,
  Star,
  Pencil,
  RefreshCw,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarcodeInput } from "@/components/scanner/BarcodeInput";
import { WasteDialog } from "@/components/waste/WasteDialog";
import { toast } from "sonner";
import { getExpirationStatus, isExpired } from "@/lib/expiration";
import {
  adjustmentProductLabel,
  type AdjustmentProductOption,
  type AdjustmentRow,
  createAdjustmentRow,
  adjustmentRequiresLot,
  getAdjustmentProduct,
  getAdjustmentStock,
  isAdjustmentRowTouched,
  filterProducts as applyProductFilters,
  isAdjustmentRowComplete,
  validateAdjustmentRow,
} from "@/lib/productRules";
import {
  getProducts,
  updateProduct,
  deleteProduct,
  setProductStatus,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getEstoques,
  getProductLots,
  adjustStock,
  updateProductLot,
} from "@/services/api";
import type { Product, Category, Estoque, ProductLot, LotStatus } from "@/types";

type ProductFilters = {
  categoryId: string;
  status: string;
  stockStatus: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  maxStock: string;
  unit: string;
};

const emptyFilters: ProductFilters = {
  categoryId: "all",
  status: "all",
  stockStatus: "all",
  minPrice: "",
  maxPrice: "",
  minStock: "",
  maxStock: "",
  unit: "",
};

const adjustmentReasons = [
  "Contagem fisica / inventario",
  "Correcao de lancamento",
  "Produto encontrado no estoque",
  "Erro de cadastro de saldo",
  "Ajuste administrativo",
  "Outro",
];

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function expirationStatusBadge(status: LotStatus) {
  const descriptions: Record<LotStatus, string> = {
    vencido: "Este produto já passou da data de validade.",
    proximo_vencimento: "Este produto vence em até 7 dias. Priorize a saída ou conferência.",
    validade_15: "Este produto vence em até 15 dias. Acompanhe com atenção.",
    validade_30: "Este produto vence em até 30 dias. Comece a acompanhar a validade.",
    ok: "Este produto está dentro do prazo de validade.",
    sem_validade: "Este produto não possui validade cadastrada.",
  };

  const withTooltip = (badge: ReactNode) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help">{badge}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center">
          {descriptions[status]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (status === "vencido") return withTooltip(<Badge variant="destructive">Vencido</Badge>);
  if (status === "proximo_vencimento") {
    return withTooltip(
      <Badge variant="secondary" className="bg-destructive/15 text-destructive border-destructive/30">
        Próximo do vencimento
      </Badge>,
    );
  }
  if (status === "validade_15") {
    return withTooltip(
      <Badge variant="secondary" className="bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300">
        Alerta
      </Badge>,
    );
  }
  if (status === "validade_30") {
    return withTooltip(
      <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
        Atenção
      </Badge>,
    );
  }
  if (status === "sem_validade") return withTooltip(<Badge variant="outline">Sem validade</Badge>);
  return withTooltip(<Badge variant="secondary">OK</Badge>);
}

function ExpirationBadges({ product }: { product: Product }) {
  if (!product.requiresExpiration) {
    return null;
  }

  const status = getExpirationStatus(product.expirationDate);
  if (status === "ok" || status === "sem_validade") {
    return null;
  }

  return (
    <div className="flex w-full flex-wrap justify-center gap-1.5">
      {expirationStatusBadge(status)}
    </div>
  );
}

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({ meta: [{ title: "Produtos · Zytrex Inventory" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("all");
  const [query, setQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [wasteProduct, setWasteProduct] = useState<Product | null>(null);
  const [lotProduct, setLotProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(emptyFilters);
  const [adjustmentMode, setAdjustmentMode] = useState(false);
  const [adjustmentCatalog, setAdjustmentCatalog] = useState<AdjustmentProductOption[]>([]);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentRow[]>([createAdjustmentRow()]);
  const [adjustmentLots, setAdjustmentLots] = useState<Record<string, ProductLot[]>>({});
  const [loadingAdjustmentCatalog, setLoadingAdjustmentCatalog] = useState(false);
  const [savingAdjustments, setSavingAdjustments] = useState(false);

  const loadCategories = () => {
    getCategories().then(setCategories);
  };

  const loadProducts = () => {
    getProducts(selectedEstoqueId).then(setProducts);
  };

  useEffect(() => {
    getEstoques().then((data) => {
      setEstoques(data);
    });
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEstoqueId]);

  const filtered = applyProductFilters(products, query, appliedFilters);

  const activeFilterCount = Object.entries(appliedFilters).filter(([key, value]) => {
    const emptyValue = emptyFilters[key as keyof ProductFilters];
    return value !== emptyValue;
  }).length;

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const loadAdjustmentCatalog = async () => {
    setLoadingAdjustmentCatalog(true);
    try {
      const activeStocks = estoques.filter((estoque) => estoque.ativo);
      const productsByStock = await Promise.all(
        activeStocks.map(async (estoque) => ({
          estoque,
          products: await getProducts(estoque.id),
        })),
      );
      const map = new Map<number, AdjustmentProductOption>();
      productsByStock.forEach(({ estoque, products: stockProducts }) => {
        stockProducts
          .filter((product) => product.active)
          .forEach((product) => {
            const current =
              map.get(product.id) ??
              {
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                unit: product.unit,
                stocks: [],
              };
            current.stocks.push({
              id: estoque.id,
              nome: estoque.nome,
              stock: product.stock,
              requiresExpiration: product.requiresExpiration,
            });
            map.set(product.id, current);
          });
      });
      setAdjustmentCatalog(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar produtos para ajuste");
    } finally {
      setLoadingAdjustmentCatalog(false);
    }
  };

  const enterAdjustmentMode = () => {
    setAdjustmentMode(true);
    setFiltersOpen(false);
    setAdjustmentRows([createAdjustmentRow()]);
    setAdjustmentLots({});
    loadAdjustmentCatalog();
  };

  const exitAdjustmentMode = () => {
    setAdjustmentMode(false);
    setAdjustmentRows([createAdjustmentRow()]);
    setAdjustmentLots({});
  };

  const updateAdjustmentRow = (id: string, patch: Partial<AdjustmentRow>) => {
    setAdjustmentRows((rows) => {
      const next = rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
      const last = next[next.length - 1];
      if (last && isAdjustmentRowComplete(last, adjustmentCatalog, adjustmentLots[last.id] ?? [])) {
        return [...next, createAdjustmentRow()];
      }
      return next;
    });
  };

  const selectAdjustmentProduct = (row: AdjustmentRow, value: string) => {
    const selected = adjustmentCatalog.find(
      (product) => adjustmentProductLabel(product) === value || product.barcode === value,
    );
    updateAdjustmentRow(row.id, {
      productQuery: value,
      productId: selected ? String(selected.id) : "",
      stockId: "",
      lotId: "",
      quantityFinal: "",
    });
    setAdjustmentLots((current) => ({ ...current, [row.id]: [] }));
  };

  const selectAdjustmentStock = async (row: AdjustmentRow, stockId: string) => {
    updateAdjustmentRow(row.id, { stockId, lotId: "", quantityFinal: "" });
    if (!row.productId || !stockId) return;
    try {
      const lots = await getProductLots(Number(row.productId), stockId);
      setAdjustmentLots((current) => ({ ...current, [row.id]: lots }));
    } catch {
      setAdjustmentLots((current) => ({ ...current, [row.id]: [] }));
      toast.error("Erro ao carregar lotes do produto");
    }
  };

  const saveAdjustments = async () => {
    const filledRows = adjustmentRows.filter(isAdjustmentRowTouched);
    if (!filledRows.length) {
      toast.error("Informe pelo menos um ajuste");
      return;
    }

    for (const row of filledRows) {
      const validation = validateAdjustmentRow(row, adjustmentCatalog, adjustmentLots[row.id] ?? []);
      if (validation) {
        toast.error(validation);
        return;
      }
    }

    setSavingAdjustments(true);
    try {
      await adjustStock({
        itens: filledRows.map((row) => ({
          produto_id: Number(row.productId),
          estoque_id: Number(row.stockId),
          lote_id: row.lotId && row.lotId !== "none" ? Number(row.lotId) : null,
          quantidade_final: Number(row.quantityFinal),
          motivo: row.reason,
        })),
      });
      toast.success("Ajuste de estoque registrado");
      exitAdjustmentMode();
      loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar ajustes");
    } finally {
      setSavingAdjustments(false);
    }
  };

  const toggleProductStatus = async (product: Product, active: boolean) => {
    if (product.requiresExpiration && isExpired(product.expirationDate)) {
      toast.error("Produto vencido fica fora do catalogo automaticamente");
      return;
    }

    try {
      const updated = await setProductStatus(product.id, active);
      setProducts((items) =>
        items.map((item) => (item.id === product.id ? { ...item, active: updated.active } : item)),
      );
      toast.success(active ? "Produto ativado" : "Produto desativado");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar produto");
    }
  };

  const removeProduct = async (product: Product) => {
    setDeletingProductId(product.id);
    try {
      await deleteProduct(product.id);
      setProducts((items) => items.filter((item) => item.id !== product.id));
      setProductToDelete(null);
      toast.success("Produto excluido");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir produto");
    } finally {
      setDeletingProductId(null);
    }
  };

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const noStock = products.filter((p) => p.stock === 0).length;
  const total = products.reduce((s, p) => s + p.price * p.stock, 0);

  if (pathname === "/admin/produtos/cadastro") {
    return <Outlet />;
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle={`${products.length} ${products.length === 1 ? "item cadastrado" : "itens cadastrados"}`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total de produtos" value={products.length} icon={Package} />
        <StatCard label="Estoque baixo" value={lowStock} icon={AlertTriangle} tone="warning" />
        <StatCard label="Sem estoque" value={noStock} icon={XCircle} tone="destructive" />
        <StatCard
          label="Total em estoque"
          value={money(total)}
          icon={DollarSign}
          tone="success"
          valueClassName="whitespace-nowrap text-[clamp(1rem,4.4vw,1.25rem)] sm:text-2xl"
        />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
          {adjustmentMode ? (
            <>
              <div className="min-w-[220px] flex-1">
                <div className="font-semibold">Ajuste de estoque</div>
                <div className="hidden text-sm text-muted-foreground sm:block">
                  Informe o saldo final por produto, estoque e lote.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={exitAdjustmentMode} disabled={savingAdjustments}>
                Cancelar
              </Button>
              <Button size="sm" className="gap-2" onClick={saveAdjustments} disabled={savingAdjustments}>
                {savingAdjustments ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Salvar ajustes
              </Button>
            </>
          ) : (
            <>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Item ou código"
              className="pl-9"
            />
          </div>
          <Button
            variant={filtersOpen ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Select value={selectedEstoqueId} onValueChange={setSelectedEstoqueId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Selecione o estoque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estoques</SelectItem>
              {estoques.map((estoque) => (
                <SelectItem key={estoque.id} value={String(estoque.id)}>
                  {estoque.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={enterAdjustmentMode}>
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Ajuste de estoque</span>
            <span className="sm:hidden">Ajuste</span>
          </Button>
          <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Categoria</span>
              </Button>
            </DialogTrigger>
            <NewCategoryDialog
              onCreated={() => {
                setCategoryOpen(false);
                loadCategories();
                toast.success("Categoria cadastrada");
              }}
            />
          </Dialog>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => navigate({ to: "/admin/produtos/cadastro" })}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Produto</span>
          </Button>
          <Dialog
            open={!!editingProduct}
            onOpenChange={(isOpen) => {
              if (!isOpen) setEditingProduct(null);
            }}
          >
            {editingProduct && (
              <EditProductDialog
                product={editingProduct}
                categories={categories}
                estoqueId={selectedEstoqueId}
                onProductsChanged={loadProducts}
                onUpdated={() => {
                  setEditingProduct(null);
                  loadProducts();
                }}
              />
            )}
          </Dialog>
            </>
          )}
        </div>

        {filtersOpen && !adjustmentMode && (
          <div className="border-b bg-muted/20 p-3 sm:p-4">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={draftFilters.categoryId}
                  onValueChange={(value) =>
                    setDraftFilters((filters) => ({ ...filters, categoryId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Catálogo</Label>
                <Select
                  value={draftFilters.status}
                  onValueChange={(value) =>
                    setDraftFilters((filters) => ({ ...filters, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Situação de estoque</Label>
                <Select
                  value={draftFilters.stockStatus}
                  onValueChange={(value) =>
                    setDraftFilters((filters) => ({ ...filters, stockStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="available">Com estoque</SelectItem>
                    <SelectItem value="low_stock">Estoque baixo</SelectItem>
                    <SelectItem value="no_stock">Sem estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input
                  value={draftFilters.unit}
                  onChange={(e) =>
                    setDraftFilters((filters) => ({ ...filters, unit: e.target.value }))
                  }
                  placeholder="Ex: un, kg, cx"
                />
              </div>

              <div className="space-y-2">
                <Label>Preço mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftFilters.minPrice}
                  onChange={(e) =>
                    setDraftFilters((filters) => ({ ...filters, minPrice: e.target.value }))
                  }
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Preço máximo</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draftFilters.maxPrice}
                  onChange={(e) =>
                    setDraftFilters((filters) => ({ ...filters, maxPrice: e.target.value }))
                  }
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Estoque mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  value={draftFilters.minStock}
                  onChange={(e) =>
                    setDraftFilters((filters) => ({ ...filters, minStock: e.target.value }))
                  }
                  placeholder="Quantidade mínima"
                />
              </div>

              <div className="space-y-2">
                <Label>Estoque máximo</Label>
                <Input
                  type="number"
                  min={0}
                  value={draftFilters.maxStock}
                  onChange={(e) =>
                    setDraftFilters((filters) => ({ ...filters, maxStock: e.target.value }))
                  }
                  placeholder="Quantidade máxima"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
              <Button size="sm" className="gap-2" onClick={applyFilters}>
                <Filter className="h-4 w-4" />
                Aplicar filtros
              </Button>
            </div>
          </div>
        )}

        {adjustmentMode ? (
          <AdjustmentPanel
            rows={adjustmentRows}
            catalog={adjustmentCatalog}
            lotsByRow={adjustmentLots}
            loading={loadingAdjustmentCatalog}
            onProductChange={selectAdjustmentProduct}
            onStockChange={selectAdjustmentStock}
            onRowChange={updateAdjustmentRow}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre seu primeiro produto para começar a controlar o estoque."
            action={
              <Button
                onClick={() => navigate({ to: "/admin/produtos/cadastro" })}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Cadastrar produto
              </Button>
            }
          />
        ) : (
          <>
          <div className="divide-y md:hidden">
            {filtered.map((p) => (
              <div key={p.id} className="p-3" onClick={() => setLotProduct(p)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Star
                          className={`h-3.5 w-3.5 shrink-0 ${p.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`}
                        />
                        <div className="truncate text-sm font-medium">{p.name}</div>
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {p.barcode}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{p.categoryName ?? "Sem categoria"}</span>
                        <span
                          className={
                            p.stock === 0
                              ? "font-semibold text-destructive"
                              : p.stock <= p.minStock
                                ? "font-semibold text-warning"
                                : "font-semibold text-foreground"
                          }
                        >
                          {p.stock} em estoque
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <div className="text-sm font-semibold">{money(p.price)}</div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setWasteProduct(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingProduct(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Validade</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Catálogo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => setLotProduct(p)}
                  >
                    <TableCell>
                      <Star
                        className={`h-4 w-4 ${p.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.barcode}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-1.5">
                        <div>{p.categoryName ?? "â€”"}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {p.requiresExpiration && p.expirationDate ? (
                        <div className="flex w-full flex-col items-center gap-1.5">
                          <div>{formatDate(p.expirationDate)}</div>
                          <ExpirationBadges product={p} />
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm font-medium ${
                          p.stock === 0
                            ? "text-destructive"
                            : p.stock <= p.minStock
                              ? "text-warning"
                              : ""
                        }`}
                      >
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">R$ {p.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        <Switch
                          checked={
                            p.active && !(p.requiresExpiration && isExpired(p.expirationDate))
                          }
                          disabled={p.requiresExpiration && isExpired(p.expirationDate)}
                          onCheckedChange={(checked) => toggleProductStatus(p, checked)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {p.requiresExpiration && isExpired(p.expirationDate)
                            ? "Vencido"
                            : p.active
                              ? "Sim"
                              : "Não"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            setWasteProduct(p);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingProduct(p);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {(p.movementsCount ?? 0) === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={deletingProductId === p.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setProductToDelete(p);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
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
      <ProductLotsDialog
        product={lotProduct}
        estoqueId={selectedEstoqueId}
        onOpenChange={(open) => {
          if (!open) setLotProduct(null);
        }}
      />
      <WasteDialog
        open={!!wasteProduct}
        onOpenChange={(isOpen) => {
          if (!isOpen) setWasteProduct(null);
        }}
        estoques={estoques}
        initialBarcode={wasteProduct?.barcode ?? ""}
        onSaved={loadProducts}
      />
      <AlertDialog
        open={!!productToDelete}
        onOpenChange={(isOpen) => {
          if (!isOpen) setProductToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o produto "{productToDelete?.name}" do cadastro. Ela só é permitida
              quando o produto ainda não possui movimentações registradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingProductId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!productToDelete || !!deletingProductId}
              onClick={(event) => {
                event.preventDefault();
                if (productToDelete) removeProduct(productToDelete);
              }}
            >
              Excluir produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AdjustmentPanel({
  rows,
  catalog,
  lotsByRow,
  loading,
  onProductChange,
  onStockChange,
  onRowChange,
}: {
  rows: AdjustmentRow[];
  catalog: AdjustmentProductOption[];
  lotsByRow: Record<string, ProductLot[]>;
  loading: boolean;
  onProductChange: (row: AdjustmentRow, value: string) => void;
  onStockChange: (row: AdjustmentRow, stockId: string) => void;
  onRowChange: (id: string, patch: Partial<AdjustmentRow>) => void;
}) {
  const productOptions = useMemo(() => catalog.map(adjustmentProductLabel), [catalog]);

  if (loading) {
    return (
      <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Carregando produtos para ajuste...
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-muted/15 p-3 sm:p-4">
      <div className="hidden rounded-lg border bg-background p-4 text-sm text-muted-foreground sm:block">
        A quantidade informada será o saldo final do lote ou produto selecionado. Cada linha salva
        uma movimentação de ajuste com usuário, motivo, estoque antes e estoque depois.
      </div>

      <div className="divide-y overflow-hidden rounded-lg border bg-background md:hidden">
        {rows.map((row, index) => {
          const product = getAdjustmentProduct(catalog, row);
          const stock = getAdjustmentStock(catalog, row);
          const lots = lotsByRow[row.id] ?? [];
          const requiresLot = adjustmentRequiresLot(row, catalog, lots);

          return (
            <div key={row.id} className="space-y-3 p-3">
              <div>
                <div className="text-sm font-semibold">Ajuste {index + 1}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Informe o saldo final do produto selecionado.
                </div>
              </div>

              <div className="space-y-2">
                <Label>Produto</Label>
                <MobileAdjustmentProductPicker
                  row={row}
                  catalog={catalog}
                  onProductChange={onProductChange}
                />
              </div>

              <div className="space-y-2">
                <Label>Estoque</Label>
                <Select
                  value={row.stockId}
                  onValueChange={(value) => onStockChange(row, value)}
                  disabled={!product}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={product ? "Selecione" : "Escolha produto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {product?.stocks.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.nome} - atual {item.stock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lote</Label>
                <Select
                  value={row.lotId}
                  onValueChange={(value) => onRowChange(row.id, { lotId: value })}
                  disabled={!row.stockId || lots.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !row.stockId
                          ? "Escolha estoque"
                          : lots.length === 0
                            ? "Sem lote"
                            : requiresLot
                              ? "Selecione lote"
                              : "Opcional"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {!requiresLot && <SelectItem value="none">Sem lote</SelectItem>}
                    {lots.map((lot) => (
                      <SelectItem key={lot.id} value={String(lot.id)}>
                        {lot.lot} - atual {lot.quantity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantidade final</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.quantityFinal}
                  onChange={(event) =>
                    onRowChange(row.id, { quantityFinal: event.target.value })
                  }
                  placeholder={stock ? String(stock.stock) : "0"}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select
                  value={row.reason}
                  onValueChange={(value) => onRowChange(row.id, { reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {index === rows.length - 1 && !isAdjustmentRowTouched(row) ? (
                  <div className="text-xs text-muted-foreground">
                    Deixe este ajuste vazio para finalizar.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-background md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">Produto</TableHead>
              <TableHead className="min-w-56">Estoque</TableHead>
              <TableHead className="min-w-56">Lote</TableHead>
              <TableHead className="min-w-40 text-right">Quantidade final</TableHead>
              <TableHead className="min-w-64">Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const product = getAdjustmentProduct(catalog, row);
              const stock = getAdjustmentStock(catalog, row);
              const lots = lotsByRow[row.id] ?? [];
              const requiresLot = adjustmentRequiresLot(row, catalog, lots);

              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      list={`adjustment-products-${row.id}`}
                      value={row.productQuery}
                      onChange={(event) => onProductChange(row, event.target.value)}
                      placeholder="Digite nome ou código"
                    />
                    <datalist id={`adjustment-products-${row.id}`}>
                      {productOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.stockId}
                      onValueChange={(value) => onStockChange(row, value)}
                      disabled={!product}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={product ? "Selecione" : "Escolha produto"} />
                      </SelectTrigger>
                      <SelectContent>
                        {product?.stocks.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.nome} - atual {item.stock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.lotId}
                      onValueChange={(value) => onRowChange(row.id, { lotId: value })}
                      disabled={!row.stockId || lots.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !row.stockId
                              ? "Escolha estoque"
                              : lots.length === 0
                                ? "Sem lote"
                                : requiresLot
                                  ? "Selecione lote"
                                  : "Opcional"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {!requiresLot && <SelectItem value="none">Sem lote</SelectItem>}
                        {lots.map((lot) => (
                          <SelectItem key={lot.id} value={String(lot.id)}>
                            {lot.lot} - atual {lot.quantity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={row.quantityFinal}
                      onChange={(event) =>
                        onRowChange(row.id, { quantityFinal: event.target.value })
                      }
                      placeholder={stock ? String(stock.stock) : "0"}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.reason}
                      onValueChange={(value) => onRowChange(row.id, { reason: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {adjustmentReasons.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {index === rows.length - 1 && !isAdjustmentRowTouched(row) ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Deixe esta linha vazia para finalizar.
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MobileAdjustmentProductPicker({
  row,
  catalog,
  onProductChange,
}: {
  row: AdjustmentRow;
  catalog: AdjustmentProductOption[];
  onProductChange: (row: AdjustmentRow, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(row.productQuery);
  const selectedProduct = getAdjustmentProduct(catalog, row);
  const displayValue = selectedProduct
    ? adjustmentProductLabel(selectedProduct)
    : row.productQuery.trim();

  useEffect(() => {
    if (open) setQuery(row.productQuery);
  }, [open, row.productQuery]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return catalog.slice(0, 40);

    return catalog
      .filter((product) => {
        const label = adjustmentProductLabel(product).toLowerCase();
        return label.includes(normalizedQuery) || product.barcode.includes(normalizedQuery);
      })
      .slice(0, 40);
  }, [catalog, query]);

  function selectProduct(product: AdjustmentProductOption) {
    onProductChange(row, adjustmentProductLabel(product));
    setOpen(false);
  }

  function clearProduct() {
    onProductChange(row, "");
    setQuery("");
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-10 w-full justify-start whitespace-normal px-3 py-2 text-left"
        onClick={() => setOpen(true)}
      >
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          {displayValue ? (
            <span className="line-clamp-2 text-sm font-medium leading-snug">{displayValue}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Selecionar produto</span>
          )}
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[86vh] flex-col gap-4 rounded-t-2xl px-4 pb-4 pt-5"
        >
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>Selecionar produto</SheetTitle>
            <SheetDescription>Busque pelo nome ou pelo código do produto.</SheetDescription>
          </SheetHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome ou código"
              className="pl-9"
              autoFocus
            />
          </div>

          <ScrollArea className="min-h-0 flex-1 pr-1">
            <div className="space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = String(product.id) === row.productId;
                  const totalStock = product.stocks.reduce((total, stock) => total + stock.stock, 0);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => selectProduct(product)}
                    >
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium leading-snug">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {product.barcode} | {product.unit} | estoque total {totalStock}
                        </span>
                      </span>
                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {displayValue ? (
            <Button type="button" variant="ghost" className="w-full" onClick={clearProduct}>
              <X className="h-4 w-4" />
              Limpar produto
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProductLotsDialog({
  product,
  estoqueId,
  onOpenChange,
}: {
  product: Product | null;
  estoqueId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!product) return;
    setLoading(true);
    getProductLots(product.id, estoqueId)
      .then(setLots)
      .catch(() => toast.error("Erro ao carregar lotes"))
      .finally(() => setLoading(false));
  }, [product, estoqueId]);

  const statusBadge = (lot: ProductLot) => expirationStatusBadge(lot.status);

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lotes de {product?.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-sm text-muted-foreground">Carregando lotes...</div>
        ) : lots.length === 0 ? (
          <div className="py-8 text-sm text-muted-foreground">Nenhum lote cadastrado.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>{lot.estoqueNome}</TableCell>
                    <TableCell className="font-mono text-xs">{lot.lot}</TableCell>
                    <TableCell>{lot.quantity}</TableCell>
                    <TableCell>{lot.expirationDate ? formatDate(lot.expirationDate) : "â€”"}</TableCell>
                    <TableCell>{statusBadge(lot)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [requireValidity, setRequireValidity] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRequireValidity, setEditingRequireValidity] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      setCategories(await getCategories());
    } catch {
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Informe o nome da categoria");
      return;
    }

    setLoading(true);
    try {
      await createCategory({ nome: name.trim(), exige_validade: requireValidity });
      setName("");
      setRequireValidity(false);
      await loadCategories();
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar categoria");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.nome);
    setEditingRequireValidity(category.exigeValidade);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
    setEditingRequireValidity(false);
  };

  const saveEditing = async (category: Category) => {
    if (!editingName.trim()) {
      toast.error("Informe o nome da categoria");
      return;
    }

    setUpdatingId(category.id);
    try {
      await updateCategory(category.id, {
        nome: editingName.trim(),
        exige_validade: editingRequireValidity,
      });
      await loadCategories();
      cancelEditing();
      toast.success("Categoria atualizada");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar categoria");
    } finally {
      setUpdatingId(null);
    }
  };

  const removeCategory = async (category: Category) => {
    if (!window.confirm(`Excluir a categoria "${category.nome}"?`)) {
      return;
    }

    setDeletingId(category.id);
    try {
      await deleteCategory(category.id);
      await loadCategories();
      toast.success("Categoria excluida");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir categoria");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Cadastrar categoria</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Nome da categoria</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Bebidas"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="category-require-validity">Exige validade</Label>
          <Switch
            id="category-require-validity"
            checked={requireValidity}
            onCheckedChange={setRequireValidity}
          />
        </div>

        <div className="space-y-2">
          <Label>Categorias cadastradas</Label>
          <div className="rounded-md border bg-muted/30">
            {loadingCategories ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Carregando categorias...
              </div>
            ) : categories.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Nenhuma categoria cadastrada.
              </div>
            ) : (
              <ScrollArea className="h-44">
                <div className="divide-y">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      {editingId === category.id ? (
                        <>
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8"
                            autoFocus
                          />
                          <Switch
                            checked={editingRequireValidity}
                            onCheckedChange={setEditingRequireValidity}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            disabled={updatingId === category.id}
                            onClick={() => saveEditing(category)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            disabled={updatingId === category.id}
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate">{category.nome}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => startEditing(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {(category.produtosVinculados ?? 0) === 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              disabled={deletingId === category.id}
                              onClick={() => removeCategory(category)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            Cadastrar Categoria
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditProductDialog({
  product,
  categories,
  estoqueId,
  onProductsChanged,
  onUpdated,
}: {
  product: Product;
  categories: Category[];
  estoqueId: string;
  onProductsChanged: () => void;
  onUpdated: () => void;
}) {
  type EditableLot = ProductLot & {
    lotValue: string;
    expirationValue: string;
    quantityValue: string;
  };

  const [barcode, setBarcode] = useState(product.barcode);
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(
    product.categoryId ? String(product.categoryId) : "",
  );
  const [unit, setUnit] = useState(product.unit);
  const [price, setPrice] = useState(String(product.price));
  const [loading, setLoading] = useState(false);
  const [lots, setLots] = useState<EditableLot[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [savingLotId, setSavingLotId] = useState<number | null>(null);
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const requiresExpiration = !!selectedCategory?.exigeValidade;

  const toEditableLot = (lot: ProductLot): EditableLot => ({
    ...lot,
    lotValue: lot.lot === "Sem lote" ? "" : lot.lot,
    expirationValue: lot.expirationDate ?? "",
    quantityValue: String(lot.quantity),
  });

  useEffect(() => {
    setBarcode(product.barcode);
    setName(product.name);
    setCategoryId(product.categoryId ? String(product.categoryId) : "");
    setUnit(product.unit);
    setPrice(String(product.price));
  }, [product]);

  useEffect(() => {
    if (!requiresExpiration) {
      setLots([]);
      return;
    }

    setLoadingLots(true);
    getProductLots(product.id, estoqueId)
      .then((items) => setLots(items.map(toEditableLot)))
      .catch(() => toast.error("Erro ao carregar lotes do produto"))
      .finally(() => setLoadingLots(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, estoqueId, requiresExpiration]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcode.trim() || !name.trim() || !categoryId || !price) {
      toast.error("Preencha código, nome, categoria e preço");
      return;
    }

    setLoading(true);
    try {
      await updateProduct(product.id, {
        codigo_barras: barcode.trim(),
        nome: name.trim(),
        categoria_id: parseInt(categoryId),
        unidade: unit.trim() || "un",
        preco_venda: parseFloat(price) || 0,
        ativo: product.active,
      });
      toast.success("Produto atualizado");
      onUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar produto");
    } finally {
      setLoading(false);
    }
  };

  const updateLotDraft = (
    lotId: number,
    field: "lotValue" | "expirationValue" | "quantityValue",
    value: string,
  ) => {
    setLots((items) => items.map((item) => (item.id === lotId ? { ...item, [field]: value } : item)));
  };

  const saveLot = async (lot: EditableLot) => {
    const quantity = Number(lot.quantityValue);

    if (!lot.lotValue.trim()) {
      toast.error("Informe o lote");
      return;
    }
    if (!lot.expirationValue) {
      toast.error("Informe a validade do lote");
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("Quantidade do lote inválida");
      return;
    }

    setSavingLotId(lot.id);
    try {
      const updated = await updateProductLot(product.id, lot.id, {
        lote: lot.lotValue.trim(),
        data_validade: lot.expirationValue,
        quantidade: quantity,
      });
      setLots((items) => items.map((item) => (item.id === lot.id ? toEditableLot(updated) : item)));
      toast.success("Lote atualizado");
      onProductsChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar lote");
    } finally {
      setSavingLotId(null);
    }
  };

  return (
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Editar produto</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <BarcodeInput value={barcode} onChange={setBarcode} />

        <div className="space-y-2">
          <Label>Nome do produto</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pipoca grande salgada"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder={categories.length ? "Selecione" : "Sem categorias"} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Unidade</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Preco (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        {requiresExpiration && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div>
              <h3 className="text-sm font-semibold">Lotes e validades</h3>
              <p className="text-xs text-muted-foreground">
                Para produtos com validade, edite a validade e a quantidade no lote correto.
              </p>
            </div>

            {loadingLots ? (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                Carregando lotes...
              </div>
            ) : lots.length === 0 ? (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                Nenhum lote cadastrado para este produto.
              </div>
            ) : (
              <ScrollArea className="max-h-72 pr-3">
                <div className="space-y-3">
                  {lots.map((lot) => (
                    <div key={lot.id} className="rounded-md border bg-background p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{lot.estoqueNome}</p>
                          <p className="text-xs text-muted-foreground">Lote #{lot.id}</p>
                        </div>
                        <Badge variant="outline">{lot.status === "vencido" ? "Vencido" : "Lote"}</Badge>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_150px_120px_auto] md:items-end">
                        <div className="space-y-2">
                          <Label>Lote</Label>
                          <Input
                            value={lot.lotValue}
                            onChange={(e) => updateLotDraft(lot.id, "lotValue", e.target.value)}
                            placeholder="Código do lote"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Validade</Label>
                          <Input
                            type="date"
                            value={lot.expirationValue}
                            onChange={(e) =>
                              updateLotDraft(lot.id, "expirationValue", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            min={0}
                            value={lot.quantityValue}
                            onChange={(e) =>
                              updateLotDraft(lot.id, "quantityValue", e.target.value)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={savingLotId === lot.id}
                          onClick={() => saveLot(lot)}
                        >
                          Salvar lote
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            Salvar alteracoes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

