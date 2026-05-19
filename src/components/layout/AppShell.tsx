import { ReactNode, useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ListOrdered,
  ClipboardList,
  Users,
  Settings,
  Search,
  HelpCircle,
  LogOut,
  Menu,
  X,
  History,
  Film,
  Warehouse,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { clearSession, getStoredUser } from "@/services/api";

type NavItem = { to: string; label: string; icon: any };

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/estoques", label: "Estoques", icon: Warehouse },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/entrada", label: "Entrada de Produtos", icon: ArrowDownToLine },
  { to: "/admin/retirada", label: "Retirada de Produtos", icon: ArrowUpFromLine },
  { to: "/admin/desperdicios", label: "Desperdicios", icon: Trash2 },
  { to: "/admin/movimentacoes", label: "Movimentações", icon: ListOrdered },
  { to: "/admin/inventario", label: "Inventário", icon: ClipboardList },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

const operadorNav: NavItem[] = [
  { to: "/operador/entrada", label: "Entrada de Produtos", icon: ArrowDownToLine },
  { to: "/operador/retirada", label: "Retirada de Produtos", icon: ArrowUpFromLine },
  { to: "/operador/desperdicio", label: "Registrar desperdicio", icon: Trash2 },
  { to: "/operador/historico", label: "Histórico", icon: History },
];

interface AppShellProps {
  variant: "admin" | "operador";
  children: ReactNode;
}

export function AppShell({ variant, children }: AppShellProps) {
  const nav = variant === "admin" ? adminNav : operadorNav;
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [operatorStockName, setOperatorStockName] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("Administrador");

  const userLabel = variant === "admin" ? adminName : "Modo Operador";
  const initials =
    variant === "admin"
      ? adminName
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "AD"
      : "OP";

  const isActive = (to: string) =>
    to === `/${variant}` ? path === to : path === to || path.startsWith(to + "/");

  useEffect(() => {
    if (variant !== "operador") return;
    const raw = localStorage.getItem("cinepolis.estoque");
    const estoque = raw ? JSON.parse(raw) : null;
    setOperatorStockName(estoque?.nome ?? null);
  }, [variant, path]);

  useEffect(() => {
    if (variant !== "admin") return;
    const user = getStoredUser();
    setAdminName(user?.nome || "Administrador");
  }, [variant, path]);

  const changeOperatorStock = () => {
    localStorage.removeItem("cinepolis.estoque");
    setOperatorStockName(null);
    navigate({ to: "/operador" });
  };

  const signOut = () => {
    clearSession();
    localStorage.removeItem("cinepolis.estoque");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-64 flex-col bg-sidebar text-sidebar-foreground shadow-lg">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-[var(--shadow-elegant)]">
            <Film className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-white">Cinépolis</div>
            <div className="text-[11px] text-sidebar-foreground/60">Controle de Estoque</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-elegant)]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-sidebar text-sidebar-foreground flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                  <Film className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="font-semibold text-white">Cinépolis</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-white/80">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={signOut}
              className="m-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header className="h-16 border-b bg-card flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar produtos, códigos…" className="pl-9 bg-muted/50 border-0" />
          </div>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex gap-2 text-muted-foreground"
          >
            <HelpCircle className="h-4 w-4" /> Ajuda
          </Button>
          {variant === "operador" && operatorStockName && (
            <div className="hidden md:flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Estoque atual:</span>
              <span className="font-medium">{operatorStockName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={changeOperatorStock}
              >
                Trocar estoque
              </Button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-sm font-medium">{userLabel}</div>
              <div className="text-[11px] text-muted-foreground">
                {variant === "admin" ? "Acesso total" : "Acesso limitado"}
              </div>
            </div>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
