import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Package,
  AlertTriangle,
  XCircle,
  DollarSign,
  Search,
  Filter,
  FolderOpen,
  Download,
  Plus,
  Star,
  Pencil,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { BarcodeInput } from "@/components/scanner/BarcodeInput";
import { WasteDialog } from "@/components/waste/WasteDialog";
import { toast } from "sonner";
import { isExpired, isNearExpiration } from "@/lib/expiration";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  setProductStatus,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getEstoques,
  getProductLots,
  updateProductLot,
} from "@/services/api";
import type { Product, Category, Estoque, ProductLot } from "@/types";

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

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ExpirationBadges({ product }: { product: Product }) {
  if (!product.requiresExpiration) {
    return null;
  }

  return (
    <div className="flex w-full flex-wrap justify-center gap-1.5">
      {isExpired(product.expirationDate) && (
        <Badge variant="destructive" className="h-5 whitespace-nowrap">
          Vencido
        </Badge>
      )}
      {isNearExpiration(product.expirationDate) && (
        <Badge
          variant="secondary"
          className="h-5 whitespace-nowrap bg-warning/15 text-warning border-warning/30"
        >
          Próximo do vencimento
        </Badge>
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({ meta: [{ title: "Produtos · Cinépolis Estoque" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [wasteProduct, setWasteProduct] = useState<Product | null>(null);
  const [lotProduct, setLotProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(emptyFilters);

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

  const numberFilter = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const filtered = products.filter((p) => {
    const expired = p.requiresExpiration && isExpired(p.expirationDate);
    const alreadyMovedToWaste = expired && p.stock <= 0;
    if (alreadyMovedToWaste) return false;

    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      p.name.toLowerCase().includes(normalizedQuery) ||
      p.barcode.includes(normalizedQuery);

    const matchesCategory =
      appliedFilters.categoryId === "all" || String(p.categoryId) === appliedFilters.categoryId;

    const matchesStatus =
      appliedFilters.status === "all" ||
      (appliedFilters.status === "active" && p.active) ||
      (appliedFilters.status === "inactive" && !p.active);

    const hasLowStock = p.minStock > 0 && p.stock <= p.minStock;
    const matchesStockStatus =
      appliedFilters.stockStatus === "all" ||
      (appliedFilters.stockStatus === "available" && p.stock > 0) ||
      (appliedFilters.stockStatus === "no_stock" && p.stock === 0) ||
      (appliedFilters.stockStatus === "low_stock" && hasLowStock);

    const minPrice = numberFilter(appliedFilters.minPrice);
    const maxPrice = numberFilter(appliedFilters.maxPrice);
    const minStockValue = numberFilter(appliedFilters.minStock);
    const maxStockValue = numberFilter(appliedFilters.maxStock);

    const matchesPrice =
      (minPrice === null || p.price >= minPrice) && (maxPrice === null || p.price <= maxPrice);

    const matchesStock =
      (minStockValue === null || p.stock >= minStockValue) &&
      (maxStockValue === null || p.stock <= maxStockValue);

    const matchesUnit =
      !appliedFilters.unit.trim() ||
      p.unit.toLowerCase().includes(appliedFilters.unit.trim().toLowerCase());

    return (
      matchesQuery &&
      matchesCategory &&
      matchesStatus &&
      matchesStockStatus &&
      matchesPrice &&
      matchesStock &&
      matchesUnit
    );
  });

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
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) {
      return;
    }

    setDeletingProductId(product.id);
    try {
      await deleteProduct(product.id);
      setProducts((items) => items.filter((item) => item.id !== product.id));
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

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle={`${products.length} ${products.length === 1 ? "item cadastrado" : "itens cadastrados"}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de produtos" value={products.length} icon={Package} />
        <StatCard label="Estoque baixo" value={lowStock} icon={AlertTriangle} tone="warning" />
        <StatCard label="Sem estoque" value={noStock} icon={XCircle} tone="destructive" />
        <StatCard
          label="Total em estoque"
          value={money(total)}
          icon={DollarSign}
          tone="success"
        />
      </div>

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-2 border-b">
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
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FolderOpen className="h-4 w-4" /> Categoria
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Produto
              </Button>
            </DialogTrigger>
            <NewProductDialog
              estoques={estoques}
              selectedEstoqueId={selectedEstoqueId}
              onCreated={() => {
                setOpen(false);
                loadProducts();
              }}
            />
          </Dialog>
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
        </div>

        {filtersOpen && (
          <div className="border-b bg-muted/20 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre seu primeiro produto para começar a controlar o estoque."
            action={
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Cadastrar produto
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
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
                        <div>{p.categoryName ?? "—"}</div>
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
                              : "Nao"}
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
                              removeProduct(p);
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

  const statusBadge = (lot: ProductLot) => {
    if (lot.status === "vencido") return <Badge variant="destructive">Vencido</Badge>;
    if (lot.status === "proximo_vencimento") {
      return (
        <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
          Proximo do vencimento
        </Badge>
      );
    }
    if (lot.status === "sem_validade") return <Badge variant="outline">Sem validade</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  };

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
                    <TableCell>{lot.expirationDate ? formatDate(lot.expirationDate) : "—"}</TableCell>
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
      toast.error("Preencha codigo, nome, categoria e preco");
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
      toast.error("Quantidade do lote invalida");
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

function NewProductDialog({
  estoques,
  selectedEstoqueId,
  onCreated,
}: {
  estoques: Estoque[];
  selectedEstoqueId: string;
  onCreated: () => void;
}) {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [unit, setUnit] = useState("un");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lot, setLot] = useState("");
  const [minStock, setMinStock] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const requiresExpiration = !!selectedCategory?.exigeValidade;

  useEffect(() => {
    getCategories()
      .then((cs) => {
        setCategories(cs);
        if (cs.length && !categoryId) setCategoryId(String(cs[0].id));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEstoqueId !== "all") {
      setEstoqueId(selectedEstoqueId);
      return;
    }

    const firstActive = estoques.find((estoque) => estoque.ativo) ?? estoques[0];
    if (firstActive) setEstoqueId(String(firstActive.id));
  }, [estoques, selectedEstoqueId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !name || !price || !categoryId || !estoqueId) {
      toast.error("Preencha código, nome, categoria, preço e estoque");
      return;
    }
    if (requiresExpiration && !lot.trim()) {
      toast.error("Informe o lote");
      return;
    }
    if (requiresExpiration && !expirationDate) {
      toast.error("Informe a data de validade");
      return;
    }
    setLoading(true);
    try {
      await createProduct({
        codigo_barras: barcode,
        nome: name,
        categoria_id: parseInt(categoryId),
        unidade: unit,
        preco_venda: parseFloat(price) || 0,
        estoque_id: parseInt(estoqueId),
        estoque_atual: parseInt(stock) || 0,
        estoque_minimo: parseInt(minStock) || 0,
        data_validade: requiresExpiration ? expirationDate : null,
        lote: lot.trim(),
        ativo: true,
      });
      toast.success("Produto cadastrado");
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar produto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Cadastrar novo produto</DialogTitle>
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
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          {requiresExpiration && (
            <div className="space-y-2 col-span-2">
              <Label>Data de validade</Label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2 col-span-2">
            <Label>Estoque</Label>
            <Select value={estoqueId} onValueChange={setEstoqueId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estoque inicial" />
              </SelectTrigger>
              <SelectContent>
                {estoques.map((estoque) => (
                  <SelectItem key={estoque.id} value={String(estoque.id)}>
                    {estoque.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preço (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Estoque inicial</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{requiresExpiration ? "Lote inicial" : "Lote inicial (opcional)"}</Label>
            <Input value={lot} onChange={(e) => setLot(e.target.value)} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Estoque mínimo</Label>
            <Input type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            Cadastrar Produto
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
