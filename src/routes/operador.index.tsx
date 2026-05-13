import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Warehouse } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEstoques } from "@/services/api";
import type { Estoque } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/operador/")({
  component: OperadorIndex,
});

function OperadorIndex() {
  const navigate = useNavigate();
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("");

  useEffect(() => {
    getEstoques().then((data) => {
      const ativos = data.filter((estoque) => estoque.ativo);
      setEstoques(ativos);
      if (ativos[0]) setSelectedEstoqueId(String(ativos[0].id));
    });
  }, []);

  const enterOperatorMode = () => {
    const estoque = estoques.find((item) => String(item.id) === selectedEstoqueId);
    if (!estoque) {
      toast.error("Selecione um estoque");
      return;
    }

    localStorage.setItem("cinepolis.estoque", JSON.stringify(estoque));
    navigate({ to: "/operador/entrada" });
  };

  return (
    <>
      <PageHeader
        title="Selecionar estoque"
        subtitle="Entre no modo operador usando um estoque específico"
      />

      <div className="rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)] max-w-xl">
        {estoques.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Nenhum estoque ativo"
            description="Ative ou cadastre um estoque antes de iniciar o modo operador."
          />
        ) : (
          <div className="space-y-4">
            <Select value={selectedEstoqueId} onValueChange={setSelectedEstoqueId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estoque" />
              </SelectTrigger>
              <SelectContent>
                {estoques.map((estoque) => (
                  <SelectItem key={estoque.id} value={String(estoque.id)}>
                    {estoque.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={enterOperatorMode} className="w-full">
              Entrar no modo operador
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
