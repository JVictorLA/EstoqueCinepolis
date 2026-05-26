import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { MovementForm } from "@/components/movement/MovementForm";

export const Route = createFileRoute("/operador/entrada")({
  head: () => ({ meta: [{ title: "Entrada · Zytrex Inventory" }] }),
  component: () => (
    <>
      <PageHeader title="Entrada de Produtos" subtitle="Adicione quantidade ao estoque (matrícula e senha obrigatórias)" />
      <MovementForm type="entrada" requireAuth useStoredStock />
    </>
  ),
});
