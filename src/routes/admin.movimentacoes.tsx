import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownCircle, ArrowUpCircle, Clock, Package, Printer, Trash2, UserRound, Warehouse } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getMovements } from "@/services/api";
import { cn } from "@/lib/utils";
import type { Movement } from "@/types";

export const Route = createFileRoute("/admin/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações · Cinepolis" }] }),
  component: MovsPage,
});

function movementLabel(type: Movement["type"]) {
  if (type === "entrada") return "Entrada";
  if (type === "desperdicio") return "Desperdício";
  return "Saída";
}

function movementConfig(type: Movement["type"]) {
  if (type === "entrada") {
    return {
      icon: ArrowDownCircle,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      amount: "text-emerald-700",
      sign: "+",
    };
  }

  if (type === "desperdicio") {
    return {
      icon: Trash2,
      tone: "text-rose-700 bg-rose-50 border-rose-200",
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      amount: "text-rose-700",
      sign: "-",
    };
  }

  return {
    icon: ArrowUpCircle,
    tone: "text-amber-700 bg-amber-50 border-amber-200",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    amount: "text-amber-700",
    sign: "-",
  };
}

function movementDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return movementDateKey(new Date().toISOString());
}

function formatShortDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

function formatGroupDate(key: string) {
  if (key === todayKey()) return "Hoje";

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMovementTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayLot(lotCode?: string | null) {
  if (!lotCode || lotCode === "__SEM_LOTE__") return null;
  return lotCode;
}

function MovementCard({ movement }: { movement: Movement }) {
  const config = movementConfig(movement.type);
  const Icon = config.icon;
  const lot = displayLot(movement.lotCode);

  return (
    <article className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md md:grid-cols-[86px_44px_minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground md:block">
        <Clock className="h-4 w-4 md:hidden" />
        <span>{formatMovementTime(movement.createdAt)}</span>
      </div>

      <div className={cn("flex h-11 w-11 items-center justify-center rounded-full border", config.tone)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">{movement.productName}</h3>
          <Badge variant="outline" className={cn("rounded-full", config.badge)}>
            {movementLabel(movement.type)}
          </Badge>
          {movement.ignoredFefo ? (
            <Badge variant="outline" className="rounded-full border-orange-200 bg-orange-50 text-orange-700">
              FEFO ignorado
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Warehouse className="h-3.5 w-3.5" />
            {movement.estoqueNome ?? "Sem estoque"}
          </span>
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5" />
            {movement.userName}
          </span>
          {lot ? (
            <span className="inline-flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              Lote {lot}
            </span>
          ) : null}
        </div>

        {movement.note ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{movement.note}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3 md:block md:border-0 md:pt-0 md:text-right">
        <span className="text-xs font-medium text-muted-foreground md:hidden">Quantidade</span>
        <div className={cn("text-lg font-bold tabular-nums", config.amount)}>
          {config.sign}
          {movement.quantity}
        </div>
      </div>
    </article>
  );
}

function MovsPage() {
  const [movs, setMovs] = useState<Movement[]>([]);

  useEffect(() => {
    getMovements().then(setMovs);
  }, []);

  const groupedMovements = useMemo(() => {
    const groups = new Map<string, Movement[]>();

    movs.forEach((movement) => {
      const key = movementDateKey(movement.createdAt);
      const items = groups.get(key) ?? [];
      items.push(movement);
      groups.set(key, items);
    });

    return Array.from(groups.entries()).map(([key, movements]) => ({
      key,
      label: formatGroupDate(key),
      shortDate: formatShortDate(key),
      movements,
    }));
  }, [movs]);

  return (
    <>
      <PageHeader
        title="Movimentações"
        subtitle="Histórico completo de entradas, saídas e desperdícios"
        actions={
          <Button variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir relatório
          </Button>
        }
      />

      <section className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-4">
          <Input type="date" className="w-auto bg-background" />
          <Select>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="saida">Saída</SelectItem>
              <SelectItem value="desperdicio">Desperdício</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {movs.length === 0 ? (
          <EmptyState icon={Activity} title="Sem movimentações" description="As movimentações aparecerão aqui após o primeiro registro." />
        ) : (
          <div className="space-y-6 bg-muted/15 p-4 sm:p-5">
            {groupedMovements.map((group) => (
              <section key={group.key} className="space-y-3">
                <header className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
                    <p className="text-xs text-muted-foreground">{group.shortDate}</p>
                  </div>
                  <div className="h-px min-w-12 flex-1 bg-border" />
                  <Badge variant="outline" className="rounded-full bg-background text-muted-foreground">
                    {group.movements.length} {group.movements.length === 1 ? "movimentação" : "movimentações"}
                  </Badge>
                </header>

                <div className="space-y-2">
                  {group.movements.map((movement) => (
                    <MovementCard key={movement.id} movement={movement} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
