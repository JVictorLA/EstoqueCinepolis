import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpFromLine,
  Barcode,
  Clock,
  Loader2,
  Package,
  Printer,
  Search,
  Trash2,
  User,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getInventoryCurrent,
  getMovements,
  getProductLots,
  getUsers,
  getWastes,
} from "@/services/api";
import type {
  InventoryCurrentItem,
  Movement,
  ProductLot,
  SystemUser,
  Waste,
} from "@/types";
import { canRunGlobalSearch, searchProducts, searchUsers } from "@/lib/globalSearch";
import { printGlobalSearchProduct, printGlobalSearchUser } from "@/lib/globalSearchPrint";

export type GlobalSearchSelection =
  | { type: "product"; item: InventoryCurrentItem }
  | { type: "user"; item: SystemUser };

export interface GlobalSearchViewState {
  query: string;
  selection: GlobalSearchSelection | null;
}

interface GlobalSearchProps {
  onOpenSearch: (state: GlobalSearchViewState) => void;
  onCloseSearch: () => void;
}

interface GlobalSearchPageProps {
  initialQuery: string;
  initialSelection: GlobalSearchSelection | null;
  onClose: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return "Sem validade";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function movementLabel(type: Movement["type"]) {
  const labels: Record<Movement["type"], string> = {
    entrada: "Entrada",
    saida: "Retirada",
    desperdicio: "Desperdicio",
    ajuste: "Ajuste",
  };
  return labels[type] ?? type;
}

function openMovement(path: string, barcode: string, operation?: "transferencia") {
  const qs = new URLSearchParams({ codigo: barcode });
  if (operation) qs.set("operacao", operation);
  window.location.href = `${path}?${qs.toString()}`;
}

function getSelectionKey(selection: GlobalSearchSelection | null) {
  if (!selection) return "";
  return `${selection.type}-${selection.item.id ?? selection.item.productId}`;
}

export function GlobalSearch({ onOpenSearch, onCloseSearch }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<InventoryCurrentItem[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);

  const shouldSearch = canRunGlobalSearch(query);
  const productResults = useMemo(() => searchProducts(query, products), [products, query]);
  const userResults = useMemo(() => searchUsers(query, users), [query, users]);
  const showResults = focused && shouldSearch;

  useEffect(() => {
    if (!shouldSearch || products.length || users.length) return;

    let alive = true;
    setLoading(true);
    setError("");

    Promise.all([getInventoryCurrent("all"), getUsers()])
      .then(([inventory, systemUsers]) => {
        if (!alive) return;
        setProducts(inventory);
        setUsers(systemUsers);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Erro ao buscar dados");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [products.length, shouldSearch, users.length]);

  const openSearchPage = (selection: GlobalSearchSelection | null = null) => {
    setFocused(false);
    onOpenSearch({ query, selection });
  };

  const openFirstResult = () => {
    const first = productResults[0]
      ? ({ type: "product", item: productResults[0] } as GlobalSearchSelection)
      : userResults[0]
        ? ({ type: "user", item: userResults[0] } as GlobalSearchSelection)
        : null;
    if (first || shouldSearch) openSearchPage(first);
  };

  return (
    <div className="relative hidden max-w-md flex-1 sm:block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            openFirstResult();
          }
          if (event.key === "Escape") {
            setFocused(false);
            onCloseSearch();
          }
        }}
        placeholder="Buscar produtos, usuarios, codigos..."
        className="bg-card pl-9 text-sm shadow-none"
      />

      {showResults && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          )}

          {!loading && error && <div className="px-3 py-4 text-sm text-destructive">{error}</div>}

          {!loading && !error && productResults.length === 0 && userResults.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted-foreground">Nenhum resultado encontrado.</div>
          )}

          {!loading && !error && productResults.length > 0 && (
            <div className="border-b py-2">
              <div className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">
                Produtos
              </div>
              {productResults.map((product) => (
                <button
                  key={`product-${product.productId}`}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openSearchPage({ type: "product", item: product })}
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{product.productName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {product.barcode} - estoque {product.stock}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && !error && userResults.length > 0 && (
            <div className="py-2">
              <div className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">
                Usuarios
              </div>
              {userResults.map((user) => (
                <button
                  key={`user-${user.id}`}
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openSearchPage({ type: "user", item: user })}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.matricula} - {user.role}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GlobalSearchPage({
  initialQuery,
  initialSelection,
  onClose,
}: GlobalSearchPageProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selection, setSelection] = useState<GlobalSearchSelection | null>(initialSelection);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<InventoryCurrentItem[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [productLots, setProductLots] = useState<ProductLot[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [wastes, setWastes] = useState<Waste[]>([]);

  const shouldSearch = canRunGlobalSearch(query);
  const productResults = useMemo(() => searchProducts(query, products, 12), [products, query]);
  const userResults = useMemo(() => searchUsers(query, users, 12), [query, users]);
  const selectedProduct = selection?.type === "product" ? selection.item : null;
  const selectedUser = selection?.type === "user" ? selection.item : null;
  const totalWasteValue = wastes.reduce((total, waste) => total + waste.totalValue, 0);
  const selectionKey = getSelectionKey(selection);

  useEffect(() => {
    setQuery(initialQuery);
    setSelection(initialSelection);
  }, [initialQuery, initialSelection]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    Promise.all([getInventoryCurrent("all"), getUsers()])
      .then(([inventory, systemUsers]) => {
        if (!alive) return;
        setProducts(inventory);
        setUsers(systemUsers);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Erro ao buscar dados");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (selection || loading) return;
    const first = productResults[0]
      ? ({ type: "product", item: productResults[0] } as GlobalSearchSelection)
      : userResults[0]
        ? ({ type: "user", item: userResults[0] } as GlobalSearchSelection)
        : null;
    if (first) setSelection(first);
  }, [loading, productResults, selection, userResults]);

  useEffect(() => {
    if (!selection) {
      setProductLots([]);
      setMovements([]);
      setWastes([]);
      return;
    }

    let alive = true;
    setDetailsLoading(true);
    setProductLots([]);
    setMovements([]);
    setWastes([]);

    const requests =
      selection.type === "product"
        ? Promise.all([
            getProductLots(selection.item.productId, "all"),
            getMovements({ produto_id: selection.item.productId }),
          ]).then(([lots, productMovements]) => ({ lots, productMovements, userWastes: [] as Waste[] }))
        : Promise.all([
            getMovements({ usuario_id: selection.item.id }),
            getWastes({ usuario_id: selection.item.id }),
          ]).then(([userMovements, userWastes]) => ({
            lots: [] as ProductLot[],
            productMovements: userMovements,
            userWastes,
          }));

    requests
      .then((data) => {
        if (!alive) return;
        setProductLots(data.lots);
        setMovements(data.productMovements);
        setWastes(data.userWastes);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Erro ao carregar detalhes");
      })
      .finally(() => {
        if (alive) setDetailsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selection]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setSelection(null);
  };

  const printSelected = () => {
    if (detailsLoading || !selection) return;

    const result =
      selection.type === "product" && selectedProduct
        ? printGlobalSearchProduct({
            product: selectedProduct,
            lots: productLots,
            movements,
          })
        : selectedUser
          ? printGlobalSearchUser({
              user: selectedUser,
              movements,
              wastes,
              totalWasteValue,
            })
          : null;

    if (result === "blocked") {
      toast.error("Nao foi possivel abrir a janela de impressao. Verifique o bloqueador de pop-ups.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal">Busca global</h1>
          <p className="text-sm text-muted-foreground">
            Produtos, usuarios, estoques, movimentacoes e desperdicios em um so lugar.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={printSelected}
            disabled={!selection || detailsLoading}
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Buscar por produto, codigo, usuario ou matricula..."
          className="h-11 bg-card pl-9"
          autoFocus
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando busca...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && !shouldSearch && (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Digite pelo menos 2 caracteres, ou um codigo/matricula, para buscar.
        </div>
      )}

      {!loading && !error && shouldSearch && (
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <SearchResultsList
            productResults={productResults}
            userResults={userResults}
            selectionKey={selectionKey}
            onSelect={setSelection}
          />

          <div className="min-w-0">
            {detailsLoading && (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando detalhes...
              </div>
            )}

            {!detailsLoading && selectedProduct && (
              <ProductDetails product={selectedProduct} lots={productLots} movements={movements} />
            )}

            {!detailsLoading && selectedUser && (
              <UserDetails
                user={selectedUser}
                movements={movements}
                wastes={wastes}
                totalWasteValue={totalWasteValue}
              />
            )}

            {!detailsLoading && !selection && (
              <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Selecione um resultado para ver os detalhes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResultsList({
  productResults,
  userResults,
  selectionKey,
  onSelect,
}: {
  productResults: InventoryCurrentItem[];
  userResults: SystemUser[];
  selectionKey: string;
  onSelect: (selection: GlobalSearchSelection) => void;
}) {
  if (productResults.length === 0 && userResults.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhum resultado encontrado.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {productResults.length > 0 && (
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
            Produtos
          </div>
          <div className="divide-y">
            {productResults.map((product) => {
              const key = `product-${product.productId}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted ${
                    selectionKey === key ? "bg-muted" : ""
                  }`}
                  onClick={() => onSelect({ type: "product", item: product })}
                >
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{product.productName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {product.barcode} - estoque {product.stock}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {userResults.length > 0 && (
        <section className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
            Usuarios
          </div>
          <div className="divide-y">
            {userResults.map((user) => {
              const key = `user-${user.id}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition hover:bg-muted ${
                    selectionKey === key ? "bg-muted" : ""
                  }`}
                  onClick={() => onSelect({ type: "user", item: user })}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.matricula} - {user.role}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductDetails({
  product,
  lots,
  movements,
}: {
  product: InventoryCurrentItem;
  lots: ProductLot[];
  movements: Movement[];
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-normal">{product.productName}</h2>
            <div className="mt-2 flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <Barcode className="h-4 w-4" />
              {product.barcode}
            </div>
            <ProductBarcodePreview code={product.barcode} />
          </div>
          <Badge variant={product.active ? "default" : "secondary"}>
            {product.active ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Estoque total" value={product.stock} />
          <Metric label="Categoria" value={product.categoryName ?? "-"} />
          <Metric label="Status" value={product.status} />
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" className="gap-2" onClick={() => openMovement("/admin/entrada", product.barcode)}>
          <ArrowDownToLine className="h-4 w-4" />
          Entrada
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => openMovement("/admin/retirada", product.barcode)}
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Retirada
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => openMovement("/admin/retirada", product.barcode, "transferencia")}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transferir
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Estoque por local</h3>
        <div className="divide-y rounded-lg border bg-card">
          {(product.estoques.length
            ? product.estoques
            : [
                {
                  estoqueId: product.estoqueId ?? 0,
                  estoqueNome: product.estoqueNome ?? "Estoque",
                  stock: product.stock,
                },
              ]).map((stock) => (
            <div key={stock.estoqueId} className="flex justify-between gap-3 px-3 py-2 text-sm">
              <span className="truncate">{stock.estoqueNome}</span>
              <span className="font-semibold">{stock.stock}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Lotes e validade</h3>
        <div className="divide-y rounded-lg border bg-card">
          {lots.length ? (
            lots.slice(0, 12).map((lot) => (
              <div key={lot.id} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{lot.lot}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(lot.expirationDate)}</span>
                </span>
                <span className="font-semibold">{lot.quantity}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum lote encontrado.</div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Movimentacoes recentes</h3>
        <HistoryList movements={movements} />
      </section>
    </div>
  );
}

function UserDetails({
  user,
  movements,
  wastes,
  totalWasteValue,
}: {
  user: SystemUser;
  movements: Movement[];
  wastes: Waste[];
  totalWasteValue: number;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-normal">{user.name}</h2>
            <div className="mt-2 font-mono text-sm text-muted-foreground">{user.matricula}</div>
          </div>
          <Badge variant={user.active ? "default" : "secondary"}>
            {user.active ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Tipo" value={user.role} />
          <Metric label="Email" value={user.email ?? "-"} />
          <Metric label="Cadastro" value={formatDate(user.createdAt)} />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Movimentacoes" value={movements.length} />
        <MetricCard label="Desperdicios" value={wastes.length} />
        <MetricCard label="Valor perdido" value={`R$ ${totalWasteValue.toFixed(2)}`} />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Movimentacoes recentes</h3>
        <HistoryList movements={movements} />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Desperdicios registrados</h3>
        <div className="divide-y rounded-lg border bg-card">
          {wastes.length ? (
            wastes.slice(0, 12).map((waste) => (
              <div key={waste.id} className="flex gap-3 px-3 py-2 text-sm">
                <Trash2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{waste.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {waste.motivoNome} - {waste.quantity} un - R$ {waste.totalValue.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum desperdicio encontrado.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProductBarcodePreview({ code }: { code: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!svgRef.current) return;

    try {
      JsBarcode(svgRef.current, code, {
        format: "CODE128",
        displayValue: false,
        width: 1.5,
        height: 42,
        margin: 0,
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [code]);

  return (
    <div className="mt-4 max-w-sm rounded-lg border bg-background px-3 py-3">
      {failed ? (
        <div className="text-sm font-medium text-destructive">Codigo de barras indisponivel</div>
      ) : (
        <svg ref={svgRef} className="h-11 w-full" aria-label={`Codigo de barras ${code}`} />
      )}
      <div className="mt-2 truncate text-center font-mono text-xs tracking-wider text-muted-foreground">
        {code}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function HistoryList({ movements }: { movements: Movement[] }) {
  return (
    <div className="divide-y rounded-lg border bg-card">
      {movements.length ? (
        movements.slice(0, 12).map((movement) => (
          <div key={movement.id} className="flex gap-3 px-3 py-2 text-sm">
            <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{movement.productName}</span>
                <Badge variant="outline">{movementLabel(movement.type)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {movement.quantity} un - {movement.estoqueNome ?? "Estoque"} - {formatDate(movement.createdAt)}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="px-3 py-3 text-sm text-muted-foreground">Nenhuma movimentacao encontrada.</div>
      )}
    </div>
  );
}
