import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History as HistoryIcon, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { getMovements } from "@/services/api";
import type { Movement } from "@/types";

export const Route = createFileRoute("/operador/historico")({
  head: () => ({ meta: [{ title: "Histórico · Operador Cinépolis" }] }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const [movs, setMovs] = useState<Movement[]>([]);
  useEffect(() => { getMovements().then(setMovs); }, []);

  return (
    <>
      <PageHeader title="Histórico" subtitle="Movimentações recentes registradas pelos operadores" />
      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)]">
        {movs.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="Sem movimentações ainda" description="Suas entradas e retiradas aparecerão aqui." />
        ) : (
          <ul className="divide-y">
            {movs.map((m) => {
              const isIn = m.type === "entrada";
              const Icon = isIn ? ArrowDownToLine : ArrowUpFromLine;
              return (
                <li key={m.id} className="p-4 flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isIn ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{m.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.userName} · {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant={isIn ? "default" : "destructive"}>
                    {isIn ? "+" : "−"}{m.quantity}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
