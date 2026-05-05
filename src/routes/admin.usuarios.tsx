import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createUser } from "@/services/api";
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
  head: () => ({ meta: [{ title: "Usuários · Cinépolis" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { getUsers().then(setUsers); }, []);

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

    // atualiza a lista local (sem precisar recarregar tudo)
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
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo usuário</Button>
            </DialogTrigger>
            <NewUserDialog onClose={() => setOpen(false)} onSuccess={loadUsers} />
          </Dialog>
        }
      />
      <div className="rounded-xl bg-card border shadow-[var(--shadow-soft)] overflow-hidden">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum usuário cadastrado" description="Adicione o primeiro usuário para liberar acessos ao sistema." />
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
                  <TableCell className="font-mono text-sm">{u.matricula}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role === "admin" ? "Administrador" : "Operador"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
  checked={u.active}
  onCheckedChange={(checked) => toggleUserStatus(u.id, checked)}
/>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

function NewUserDialog({ 
  onClose, 
  onSuccess 

  
}: { 
  onClose: () => void;
  onSuccess: () => void;
}) {

  
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");
  const [password, setPassword] = useState("");
const resetForm = () => {
  setName("");
  setMatricula("");
  setRole("operador");
  setPassword("");
};
useEffect(() => {
  resetForm();
}, []);
  const submit = async (e: React.FormEvent) => {
  e.preventDefault();

  



  if (!name || !matricula || !password) {
    toast.error("Preencha todos os campos");
    return;
  }

  try {
  await createUser({
    nome: name,
    matricula,
    senha: password,
    tipo: role,
    ativo: true,
    email: "",
  });

  toast.success("Usuário cadastrado com sucesso");

  
  onSuccess();
  onClose();
  resetForm(); // 🔥 limpa tudo

} catch (error: any) {
  toast.error(error.message || "Erro ao cadastrar usuário");
}
};

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Matrícula</Label><Input value={matricula} onChange={(e) => setMatricula(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="operador">Operador</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2"><Label>Senha inicial</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <DialogFooter><Button type="submit">Cadastrar</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
