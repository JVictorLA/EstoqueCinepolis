import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, AlertTriangle, XCircle, DollarSign, Activity } from "lucide-react";
import { PageHeader, StatCard, EmptyState } from "@/components/layout/PageHeader";
import { getProducts, getMovements } from "@/services/api";
import type { Product, Movement } from "@/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard · Cinépolis" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movs, setMovs] = useState<Movement[]>([]);
  useEffect(() => {
    getProducts().then(setProducts);
    getMovements().then(setMovs);
  }, []);

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const noStock = products.filter((p) => p.stock === 0).length;
  const total = products.reduce((s, p) => s + p.price * p.stock, 0);

  const criticalProducts = products.filter(
  (p) => p.stock === 0 || (p.stock > 0 && p.stock <= p.minStock)
);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do estoque e movimentações"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de produtos" value={products.length} icon={Package} />
        <StatCard label="Estoque baixo" value={lowStock} icon={AlertTriangle} tone="warning" />
        <StatCard label="Sem estoque" value={noStock} icon={XCircle} tone="destructive" />
        <StatCard label="Valor em estoque" value={`R$ ${total.toFixed(2)}`} icon={DollarSign} tone="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)] min-h-[320px]">
          <h3 className="font-semibold mb-1">Movimentações recentes</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimas entradas e saídas registradas</p>
          {movs.length === 0 ? (
  <EmptyState
    icon={Activity}
    title="Sem movimentações"
    description="As movimentações aparecerão aqui assim que registradas."
  />
) : (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left py-3">Produto</th>
          <th className="text-left py-3">Tipo</th>
          <th className="text-left py-3">Quantidade</th>
          <th className="text-left py-3">Responsável</th>
          <th className="text-left py-3">Data</th>
          <th className="text-left py-3">Hora</th>
        </tr>
      </thead>

      <tbody>
        {movs.slice(0, 5).map((m) => (
          <tr key={m.id} className="border-b">
            <td className="py-3">{m.productName}</td>

            <td className="py-3">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  m.type === "entrada"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {m.type === "entrada" ? "Entrada" : "Saída"}
              </span>
            </td>

            <td className="py-3">{m.quantity}</td>
            <td className="py-3">{m.userName}</td>
            <td className="py-3">
              {new Date(m.createdAt).toLocaleDateString("pt-BR")}
            </td>
            <td className="py-3">
              {new Date(m.createdAt).toLocaleTimeString("pt-BR")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
        </div>
        <div className="rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)] min-h-[320px]">
          <h3 className="font-semibold mb-1">Produtos com alerta</h3>
<p className="text-xs text-muted-foreground mb-4">
  Itens com estoque baixo ou zerado
</p>

{criticalProducts.length === 0 ? (
  <EmptyState
    icon={Package}
    title="Tudo certo!"
    description="Nenhum produto com problema de estoque."
  />
) : (
  <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/30">
    {criticalProducts.slice(0, 6).map((p) => {
      const isNoStock = p.stock === 0;

      return (
        <div
          key={p.id}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
        >
          <div className="flex items-center gap-3">
            {isNoStock ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}

            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {isNoStock ? "Sem estoque" : "Estoque baixo"}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold">{p.stock}</div>
            <div className="text-xs text-muted-foreground">unidades</div>
          </div>
        </div>
      );
    })}
  </div>
)}
        </div>
      </div>
    </>
  );
}
