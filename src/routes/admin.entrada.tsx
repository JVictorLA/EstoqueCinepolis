import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { MovementForm } from "@/components/movement/MovementForm";

export const Route = createFileRoute("/admin/entrada")({
  head: () => ({ meta: [{ title: "Entrada de Produtos · Cinépolis" }] }),
  component: () => (
    <>
      <PageHeader title="Entrada de Produtos" subtitle="Adicione quantidade ao estoque de produtos já cadastrados" />
      <MovementForm type="entrada" requireAuth={false} />
    </>
  ),
});
