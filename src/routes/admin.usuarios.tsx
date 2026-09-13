import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  deleteUser,
  getStoredUser,
  getUsers,
  restoreUser,
  setUserStatus,
} from "@/services/api";
import { Archive, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SystemUser } from "@/types";
import { toast } from "sonner";

type UserView = "usuarios" | "arquivados";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [view, setView] = useState<UserView>("usuarios");
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const loggedUserId = getStoredUser()?.id;

  const activeUsers = useMemo(() => users.filter((user) => !user.archived && user.active), [users]);
  const inactiveUsers = useMemo(
    () => users.filter((user) => !user.archived && !user.active),
    [users],
  );
  const archivedUsers = useMemo(() => users.filter((user) => user.archived), [users]);
  const visibleUsers = view === "arquivados" ? archivedUsers : [...activeUsers, ...inactiveUsers];
  const visibleCountLabel =
    view === "arquivados"
      ? `${archivedUsers.length} ${archivedUsers.length === 1 ? "usuario arquivado" : "usuarios arquivados"}`
      : `${visibleUsers.length} ${visibleUsers.length === 1 ? "usuario cadastrado" : "usuarios cadastrados"}`;

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
  };

  useEffect(() => {
    if (pathname === "/admin/usuarios") {
      loadUsers();
    }
  }, [pathname]);

  const toggleUserStatus = async (id: number, ativo: boolean) => {
    try {
      const updated = await setUserStatus(id, ativo);
      setUsers((prev) => prev.map((user) => (user.id === id ? updated : user)));
      toast.success(`Usuario ${ativo ? "ativado" : "desativado"}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar status");
    }
  };

  const canShowDelete = (user: SystemUser) => user.canDelete && user.id !== loggedUserId;

  const openEditUser = (user: SystemUser) => {
    navigate({ to: "/admin/usuarios/editar/$userId", params: { userId: String(user.id) } });
  };

  const restoreArchivedUser = async (user: SystemUser) => {
    setRestoringId(user.id);
    try {
      const updated = await restoreUser(user.id);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Usuario restaurado como inativo");
      setView("usuarios");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao restaurar usuario");
    } finally {
      setRestoringId(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;

    try {
      await deleteUser(deleteTarget.id);
      toast.success("Usuario excluido");
      setDeleteTarget(null);
      await loadUsers();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir usuario");
    }
  };

  const emptyTitle =
    view === "arquivados" ? "Nenhum usuario arquivado" : "Nenhum usuario cadastrado";

  if (pathname === "/admin/usuarios/cadastro" || pathname.startsWith("/admin/usuarios/editar/")) {
    return <Outlet />;
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={visibleCountLabel}
        actions={
          <Button className="gap-2" onClick={() => navigate({ to: "/admin/usuarios/cadastro" })}>
            <Plus className="h-4 w-4" /> Novo usuario
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        <div className="border-b bg-muted/20 p-3 sm:p-4">
          <Tabs value={view} onValueChange={(value) => setView(value as UserView)}>
            <TabsList>
              <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
              <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {visibleUsers.length === 0 ? (
          <EmptyState
            icon={view === "arquivados" ? Archive : Users}
            title={emptyTitle}
            description={
              view === "arquivados"
                ? "Usuarios arquivados aparecerao aqui e poderao ser restaurados."
                : "Cadastre o primeiro usuario para controlar o acesso ao sistema."
            }
          />
        ) : view === "arquivados" ? (
          <UserList
            users={archivedUsers}
            view={view}
            loggedUserId={loggedUserId}
            restoringId={restoringId}
            onEdit={openEditUser}
            onDelete={setDeleteTarget}
            onRestore={restoreArchivedUser}
            onToggleStatus={toggleUserStatus}
            canShowDelete={canShowDelete}
          />
        ) : (
          <>
            <UserGroupTitle label="Ativos" count={activeUsers.length} />
            {activeUsers.length > 0 ? (
              <UserList
                users={activeUsers}
                view={view}
                loggedUserId={loggedUserId}
                restoringId={restoringId}
                onEdit={openEditUser}
                onDelete={setDeleteTarget}
                onRestore={restoreArchivedUser}
                onToggleStatus={toggleUserStatus}
                canShowDelete={canShowDelete}
              />
            ) : (
              <div className="border-b px-4 py-6 text-sm text-muted-foreground">
                Nenhum usuario ativo.
              </div>
            )}

            <UserGroupTitle label="Desativados" count={inactiveUsers.length} />
            {inactiveUsers.length > 0 ? (
              <UserList
                users={inactiveUsers}
                view={view}
                loggedUserId={loggedUserId}
                restoringId={restoringId}
                onEdit={openEditUser}
                onDelete={setDeleteTarget}
                onRestore={restoreArchivedUser}
                onToggleStatus={toggleUserStatus}
                canShowDelete={canShowDelete}
              />
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Nenhum usuario desativado.
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa acao nao pode ser desfeita. O usuario {deleteTarget?.name} sera removido do
              sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteUser}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UserGroupTitle({ label, count }: { label: string; count: number }) {
  return (
    <div className="border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label} ({count})
    </div>
  );
}

function UserList({
  users,
  view,
  loggedUserId,
  restoringId,
  onEdit,
  onDelete,
  onRestore,
  onToggleStatus,
  canShowDelete,
}: {
  users: SystemUser[];
  view: UserView;
  loggedUserId?: number;
  restoringId: number | null;
  onEdit: (user: SystemUser) => void;
  onDelete: (user: SystemUser) => void;
  onRestore: (user: SystemUser) => void;
  onToggleStatus: (id: number, active: boolean) => void;
  canShowDelete: (user: SystemUser) => boolean | undefined;
}) {
  return (
    <>
      <div className="divide-y md:hidden">
        {users.map((user) => (
          <div key={user.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{user.matricula}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge user={user} />
                  <UserStatusBadge user={user} />
                  {user.role === "master" && (
                    <span className="text-xs text-muted-foreground">Protegido</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {view === "arquivados" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={restoringId === user.id}
                    onClick={() => onRestore(user)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar
                  </Button>
                ) : (
                  <>
                    <Switch
                      checked={user.active}
                      disabled={user.role === "master" || user.id === loggedUserId}
                      onCheckedChange={(checked) => onToggleStatus(user.id, checked)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => onEdit(user)}>
                      Editar
                    </Button>
                  </>
                )}
                {canShowDelete(user) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(user)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Excluir usuario</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Matricula</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Acoes</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.matricula}</TableCell>
                <TableCell>
                  <RoleBadge user={user} />
                </TableCell>
                <TableCell>
                  {view === "arquivados" ? (
                    <UserStatusBadge user={user} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.active}
                        disabled={user.role === "master" || user.id === loggedUserId}
                        onCheckedChange={(checked) => onToggleStatus(user.id, checked)}
                      />
                      {user.role === "master" && (
                        <span className="text-xs text-muted-foreground">Protegido</span>
                      )}
                      {user.id === loggedUserId && user.role !== "master" && (
                        <span className="text-xs text-muted-foreground">Sua conta</span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {view === "arquivados" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={restoringId === user.id}
                        onClick={() => onRestore(user)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restaurar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(user)}>
                        Editar
                      </Button>
                    )}
                    {canShowDelete(user) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir usuario</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function RoleBadge({ user }: { user: SystemUser }) {
  return (
    <Badge
      variant={
        user.role === "master" ? "destructive" : user.role === "admin" ? "default" : "secondary"
      }
    >
      {user.role === "master" ? "Master" : user.role === "admin" ? "Administrador" : "Operador"}
    </Badge>
  );
}

function UserStatusBadge({ user }: { user: SystemUser }) {
  if (user.archived) {
    return <Badge variant="secondary">Arquivado</Badge>;
  }

  return (
    <Badge variant={user.active ? "default" : "secondary"}>
      {user.active ? "Ativo" : "Inativo"}
    </Badge>
  );
}
