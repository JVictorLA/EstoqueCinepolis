import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createUser,
  updateUser,
  changeUserPassword,
  resetUserPassword,
  deleteUser,
  getStoredUser,
  getUsers,
  setUserStatus,
} from "@/services/api";
import { Users, Plus, Trash2 } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);
  const loggedUserId = getStoredUser()?.id;

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleUserStatus = async (id: number, ativo: boolean) => {
    try {
      await setUserStatus(id, ativo);

      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: ativo } : u)));

      toast.success(`Usuário ${ativo ? "ativado" : "desativado"}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar status");
    }
  };

  const canShowDelete = (user: SystemUser) => user.canDelete && user.id !== loggedUserId;

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

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie administradores e operadores"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo usuário
              </Button>
            </DialogTrigger>
            <NewUserDialog onClose={() => setOpen(false)} onSuccess={loadUsers} />
          </Dialog>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário cadastrado" />
        ) : (
          <>
          <div className="divide-y md:hidden">
            {users.map((u) => (
              <div key={u.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{u.matricula}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        variant={
                          u.role === "master"
                            ? "destructive"
                            : u.role === "admin"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {u.role === "master"
                          ? "Master"
                          : u.role === "admin"
                            ? "Admin"
                            : "Operador"}
                      </Badge>
                      {u.role === "master" && (
                        <span className="text-xs text-muted-foreground">Protegido</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Switch
                      checked={u.active}
                      disabled={u.role === "master"}
                      onCheckedChange={(checked) => toggleUserStatus(u.id, checked)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
                      Editar
                    </Button>
                    {canShowDelete(u) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(u)}
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
                <TableHead>Matrícula</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.matricula}</TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        u.role === "master"
                          ? "destructive"
                          : u.role === "admin"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {u.role === "master"
                        ? "Master"
                        : u.role === "admin"
                          ? "Administrador"
                          : "Operador"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Switch
                      checked={u.active}
                      disabled={u.role === "master"}
                      onCheckedChange={(checked) => toggleUserStatus(u.id, checked)}
                    />
                    {u.role === "master" && (
                      <div className="text-xs text-muted-foreground mt-1">Protegido</div>
                    )}
                  </TableCell>

                  <TableCell className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>
                      Editar
                    </Button>
                    {canShowDelete(u) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir usuario</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          </>
        )}
      </div>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        {editUser && (
          <EditUserDialog user={editUser} onClose={() => setEditUser(null)} onSuccess={loadUsers} />
        )}
      </Dialog>

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

function EditUserDialog({
  user,
  onClose,
  onSuccess,
}: {
  user: SystemUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<"admin" | "operador">(
    user.role === "admin" ? "admin" : "operador",
  );
  const isMaster = user.role === "master";

  const [changePassword, setChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPassword, setResetPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateUser(user.id, {
        nome: name,
        tipo: isMaster ? undefined : role,
      });

      if (changePassword) {
        await changeUserPassword(user.id, oldPassword, newPassword);
      }

      if (resetPassword && !isMaster) {
        await resetUserPassword(user.id);
      }
      toast.success("Usuário atualizado");

      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar usuário</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label>Matrícula</Label>
          <Input value={user.matricula} disabled />
        </div>

        <div>
          <Label>Tipo</Label>
          <Select
            value={isMaster ? "master" : role}
            onValueChange={(value) => setRole(value as "admin" | "operador")}
            disabled={isMaster}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isMaster && <SelectItem value="master">Master</SelectItem>}
              <SelectItem value="operador">Operador</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
          {isMaster && (
            <p className="mt-1 text-xs text-muted-foreground">
              Usu?rio master n?o pode ter o tipo alterado pelo CRUD comum.
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChangePassword(!changePassword)}
            >
              Alterar senha
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={isMaster}
              onClick={() => setResetPassword(!resetPassword)}
            >
              Resetar senha
            </Button>
          </div>
        </div>
        {resetPassword && (
          <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
             A senha será redefinida para: uma senha temporária
            <br />O usuário será obrigado a criar uma nova senha no próximo acesso.
          </div>
        )}
        {isMaster && (
          <div className="text-sm text-muted-foreground bg-muted/40 border p-3 rounded-lg">
            Usu?rio master n?o pode ser desativado, resetado ou transformado pelo CRUD comum.
          </div>
        )}
        {changePassword && (
          <>
            <Input
              type="password"
              placeholder="Senha atual"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function NewUserDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");

  const resetForm = () => {
    setName("");
    setMatricula("");
    setRole("operador");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createUser({
        nome: name,
        matricula,
        tipo: role,
        ativo: true,
        email: "",
      });

      toast.success("Usuário criado com senha temporária. A troca será obrigatória no próximo acesso.");

      onSuccess();
      onClose();
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuário");
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo usuário</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />

        <Input
          placeholder="Matrícula"
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
        />

        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "operador")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>

        {/*  AVISO VISUAL */}
        <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          O usuário será criado com uma senha temporária e deverá trocá-la no próximo acesso.
        </div>

        <DialogFooter>
          <Button type="submit">Cadastrar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
