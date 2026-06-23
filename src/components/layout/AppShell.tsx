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
  HelpCircle,
  LogOut,
  Menu,
  X,
  History,
  Warehouse,
  Trash2,
  Boxes,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { clearSession, getStoredUser } from "@/services/api";
import {
  GlobalSearch,
  GlobalSearchPage,
  type GlobalSearchViewState,
} from "@/components/layout/GlobalSearch";

import zyntraIcon from "@/icones/android-chrome-512x512.png";

type NavItem = { to: string; label: string; icon: LucideIcon };

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/estoques", label: "Estoques", icon: Warehouse },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/kits", label: "Kit Caixa", icon: Boxes },
  { to: "/admin/entrada", label: "Entrada de Produtos", icon: ArrowDownToLine },
  { to: "/admin/retirada", label: "Retirada de Produtos", icon: ArrowUpFromLine },
  { to: "/admin/desperdicios", label: "Desperdícios", icon: Trash2 },
  { to: "/admin/movimentacoes", label: "Movimentações", icon: ListOrdered },
  { to: "/admin/inventario", label: "Inventário", icon: ClipboardList },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

const operadorNav: NavItem[] = [
  { to: "/operador/entrada", label: "Entrada de Produtos", icon: ArrowDownToLine },
  { to: "/operador/retirada", label: "Retirada de Produtos", icon: ArrowUpFromLine },
  { to: "/operador/kits", label: "Retirada de Kit", icon: Boxes },
  { to: "/operador/desperdicio", label: "Registrar desperdício", icon: Trash2 },
  { to: "/operador/historico", label: "Histórico", icon: History },
];

interface AppShellProps {
  variant: "admin" | "operador";
  children: ReactNode;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-background p-1 shadow-[var(--shadow-elegant)] sm:h-10 sm:w-10 sm:rounded-2xl">
        <img src={zyntraIcon} alt="" className="h-full w-full object-contain" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold text-sidebar-accent-foreground">Zytrex</div>
        <div className="truncate text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Inventory
        </div>
      </div>
    </div>
  );
}

export function AppShell({ variant, children }: AppShellProps) {
  const nav = variant === "admin" ? adminNav : operadorNav;
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [operatorStockName, setOperatorStockName] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("Administrador");
  const [globalSearchView, setGlobalSearchView] = useState<GlobalSearchViewState | null>(null);

  const userLabel = variant === "admin" ? adminName : "Modo Operacional";
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

  useEffect(() => {
    setGlobalSearchView(null);
  }, [path]);

  useEffect(() => {
    const updateScrollTopVisibility = () => {
      setShowScrollTop(window.scrollY > 420);
    };

    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateScrollTopVisibility);
  }, [path]);

  useEffect(() => {
    if (!mobileOpen) return;

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, [mobileOpen]);

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navLinkClass = (active: boolean) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
      active
        ? "zyntra-gradient text-white shadow-[var(--shadow-elegant)]"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground shadow-2xl backdrop-blur-xl lg:flex">
        <div className="flex h-20 items-center px-5">
          <Brand />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link key={item.to} to={item.to} className={navLinkClass(active)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex overflow-hidden overscroll-none lg:hidden">
          <div
            className="absolute inset-0 touch-none bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-dvh w-72 max-w-[82vw] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex h-20 items-center justify-between px-5">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(active)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={signOut}
              className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-6">
          <button
            className="-ml-1 rounded-xl p-2 transition hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1 lg:hidden">
            <Brand />
          </div>

          {variant === "admin" && (
            <GlobalSearch
              onOpenSearch={setGlobalSearchView}
              onCloseSearch={() => setGlobalSearchView(null)}
            />
          )}
          <div className="hidden flex-1 sm:block" />

          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-2 text-muted-foreground sm:inline-flex"
          >
            <HelpCircle className="h-4 w-4" /> Ajuda
          </Button>

          {variant === "operador" && operatorStockName && (
            <div className="hidden items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs md:flex">
              <span className="text-muted-foreground">Estoque atual:</span>
              <span className="font-medium text-foreground">{operatorStockName}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={changeOperatorStock}
              >
                Trocar
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-medium text-foreground">{userLabel}</div>
              <div className="text-[11px] text-muted-foreground">
                {variant === "admin" ? "Acesso total" : "Acesso operacional"}
              </div>
            </div>
            <Avatar className="h-9 w-9 border border-primary/15 bg-card sm:h-10 sm:w-10">
              <AvatarFallback className="zyntra-gradient text-xs font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-3 sm:p-6 lg:p-8">
          {variant === "admin" && globalSearchView ? (
            <GlobalSearchPage
              initialQuery={globalSearchView.query}
              initialSelection={globalSearchView.selection}
              onClose={() => setGlobalSearchView(null)}
            />
          ) : (
            children
          )}
        </main>
      </div>

      <button
        type="button"
        aria-label="Voltar ao topo"
        onClick={scrollToTop}
        className={`fixed bottom-5 left-1/2 z-30 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 md:hidden ${
          showScrollTop && !mobileOpen
            ? "scale-100 translate-y-0 opacity-100"
            : "pointer-events-none scale-90 translate-y-6 opacity-0"
        }`}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </div>
  );
}
