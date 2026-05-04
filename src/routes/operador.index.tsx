import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/operador/")({
  component: () => <Navigate to="/operador/entrada" />,
});
