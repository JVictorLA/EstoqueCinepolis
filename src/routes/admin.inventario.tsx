import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getProducts, getMovements } from "@/services/api";
import type { Product, Movement } from "@/types";

export const Route = createFileRoute("/admin/inventario")({
  head: () => ({ meta: [{ title: "Inventário · Cinépolis" }] }),
  component: InventarioPage,
});

function InventarioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movs, setMovs] = useState<Movement[]>([]);
  useEffect(() => {
    getProducts().then(setProducts);
    getMovements().then(setMovs);
  }, []);

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
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>
        <TabsContent value="estoque">
          <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
            {products.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sem produtos" description="Cadastre produtos para visualizar o inventário." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
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
