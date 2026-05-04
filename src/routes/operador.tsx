import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/operador")({
  component: () => (
    <AppShell variant="operador">
      <Outlet />
    </AppShell>
  ),
});
