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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearSession, getStoredUser } from "@/services/api";
import {
  GlobalSearch,
  GlobalSearchPage,
  type GlobalSearchViewState,
} from "@/components/layout/GlobalSearch";

import zyntraIcon from "@/icones/android-chrome-512x512.png";

const SKIP_LOGIN_INTRO_ONCE_KEY = "zytrex.skipLoginIntroOnce";

type NavItem = { to: string; label: string; icon: LucideIcon };
type HelpTopic = {
  title: string;
  description: string;
  icon: LucideIcon;
  steps: string[];
};

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

const adminHelpTopics: HelpTopic[] = [
  {
    title: "Produtos",
    description: "Use quando precisar cadastrar um novo item ou ajustar informacoes de um produto.",
    icon: Package,
    steps: [
      "Acesse Produtos no menu lateral.",
      "Use Novo produto para cadastrar um item ainda inexistente.",
      "Abra as acoes do produto para editar dados ja cadastrados.",
      "Revise nome, categoria, unidade e dados de controle antes de salvar.",
    ],
  },
  {
    title: "Entrada",
    description:
      "Registre a chegada de produtos para atualizar a quantidade disponivel no estoque.",
    icon: ArrowDownToLine,
    steps: [
      "Acesse Entrada de Produtos.",
      "Selecione o produto e o estoque de destino.",
      "Informe quantidade, validade e demais dados solicitados.",
      "Confira os dados e confirme a entrada.",
    ],
  },
  {
    title: "Retirada",
    description: "Use para registrar saidas do estoque mantendo o historico do responsavel.",
    icon: ArrowUpFromLine,
    steps: [
      "Acesse Retirada de Produtos.",
      "Escolha o produto e o estoque de origem.",
      "Informe a quantidade retirada.",
      "Confirme a operacao para salvar a movimentacao.",
    ],
  },
  {
    title: "Inventario",
    description: "Use para conferir quantidades fisicas e comparar com o saldo do sistema.",
    icon: ClipboardList,
    steps: [
      "Acesse Inventario.",
      "Filtre pelo estoque que sera conferido.",
      "Compare a quantidade fisica com a quantidade registrada.",
      "Registre ajustes apenas depois de revisar as divergencias.",
    ],
  },
  {
    title: "Busca global",
    description: "Pesquise rapidamente produtos e usuarios sem sair da area administrativa.",
    icon: ListOrdered,
    steps: [
      "Use o campo de busca no header.",
      "Digite nome, matricula, codigo ou informacao relacionada.",
      "Selecione um resultado para abrir os detalhes.",
      "Use a tela de detalhes para consultar ou imprimir informacoes.",
    ],
  },
];

const operadorHelpTopics: HelpTopic[] = [
  {
    title: "Escolher estoque",
    description: "Defina qual estoque sera usado nas operacoes do modo operacional.",
    icon: Warehouse,
    steps: [
      "Na entrada do modo operacional, selecione o estoque correto.",
      "Confira o nome exibido no header antes de registrar movimentos.",
      "Use Trocar quando precisar mudar para outro estoque.",
      "Evite registrar entradas ou saidas se o estoque exibido estiver incorreto.",
    ],
  },
  {
    title: "Entrada",
    description: "Registre produtos recebidos no estoque atual com identificacao do responsavel.",
    icon: ArrowDownToLine,
    steps: [
      "Acesse Entrada de Produtos.",
      "Informe sua matricula e senha quando solicitado.",
      "Selecione o produto e preencha a quantidade recebida.",
      "Revise os dados e confirme a entrada.",
    ],
  },
  {
    title: "Retirada",
    description: "Use para baixar produtos consumidos ou retirados do estoque atual.",
    icon: ArrowUpFromLine,
    steps: [
      "Acesse Retirada de Produtos.",
      "Informe sua matricula e senha.",
      "Selecione o produto e a quantidade retirada.",
      "Confirme somente depois de revisar a operacao.",
    ],
  },
  {
    title: "Retirada de Kit",
    description: "Registre a baixa de kits para movimentar todos os itens vinculados corretamente.",
    icon: Boxes,
    steps: [
      "Acesse Retirada de Kit.",
      "Escolha o kit que sera retirado.",
      "Informe a quantidade de kits.",
      "Confirme a retirada para baixar os itens do kit.",
    ],
  },
  {
    title: "Historico",
    description: "Consulte registros ja feitos para acompanhar entradas, saidas e kits.",
    icon: History,
    steps: [
      "Acesse Historico no menu lateral.",
      "Use os filtros disponiveis para localizar registros.",
      "Confira data, responsavel, produto e quantidade.",
      "Use as informacoes para validar operacoes recentes.",
    ],
  },
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
  const [selectedHelpTopic, setSelectedHelpTopic] = useState<HelpTopic | null>(null);

  const helpTopics = variant === "admin" ? adminHelpTopics : operadorHelpTopics;
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
    sessionStorage.setItem(SKIP_LOGIN_INTRO_ONCE_KEY, "true");
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
  const SelectedHelpIcon = selectedHelpTopic?.icon;

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Abrir ajuda"
                className="h-9 w-9 px-0 text-muted-foreground sm:w-auto sm:px-3"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Ajuda</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Guias rapidos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {helpTopics.map((topic) => {
                const Icon = topic.icon;
                return (
                  <DropdownMenuItem
                    key={topic.title}
                    className="cursor-pointer"
                    onSelect={() => setSelectedHelpTopic(topic)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{topic.title}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

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

      <Dialog
        open={!!selectedHelpTopic}
        onOpenChange={(open) => {
          if (!open) setSelectedHelpTopic(null);
        }}
      >
        <DialogContent className="max-w-md">
          {selectedHelpTopic && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {SelectedHelpIcon && <SelectedHelpIcon className="h-5 w-5 text-primary" />}
                  {selectedHelpTopic.title}
                </DialogTitle>
                <DialogDescription>{selectedHelpTopic.description}</DialogDescription>
              </DialogHeader>

              <ol className="space-y-3 text-sm text-foreground">
                {selectedHelpTopic.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Entendi
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
