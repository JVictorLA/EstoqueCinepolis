import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  History as HistoryIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { getMovements } from "@/services/api";
import type { Movement, MovementType } from "@/types";

export const Route = createFileRoute("/operador/historico")({
  head: () => ({ meta: [{ title: "Historico · Zytrex Inventory" }] }),
  component: HistoricoPage,
});

function movementConfig(type: MovementType): {
  label: string;
  sign: string;
  icon: LucideIcon;
  iconClass: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
} {
  if (type === "entrada") {
    return {
      label: "Entrada",
      sign: "+",
      icon: ArrowDownToLine,
      iconClass: "bg-success/10 text-success",
      badgeVariant: "default",
    };
  }

  if (type === "saida") {
    return {
      label: "Saída",
      sign: "-",
      icon: ArrowUpFromLine,
      iconClass: "bg-destructive/10 text-destructive",
      badgeVariant: "destructive",
    };
  }

  if (type === "desperdicio") {
    return {
      label: "Desperdicio",
      sign: "-",
      icon: Trash2,
      iconClass: "bg-warning/10 text-warning",
      badgeVariant: "secondary",
    };
  }

  return {
    label: "Ajuste",
    sign: "",
    icon: RefreshCw,
    iconClass: "bg-primary/10 text-primary",
    badgeVariant: "outline",
  };
}

function HistoricoPage() {
  const navigate = useNavigate();
  const [movs, setMovs] = useState<Movement[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("cinepolis.estoque");
    const estoque = raw ? JSON.parse(raw) : null;
    if (!estoque?.id) {
      navigate({ to: "/operador" });
      return;
    }

    getMovements({ estoque_id: estoque.id }).then(setMovs);
  }, [navigate]);

  return (
    <>
      <PageHeader
        title="Historico"
        subtitle="Movimentacoes recentes registradas pelos operadores"
      />
      <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        {movs.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="Sem movimentacoes ainda"
            description="Suas entradas, retiradas, desperdícios e ajustes aparecerão aqui."
          />
        ) : (
          <ul className="divide-y">
            {movs.map((movement) => {
              const config = movementConfig(movement.type);
              const Icon = config.icon;

              return (
                <li key={movement.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.iconClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium truncate">{movement.productName}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {config.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {movement.estoqueNome ?? "-"} · {movement.userName} ·{" "}
                      {new Date(movement.createdAt).toLocaleString("pt-BR")}
                    </div>
                    {movement.note && (
                      <div className="text-xs text-muted-foreground truncate">{movement.note}</div>
                    )}
                  </div>
                  <Badge variant={config.badgeVariant}>
                    {config.sign}
                    {movement.quantity}
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
