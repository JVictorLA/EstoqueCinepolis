import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PackageX, Trash2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { WasteDialog } from "@/components/waste/WasteDialog";
import type { Estoque } from "@/types";

export const Route = createFileRoute("/operador/desperdicio")({
  head: () => ({ meta: [{ title: "Registrar desperdício · Zytrex Inventory" }] }),
  component: OperadorDesperdicioPage,
});

function OperadorDesperdicioPage() {
  const navigate = useNavigate();
  const [estoque, setEstoque] = useState<Estoque | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("cinepolis.estoque");
    const stored = raw ? JSON.parse(raw) : null;
    if (!stored?.id) {
      navigate({ to: "/operador" });
      return;
    }
    setEstoque(stored);
  }, [navigate]);

  return (
    <>
      <PageHeader
        title="Registrar desperdício"
        subtitle={estoque ? `Estoque selecionado: ${estoque.nome}` : "Estoque selecionado"}
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)} disabled={!estoque}>
            <Trash2 className="h-4 w-4" />
            Registrar desperdício
          </Button>
        }
      />

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)]">
        <EmptyState
          icon={PackageX}
          title="Desperdicio no estoque atual"
          description="Use o botao acima para informar produto, quantidade, motivo e credenciais."
          action={
            <Button className="gap-2" onClick={() => setOpen(true)} disabled={!estoque}>
              <Trash2 className="h-4 w-4" />
              Novo registro
            </Button>
          }
        />
      </div>

      {estoque && (
        <WasteDialog
          open={open}
          onOpenChange={setOpen}
          fixedEstoqueId={estoque.id}
          fixedEstoqueName={estoque.nome}
        />
      )}
    </>
  );
}
