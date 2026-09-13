import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Archive, ArrowLeft, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  archiveUser,
  changeUserPassword,
  getStoredUser,
  getUsers,
  resetUserPassword,
  updateUser,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/admin/usuarios/editar/$userId")({
  head: () => ({ meta: [{ title: "Editar usuario · Zytrex Inventory" }] }),
  component: UserEditPage,
});

function UserEditPage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<SystemUser | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");
  const [changePassword, setChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPassword, setResetPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const loggedUserId = getStoredUser()?.id;

  const goBack = () => navigate({ to: "/admin/usuarios" });

  useEffect(() => {
    const id = Number(userId);
    if (!Number.isFinite(id)) {
      toast.error("Usuario invalido");
      goBack();
      return;
    }

    getUsers()
      .then((users) => {
        const found = users.find((item) => item.id === id);
        if (!found) {
          toast.error("Usuario nao encontrado");
          goBack();
          return;
        }

        setUser(found);
        setName(found.name);
        setRole(found.role === "admin" ? "admin" : "operador");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar usuario");
        goBack();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isMaster = user?.role === "master";
  const canArchive = !!user && user.role !== "master" && user.id !== loggedUserId && !user.archived;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
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

      toast.success("Usuario atualizado");
      goBack();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const confirmArchiveUser = async () => {
    if (!user) return;

    setArchiving(true);
    try {
      await archiveUser(user.id);
      toast.success("Usuario arquivado");
      goBack();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao arquivar usuario");
    } finally {
      setArchiving(false);
      setArchiveOpen(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Editar usuario"
        subtitle={user ? `${user.name} · ${user.matricula}` : "Carregando usuario..."}
        actions={
          <Button variant="outline" className="gap-2" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando usuario...
          </div>
        ) : user ? (
          <form onSubmit={submit}>
            <div className="grid gap-4 p-4 sm:p-6 md:max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Nome</Label>
                <Input
                  id="edit-user-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user-matricula">Matricula</Label>
                <Input id="edit-user-matricula" value={user.matricula} disabled />
              </div>

              <div className="space-y-2">
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
                  <p className="text-xs text-muted-foreground">
                    Usuario master nao pode ter o tipo alterado pelo CRUD comum.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChangePassword(!changePassword)}
                  disabled={saving}
                >
                  Alterar senha
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  disabled={isMaster || saving}
                  onClick={() => setResetPassword(!resetPassword)}
                >
                  Resetar senha
                </Button>
              </div>

              {resetPassword && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-600">
                  A senha sera redefinida para uma senha temporaria.
                  <br />O usuario sera obrigado a criar uma nova senha no proximo acesso.
                </div>
              )}

              {isMaster && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Usuario master nao pode ser desativado, resetado, arquivado ou transformado pelo
                  CRUD comum.
                </div>
              )}

              {changePassword && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-old-password">Senha atual</Label>
                    <Input
                      id="edit-user-old-password"
                      type="password"
                      value={oldPassword}
                      onChange={(event) => setOldPassword(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-new-password">Nova senha</Label>
                    <Input
                      id="edit-user-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-yellow-500/40 bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-200"
                disabled={!canArchive || saving}
                onClick={() => setArchiveOpen(true)}
              >
                <Archive className="h-4 w-4" />
                Arquivar usuario
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={goBack} disabled={saving}>
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </div>

      <AlertDialog
        open={archiveOpen}
        onOpenChange={(open) => {
          if (!open && !archiving) setArchiveOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuario {user?.name} saira da lista principal e ficara inativo. Ele podera ser
              restaurado depois pela aba Arquivados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={archiving}
              onClick={(event) => {
                event.preventDefault();
                confirmArchiveUser();
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
