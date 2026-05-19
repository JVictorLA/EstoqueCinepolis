import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { getMovements } from "@/services/api";
import type { Movement } from "@/types";

export const Route = createFileRoute("/admin/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentacoes · Cinepolis" }] }),
  component: MovsPage,
});

function movementLabel(type: Movement["type"]) {
  if (type === "entrada") return "Entrada";
  if (type === "desperdicio") return "Desperdicio";
  return "Saida";
}

function MovsPage() {
  const [movs, setMovs] = useState<Movement[]>([]);
  useEffect(() => {
    getMovements().then(setMovs);
  }, []);

  return (
    <>
      <PageHeader
        title="Movimentacoes"
        subtitle="Historico completo de entradas, saidas e desperdicios"
        actions={
          <Button variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir relatorio
          </Button>
        }
      />
      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-2 items-center">
          <Input type="date" className="w-auto" />
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Pipoca">Pipoca</SelectItem>
              <SelectItem value="Bebidas">Bebidas</SelectItem>
              <SelectItem value="Doces">Doces</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saida</SelectItem>
              <SelectItem value="desperdicio">Desperdicio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {movs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sem movimentacoes"
            description="As movimentacoes aparecerao aqui apos o primeiro registro."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Responsavel</TableHead>
                <TableHead>Observacao</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.productName}</TableCell>
                  <TableCell>{m.estoqueNome ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={m.type === "entrada" ? "default" : "destructive"}>
                      {movementLabel(m.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.quantity}</TableCell>
                  <TableCell>{m.userName}</TableCell>
                  <TableCell className="max-w-[240px] truncate">{m.note ?? "-"}</TableCell>
                  <TableCell>{new Date(m.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{new Date(m.createdAt).toLocaleTimeString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
