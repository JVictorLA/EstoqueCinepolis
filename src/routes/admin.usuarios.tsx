import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createUser, updateUser, changeUserPassword } from "@/services/api";
import { Users, Plus } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { getUsers, setUserStatus } from "@/services/api";
import type { SystemUser } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<SystemUser | null>(null);

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

      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, active: ativo } : u
        )
      );

      toast.success(`Usuário ${ativo ? "ativado" : "desativado"}`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status");
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

      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário cadastrado" />
        ) : (
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
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "Administrador" : "Operador"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Switch
                      checked={u.active}
                      onCheckedChange={(checked) =>
                        toggleUserStatus(u.id, checked)
                      }
                    />
                  </TableCell>

                  <TableCell className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditUser(u)}
                    >
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteUser(u)}
                    >
                      
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>


      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        {editUser && (
          <EditUserDialog
            user={editUser}
            onClose={() => setEditUser(null)}
            onSuccess={loadUsers}
          />
        )}
      </Dialog>
      
    </>
    
  );
}

function EditUserDialog({ user, onClose, onSuccess }: any) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);

  const [changePassword, setChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const submit = async (e: any) => {
    e.preventDefault();

    try {
      await updateUser(user.id, {
        nome: name,
        tipo: role,
      });

      if (changePassword) {
        await changeUserPassword(user.id, oldPassword, newPassword);
      }

      toast.success("Usuário atualizado");

      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar");
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
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operador">Operador</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setChangePassword(!changePassword)}
        >
          Alterar senha
        </Button>

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
          <Button type="submit">
            Salvar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}


function NewUserDialog({ onClose, onSuccess }: any) {
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");

  const resetForm = () => {
    setName("");
    setMatricula("");
    setRole("operador");
  };

  const submit = async (e: any) => {
    e.preventDefault();

    try {
      await createUser({
        nome: name,
        matricula,
        senha: "123456", // ✅ SENHA PADRÃO
        tipo: role,
        ativo: true,
        email: "",
      });

      toast.success("Usuário criado com senha padrão: 123456");

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo usuário</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        <Input
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          placeholder="Matrícula"
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
        />

        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "operador")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="operador">Operador</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
          </SelectContent>
        </Select>

        {/* 🔥 AVISO VISUAL */}
        <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          ⚠️ O usuário será criado com a senha padrão: <b>123456</b>
        </div>

        <DialogFooter>
          <Button type="submit">Cadastrar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}