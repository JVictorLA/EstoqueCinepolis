import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { MovementForm } from "@/components/movement/MovementForm";

export const Route = createFileRoute("/admin/retirada")({
  head: () => ({ meta: [{ title: "Retirada de Produtos · Cinépolis" }] }),
  component: () => (
    <>
      <PageHeader title="Retirada de Produtos" subtitle="Registre saídas do estoque com identificação do responsável" />
      <MovementForm type="saida" requireAuth />
    </>
  ),
});
