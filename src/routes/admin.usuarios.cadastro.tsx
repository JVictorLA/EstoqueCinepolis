import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { createUser } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/usuarios/cadastro")({
  head: () => ({ meta: [{ title: "Cadastro de usuario · Zytrex Inventory" }] }),
  component: UserCreatePage,
});

function UserCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [matricula, setMatricula] = useState("");
  const [role, setRole] = useState<"admin" | "operador">("operador");
  const [saving, setSaving] = useState(false);

  const goBack = () => navigate({ to: "/admin/usuarios" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSaving(true);
    try {
      await createUser({
        nome: name,
        matricula,
        tipo: role,
        ativo: true,
        email: "",
      });

      toast.success(
        "Usuario criado com senha temporaria. A troca sera obrigatoria no proximo acesso.",
      );
      goBack();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar usuario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cadastro de usuario"
        subtitle="Crie um novo acesso para administrador ou operador."
        actions={
          <Button variant="outline" className="gap-2" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card shadow-[var(--shadow-soft)] sm:rounded-xl">
        <form onSubmit={submit}>
          <div className="grid gap-4 p-4 sm:p-6 md:max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome do usuario"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-matricula">Matricula</Label>
              <Input
                id="user-matricula"
                value={matricula}
                onChange={(event) => setMatricula(event.target.value)}
                placeholder="Matricula"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={role} onValueChange={(value) => setRole(value as "admin" | "operador")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-600">
              O usuario sera criado com uma senha temporaria e devera troca-la no proximo acesso.
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t p-4">
            <Button type="button" variant="ghost" onClick={goBack} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Cadastrar
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
