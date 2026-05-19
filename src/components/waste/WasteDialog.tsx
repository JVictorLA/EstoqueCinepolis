import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarcodeInput } from "@/components/scanner/BarcodeInput";
import {
  changeUserPassword,
  getProductByBarcode,
  getUserByMatricula,
  getWasteReasons,
  registerWaste,
} from "@/services/api";
import type { Estoque, Product, WasteReason } from "@/types";
import { toast } from "sonner";

interface EmployeeLookup {
  id: number;
  nome: string;
  precisa_trocar_senha?: boolean;
  precisaTrocarSenha?: boolean;
}

interface WasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estoques?: Estoque[];
  fixedEstoqueId?: number;
  fixedEstoqueName?: string;
  initialBarcode?: string;
  onSaved?: () => void;
}

export function WasteDialog({
  open,
  onOpenChange,
  estoques = [],
  fixedEstoqueId,
  fixedEstoqueName,
  initialBarcode = "",
  onSaved,
}: WasteDialogProps) {
  const [reasons, setReasons] = useState<WasteReason[]>([]);
  const [estoqueId, setEstoqueId] = useState("");
  const [barcode, setBarcode] = useState(initialBarcode);
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [matricula, setMatricula] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<EmployeeLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const selectedEstoqueId = fixedEstoqueId ? String(fixedEstoqueId) : estoqueId;
  const selectedEstoqueName = useMemo(() => {
    if (fixedEstoqueName) return fixedEstoqueName;
    return estoques.find((estoque) => String(estoque.id) === selectedEstoqueId)?.nome;
  }, [estoques, fixedEstoqueName, selectedEstoqueId]);

  useEffect(() => {
    if (!open) return;
    getWasteReasons()
      .then((data) => {
        setReasons(data);
        if (data[0] && !reasonId) setReasonId(String(data[0].id));
      })
      .catch(() => toast.error("Erro ao carregar motivos de desperdicio"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setBarcode(initialBarcode);
  }, [initialBarcode, open]);

  useEffect(() => {
    if (fixedEstoqueId) return;
    const firstActive = estoques.find((estoque) => estoque.ativo) ?? estoques[0];
    if (firstActive && !estoqueId) setEstoqueId(String(firstActive.id));
  }, [estoqueId, estoques, fixedEstoqueId]);

  useEffect(() => {
    if (!barcode || !selectedEstoqueId) {
      setProduct(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      getProductByBarcode(barcode, selectedEstoqueId)
        .then(setProduct)
        .catch(() => setProduct(null));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [barcode, selectedEstoqueId]);

  useEffect(() => {
    if (!matricula) {
      setUser(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      getUserByMatricula(matricula)
        .then(setUser)
        .catch(() => setUser(null));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [matricula]);

  const reset = () => {
    setBarcode("");
    setProduct(null);
    setQuantity("");
    setMatricula("");
    setPassword("");
    setUser(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const save = async () => {
    if (!Number(selectedEstoqueId)) return toast.error("Selecione o estoque");
    if (!barcode.trim()) return toast.error("Informe o codigo de barras");
    if (!Number(reasonId)) return toast.error("Selecione o motivo");
    if (!matricula.trim() || !password) return toast.error("Informe matricula e senha");

    const qtd = Number(quantity);
    if (!Number.isFinite(qtd) || qtd <= 0) return toast.error("Informe uma quantidade valida");
    if (product && qtd > product.stock) return toast.error("Quantidade maior que o estoque atual");

    if (password === "123456" && (user?.precisa_trocar_senha || user?.precisaTrocarSenha)) {
      setChangePasswordOpen(true);
      toast.warning("Primeiro acesso detectado. Crie uma nova senha.");
      return;
    }

    setLoading(true);
    try {
      await registerWaste({
        estoque_id: Number(selectedEstoqueId),
        codigo_barras: barcode.trim(),
        quantidade: qtd,
        motivo_id: Number(reasonId),
        matricula: matricula.trim(),
        senha: password,
      });
      toast.success("Desperdicio registrado");
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar desperdicio");
    } finally {
      setLoading(false);
    }
  };

  const changeFirstPassword = async () => {
    if (!user?.id) return toast.error("Usuario invalido");
    if (!newPassword || !confirmPassword) return toast.error("Preencha os campos");
    if (newPassword !== confirmPassword) return toast.error("As senhas nao coincidem");

    try {
      await changeUserPassword(user.id, "123456", newPassword);
      toast.success("Senha alterada com sucesso");
      toast.info("Repita o desperdicio usando a nova senha");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Criar desperdicio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {fixedEstoqueId ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Estoque: </span>
                <span className="font-medium">{selectedEstoqueName ?? "Selecionado"}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Estoque</Label>
                <Select value={estoqueId} onValueChange={setEstoqueId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estoque" />
                  </SelectTrigger>
                  <SelectContent>
                    {estoques.map((estoque) => (
                      <SelectItem key={estoque.id} value={String(estoque.id)}>
                        {estoque.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <BarcodeInput value={barcode} onChange={setBarcode} />

            {product && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                  Estoque atual: {product.stock} {product.unit}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={reasonId} onValueChange={setReasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((reason) => (
                      <SelectItem key={reason.id} value={String(reason.id)}>
                        {reason.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Matricula</Label>
                <Input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {user && (
              <div className="text-xs text-muted-foreground">
                Funcionario: <span className="font-medium">{user.nome}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              Registrar desperdicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Primeiro acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Crie uma nova senha para continuar.</div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={changeFirstPassword} className="w-full sm:w-auto">
              Salvar nova senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
