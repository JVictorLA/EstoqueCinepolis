import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/operador")({
  component: OperadorLayout,
});

function OperadorLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const selectingStock = pathname === "/operador" || pathname === "/operador/";

  if (selectingStock) {
    return <Outlet />;
  }

  return (
    <AppShell variant="operador">
      <Outlet />
    </AppShell>
  );
}
