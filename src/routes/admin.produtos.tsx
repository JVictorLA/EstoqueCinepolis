import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Package, AlertTriangle, XCircle, DollarSign, Search, Filter,
  FolderOpen, Download, Plus, Star, Pencil, Trash2,
} from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BarcodeInput } from "@/components/scanner/BarcodeInput";
import { toast } from "sonner";
import { getProducts, createProduct, getCategories } from "@/services/api";
import type { Product, Category } from "@/types";

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({ meta: [{ title: "Produtos · Cinépolis Estoque" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => { getProducts().then(setProducts); }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) || p.barcode.includes(query)
  );
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
        <StatCard label="Total em estoque" value={`R$ ${total.toFixed(2)}`} icon={DollarSign} tone="success" />
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
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Categorias
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Produto
              </Button>
            </DialogTrigger>
            <NewProductDialog onCreated={() => { setOpen(false); getProducts().then(setProducts); }} />
          </Dialog>
        </div>

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
                  <TableHead>Estoque</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Catálogo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Star className={`h-4 w-4 ${p.favorite ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-muted overflow-hidden flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
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
                    <TableCell className="text-sm">{p.categoryName ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${
                        p.stock === 0 ? "text-destructive" : p.stock <= p.minStock ? "text-warning" : ""
                      }`}>{p.stock}</span>
                    </TableCell>
                    <TableCell className="text-sm">R$ {p.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={p.active} />
                        <span className="text-xs text-muted-foreground">{p.active ? "Sim" : "Não"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
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

function NewProductDialog({ onCreated }: { onCreated: () => void }) {
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [unit, setUnit] = useState("un");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCategories()
      .then((cs) => {
        setCategories(cs);
        if (cs.length && !categoryId) setCategoryId(String(cs[0].id));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || !name || !price || !categoryId) {
      toast.error("Preencha código, nome, categoria e preço");
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
        estoque_atual: parseInt(stock) || 0,
        estoque_minimo: parseInt(minStock) || 0,
        ativo: true,
      });
      toast.success("Produto cadastrado");
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar produto");
    } finally { setLoading(false); }
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
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pipoca grande salgada" />
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
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Preço (R$)</Label>
            <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Estoque inicial</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
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
