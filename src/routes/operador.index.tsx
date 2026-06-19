import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, LogOut, Warehouse } from "lucide-react";
import { EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { clearSession, getEstoques } from "@/services/api";
import type { Estoque } from "@/types";
import { toast } from "sonner";

import zytrexIcon from "@/icones/android-chrome-512x512.png";

export const Route = createFileRoute("/operador/")({
  head: () => ({ meta: [{ title: "Selecionar estoque · Zytrex Inventory" }] }),
  component: OperadorIndex,
});

function OperatorBrandLogo() {
  return (
    <div className="flex items-center gap-3">
      <img src={zytrexIcon} alt="" className="h-12 w-12 object-contain sm:h-24 sm:w-24" />
      <div className="leading-none">
        <div className="text-2xl font-bold tracking-normal text-foreground sm:text-5xl">
          Zytrex
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary sm:mt-2 sm:text-sm sm:tracking-[0.32em]">
          Inventory
        </div>
      </div>
    </div>
  );
}

function OperadorIndex() {
  const navigate = useNavigate();
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEstoques()
      .then((data) => {
        const ativos = data.filter((estoque) => estoque.ativo);
        setEstoques(ativos);
        if (ativos[0]) setSelectedEstoqueId(String(ativos[0].id));
      })
      .catch(() => toast.error("Erro ao carregar estoques"))
      .finally(() => setLoading(false));
  }, []);

  const selectedEstoque = useMemo(
    () => estoques.find((item) => String(item.id) === selectedEstoqueId) ?? null,
    [estoques, selectedEstoqueId],
  );

  const enterOperatorMode = () => {
    if (!selectedEstoque) {
      toast.error("Selecione um estoque");
      return;
    }

    localStorage.setItem("cinepolis.estoque", JSON.stringify(selectedEstoque));
    navigate({ to: "/operador/retirada" });
  };

  const signOut = () => {
    clearSession();
    localStorage.removeItem("cinepolis.estoque");
    navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.45))] text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-5 sm:py-6">
        <OperatorBrandLogo />
        <Button variant="ghost" size="sm" className="gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-6xl items-center gap-5 px-4 pb-8 sm:gap-10 sm:px-5 sm:pb-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Warehouse className="h-3.5 w-3.5 text-primary" />
            Modo operacional
          </div>

          <div className="space-y-3">
            <h1 className="max-w-xl text-2xl font-semibold tracking-normal text-foreground sm:text-5xl">
              Selecione o estoque de trabalho
            </h1>
            <p className="hidden max-w-lg text-base leading-7 text-muted-foreground sm:block">
              Escolha o estoque antes de iniciar as retiradas. Depois disso, o menu operacional
              sera liberado somente para o estoque selecionado.
            </p>
          </div>

          <div className="hidden max-w-xs gap-3 text-sm sm:grid">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-2xl font-semibold">{estoques.length}</div>
              <div className="text-xs text-muted-foreground">estoques ativos</div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card/95 p-4 shadow-[var(--shadow-soft)] backdrop-blur sm:rounded-xl sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Estoques disponiveis</h2>
              <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                Toque no estoque que sera usado neste terminal.
              </p>
            </div>
            {selectedEstoque && (
              <div className="hidden rounded-lg border bg-muted/40 px-3 py-2 text-xs sm:block">
                <span className="text-muted-foreground">Selecionado: </span>
                <span className="font-medium">{selectedEstoque.nome}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando estoques...
            </div>
          ) : estoques.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="Nenhum estoque ativo"
              description="Ative ou cadastre um estoque antes de iniciar o modo operador."
            />
          ) : (
            <>
              <div className="grid max-h-[52vh] gap-2 overflow-y-auto pr-1 sm:max-h-[48vh] sm:grid-cols-2 sm:gap-3">
                {estoques.map((estoque) => {
                  const selected = String(estoque.id) === selectedEstoqueId;
                  return (
                    <button
                      key={estoque.id}
                      type="button"
                      onClick={() => setSelectedEstoqueId(String(estoque.id))}
                      className={`group flex min-h-20 items-start gap-3 rounded-lg border p-3 text-left transition sm:min-h-28 sm:p-4 ${
                        selected
                          ? "border-primary bg-primary/10 shadow-[var(--shadow-soft)]"
                          : "bg-background hover:border-primary/45 hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          selected ? "zyntra-gradient text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {selected ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Warehouse className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{estoque.nome}</div>
                        <div className="mt-1 hidden text-xs text-muted-foreground sm:block">
                          Operacoes serao registradas neste estoque.
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
                <div className="line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                  {selectedEstoque
                    ? `Estoque selecionado: ${selectedEstoque.nome}`
                    : "Selecione um estoque para continuar."}
                </div>
                <Button className="gap-2" size="lg" onClick={enterOperatorMode}>
                  Entrar no modo operacional
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
