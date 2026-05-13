import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { MovementForm } from "@/components/movement/MovementForm";

export const Route = createFileRoute("/operador/retirada")({
  head: () => ({ meta: [{ title: "Retirada · Operador Cinépolis" }] }),
  component: () => (
    <>
      <PageHeader title="Retirada de Produtos" subtitle="Registre saídas (matrícula e senha obrigatórias)" />
      <MovementForm type="saida" requireAuth useStoredStock />
    </>
  ),
});
