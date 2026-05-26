import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownCircle, ArrowUpCircle, Clock, Loader2, Package, Printer, Trash2, UserRound, Warehouse } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCategories, getMovements } from "@/services/api";
import { cn } from "@/lib/utils";
import type { Category, Movement, MovementType } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações · Zytrex Inventory" }] }),
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function MovementCard({
  movement,
  onOpenFefo,
}: {
  movement: Movement;
  onOpenFefo: (movement: Movement) => void;
}) {
  const config = movementConfig(movement.type);
  const Icon = config.icon;
  const lot = displayLot(movement.lotCode);
  const canOpenFefo = !!movement.ignoredFefo;

  return (
    <article
      role={canOpenFefo ? "button" : undefined}
      tabIndex={canOpenFefo ? 0 : undefined}
      onClick={() => {
        if (canOpenFefo) onOpenFefo(movement);
      }}
      onKeyDown={(event) => {
        if (!canOpenFefo) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenFefo(movement);
        }
      }}
      className={cn(
        "grid gap-3 rounded-lg border bg-background p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md md:grid-cols-[86px_44px_minmax(0,1fr)_auto] md:items-center",
        canOpenFefo && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFefoMovement, setSelectedFefoMovement] = useState<Movement | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getMovements({
      data_inicial: dateFilter || undefined,
      data_final: dateFilter || undefined,
      categoria_id: categoryFilter !== "all" ? categoryFilter : undefined,
      tipo: typeFilter !== "all" ? typeFilter : undefined,
    })
      .then((items) => {
        if (active) setMovs(items);
      })
      .catch(() => {
        if (active) setMovs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dateFilter, categoryFilter, typeFilter]);

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

  const printReport = () => {
    if (movs.length === 0) {
      toast.info("Nao ha movimentacoes para imprimir com os filtros atuais.");
      return;
    }

    const categoryName =
      categoryFilter === "all"
        ? "Todas categorias"
        : categories.find((category) => String(category.id) === categoryFilter)?.nome ?? "Categoria selecionada";
    const typeName =
      typeFilter === "all"
        ? "Todos"
        : typeFilter === "entrada"
          ? "Entrada"
          : typeFilter === "desperdicio"
            ? "Desperdicio"
            : "Saida";
    const dateName = dateFilter ? formatShortDate(dateFilter) : "Todas as datas";

    const totals = movs.reduce(
      (acc, movement) => {
        const quantity = Number(movement.quantity);
        acc.total += quantity;
        if (movement.type === "entrada") acc.entradas += quantity;
        if (movement.type === "saida") acc.saidas += quantity;
        if (movement.type === "desperdicio") acc.desperdicios += quantity;
        return acc;
      },
      { total: 0, entradas: 0, saidas: 0, desperdicios: 0 },
    );

    const rows = movs
      .map((movement) => {
        const lot = displayLot(movement.lotCode) ?? "-";
        const noteParts = [
          movement.note,
          movement.ignoredFefo
            ? `FEFO ignorado${movement.fefoJustification ? `: ${movement.fefoJustification}` : ""}`
            : null,
        ].filter(Boolean);

        return `
          <tr>
            <td>${escapeHtml(new Date(movement.createdAt).toLocaleString("pt-BR"))}</td>
            <td>${escapeHtml(movementLabel(movement.type))}</td>
            <td>${escapeHtml(movement.productName)}</td>
            <td>${escapeHtml(movement.estoqueNome ?? "Sem estoque")}</td>
            <td>${escapeHtml(lot)}</td>
            <td class="number">${escapeHtml(movement.quantity)}</td>
            <td>${escapeHtml(movement.userName)}</td>
            <td>${escapeHtml(noteParts.join(" | ") || "-")}</td>
          </tr>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      toast.error("Nao foi possivel abrir a janela de impressao. Verifique o bloqueador de pop-ups.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatorio de movimentacoes</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              color: #0f172a;
              background: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
            }
            header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 18px;
              margin-bottom: 18px;
            }
            h1 { margin: 0 0 6px; font-size: 22px; }
            .muted { color: #64748b; }
            .brand { font-weight: 700; color: #4f7cff; }
            .filters, .totals {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
              margin-bottom: 18px;
            }
            .box {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 12px;
            }
            .label {
              display: block;
              margin-bottom: 4px;
              color: #64748b;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: .04em;
            }
            .value { font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            th, td {
              border-bottom: 1px solid #e2e8f0;
              padding: 9px 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f8fafc;
              font-size: 10px;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: .04em;
            }
            .number { text-align: right; font-weight: 700; }
            @media print {
              body { padding: 20px; }
              .filters, .totals { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <div class="brand">Zytrex Inventory</div>
              <h1>Relatorio de Movimentacoes</h1>
              <div class="muted">Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}</div>
            </div>
            <div class="muted">Total de registros: ${escapeHtml(movs.length)}</div>
          </header>

          <section class="filters">
            <div class="box"><span class="label">Data</span><span class="value">${escapeHtml(dateName)}</span></div>
            <div class="box"><span class="label">Categoria</span><span class="value">${escapeHtml(categoryName)}</span></div>
            <div class="box"><span class="label">Tipo</span><span class="value">${escapeHtml(typeName)}</span></div>
            <div class="box"><span class="label">Registros</span><span class="value">${escapeHtml(movs.length)}</span></div>
          </section>

          <section class="totals">
            <div class="box"><span class="label">Entradas</span><span class="value">${escapeHtml(totals.entradas)}</span></div>
            <div class="box"><span class="label">Saidas</span><span class="value">${escapeHtml(totals.saidas)}</span></div>
            <div class="box"><span class="label">Desperdicios</span><span class="value">${escapeHtml(totals.desperdicios)}</span></div>
            <div class="box"><span class="label">Quantidade total</span><span class="value">${escapeHtml(totals.total)}</span></div>
          </section>

          <table>
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Tipo</th>
                <th>Produto</th>
                <th>Estoque</th>
                <th>Lote</th>
                <th class="number">Qtd.</th>
                <th>Funcionario</th>
                <th>Observacao</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <>
      <PageHeader
        title="Movimentações"
        subtitle="Histórico completo de entradas, saídas e desperdícios"
        actions={
          <Button variant="outline" className="gap-2" onClick={printReport} disabled={loading}>
            <Printer className="h-4 w-4" /> Imprimir relatório
          </Button>
        }
      />

      <section className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-4">
          <Input
            type="date"
            className="w-auto bg-background"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as MovementType | "all")}
          >
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
          {(dateFilter || categoryFilter !== "all" || typeFilter !== "all") && (
            <Button
              variant="ghost"
              onClick={() => {
                setDateFilter("");
                setCategoryFilter("all");
                setTypeFilter("all");
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : movs.length === 0 ? (
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
                    <MovementCard
                      key={movement.id}
                      movement={movement}
                      onOpenFefo={setSelectedFefoMovement}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={!!selectedFefoMovement}
        onOpenChange={(open) => {
          if (!open) setSelectedFefoMovement(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificativa FEFO</DialogTitle>
            <DialogDescription>
              Motivo informado pelo funcionario ao retirar um lote fora da ordem recomendada.
            </DialogDescription>
          </DialogHeader>

          {selectedFefoMovement && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="font-semibold text-foreground">
                  {selectedFefoMovement.productName}
                </div>
                <div className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2">
                  <span>Funcionario: {selectedFefoMovement.userName}</span>
                  <span>Lote: {displayLot(selectedFefoMovement.lotCode) ?? "Sem lote"}</span>
                  <span>Quantidade: {selectedFefoMovement.quantity}</span>
                  <span>{formatShortDate(movementDateKey(selectedFefoMovement.createdAt))}</span>
                </div>
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
                {selectedFefoMovement.fefoJustification?.trim() ||
                  "Nenhuma justificativa foi informada para esta movimentacao."}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
