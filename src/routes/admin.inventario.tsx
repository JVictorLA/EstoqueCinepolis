import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Printer, RotateCcw, XCircle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarcodeInput } from "@/components/scanner/BarcodeInput";
import { getProducts, getMovements, getEstoques, getProductByBarcode } from "@/services/api";
import type { Product, Movement, Estoque } from "@/types";
import { isExpired, isNearExpiration } from "@/lib/expiration";
import { toast } from "sonner";

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

type ConferenceItem = {
  product: Product;
  counted: number;
};

export const Route = createFileRoute("/admin/inventario")({
  head: () => ({ meta: [{ title: "Inventário · Cinépolis" }] }),
  component: InventarioPage,
});

function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movs, setMovs] = useState<Movement[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [inventoryEstoqueId, setInventoryEstoqueId] = useState("all");
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [conferenceItems, setConferenceItems] = useState<ConferenceItem[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getMovements().then(setMovs);
    getEstoques().then((data) => {
      setEstoques(data);
      const firstActive = data.find((estoque) => estoque.ativo) ?? data[0];
      if (firstActive) setSelectedEstoqueId(String(firstActive.id));
    });
  }, []);

  useEffect(() => {
    getProducts(inventoryEstoqueId).then(setProducts);
  }, [inventoryEstoqueId]);

  useEffect(() => {
    setConferenceItems([]);
  }, [selectedEstoqueId]);

  const conferenceSummary = useMemo(() => {
    const ok = conferenceItems.filter((item) => item.counted === item.product.stock).length;
    const divergences = conferenceItems.length - ok;
    const countedUnits = conferenceItems.reduce((sum, item) => sum + item.counted, 0);

    return { ok, divergences, countedUnits };
  }, [conferenceItems]);

  const addBarcodeToConference = async (rawCode?: string) => {
    const code = (rawCode ?? barcode).trim();
    if (!code) return;

    if (!selectedEstoqueId) {
      toast.error("Selecione um estoque para conferência");
      return;
    }

    setAdding(true);
    try {
      const product = await getProductByBarcode(code, selectedEstoqueId);
      if (!product) {
        toast.error("Produto não encontrado neste estoque");
        return;
      }

      setConferenceItems((items) => {
        const existing = items.find((item) => item.product.id === product.id);
        if (existing) {
          return items.map((item) =>
            item.product.id === product.id
              ? { ...item, counted: item.counted + 1 }
              : item,
          );
        }

        return [{ product, counted: 1 }, ...items];
      });
      setBarcode("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao conferir produto");
    } finally {
      setAdding(false);
    }
  };

  const updateConferenceCount = (productId: number, counted: number) => {
    setConferenceItems((items) =>
      items.map((item) =>
        item.product.id === productId
          ? { ...item, counted: Math.max(0, counted || 0) }
          : item,
      ),
    );
  };

  return (
    <>
      <PageHeader
        title="Inventário"
        subtitle="Posição de estoque e histórico de movimentações"
        actions={<Button variant="outline" className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>}
      />
      <Tabs defaultValue="estoque" className="space-y-4">
        <TabsList>
          <TabsTrigger value="estoque">Estoque atual</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>
        <TabsContent value="estoque">
          <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
            <div className="border-b p-4">
              <div className="max-w-xs space-y-2">
                <Label>Estoque exibido</Label>
                <Select value={inventoryEstoqueId} onValueChange={setInventoryEstoqueId}>
                  <SelectTrigger>
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
              </div>
            </div>
            {products.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sem produtos" description="Cadastre produtos para visualizar o inventário." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.categoryName ?? "—"}</TableCell>
                      <TableCell>
                        {p.requiresExpiration && p.expirationDate ? (
                          <div className="space-y-1.5">
                            <div>{formatDate(p.expirationDate)}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {isExpired(p.expirationDate) && (
                                <Badge variant="destructive">Vencido</Badge>
                              )}
                              {isNearExpiration(p.expirationDate) && (
                                <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
                                  Próximo do vencimento
                                </Badge>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden">
                        <div className="space-y-1.5">
                          <div>{p.categoryName ?? "—"}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {isExpired(p.expirationDate) && (
                              <Badge variant="destructive">Vencido</Badge>
                            )}
                            {isNearExpiration(p.expirationDate) && (
                              <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
                                Próximo do vencimento
                              </Badge>
                            )}
                          </div>
                          {p.requiresExpiration && p.expirationDate && (
                            <div className="text-xs text-muted-foreground">
                              Validade: {formatDate(p.expirationDate)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell>{p.minStock}</TableCell>
                      <TableCell>R$ {(p.price * p.stock).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="conferencia">
          <div className="space-y-4">
            <div className="rounded-xl bg-card border p-4 shadow-[var(--shadow-soft)]">
              <div className="grid gap-4 lg:grid-cols-[240px_1fr_auto] lg:items-end">
                <div className="space-y-2">
                  <Label>Estoque conferido</Label>
                  <Select value={selectedEstoqueId} onValueChange={setSelectedEstoqueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o estoque" />
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

                <BarcodeInput
                  value={barcode}
                  onChange={setBarcode}
                  onSubmit={addBarcodeToConference}
                  label="Código conferido"
                  placeholder="Leia com o scanner ou digite o código"
                />

                <Button
                  type="button"
                  onClick={() => addBarcodeToConference()}
                  disabled={adding}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Produtos conferidos</div>
                <div className="mt-1 text-2xl font-bold">{conferenceItems.length}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Unidades contadas</div>
                <div className="mt-1 text-2xl font-bold">{conferenceSummary.countedUnits}</div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="text-xs text-muted-foreground">Divergências</div>
                <div className="mt-1 text-2xl font-bold">{conferenceSummary.divergences}</div>
              </div>
            </div>

            <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
              {conferenceItems.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Nenhum item conferido"
                  description="Leia o código de barras para começar a contagem do inventário."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Sistema</TableHead>
                      <TableHead>Contado</TableHead>
                      <TableHead>Diferença</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conferenceItems.map((item) => {
                      const diff = item.counted - item.product.stock;
                      const status =
                        diff === 0 ? "ok" : diff > 0 ? "sobra" : "falta";

                      return (
                        <TableRow key={item.product.id}>
                          <TableCell>
                            <div className="font-medium">{item.product.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {item.product.barcode}
                            </div>
                          </TableCell>
                          <TableCell>{item.product.stock}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.counted}
                              onChange={(e) =>
                                updateConferenceCount(
                                  item.product.id,
                                  Number(e.target.value),
                                )
                              }
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell className={diff === 0 ? "" : diff > 0 ? "text-warning" : "text-destructive"}>
                            {diff > 0 ? `+${diff}` : diff}
                          </TableCell>
                          <TableCell>
                            {status === "ok" && (
                              <Badge variant="secondary" className="gap-1 bg-success/15 text-success border-success/30">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </Badge>
                            )}
                            {status === "sobra" && (
                              <Badge variant="secondary" className="gap-1 bg-warning/15 text-warning border-warning/30">
                                <AlertTriangle className="h-3 w-3" /> Sobra
                              </Badge>
                            )}
                            {status === "falta" && (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" /> Falta
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {conferenceItems.length > 0 && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setConferenceItems([])}
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpar conferência
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="movs">
          <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
            {movs.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sem movimentações" />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
