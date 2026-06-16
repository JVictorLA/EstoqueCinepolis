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
  getPasswordChallenge,
  getProductByBarcode,
  getProductLots,
  getUserByMatricula,
  getWasteReasons,
  registerWaste,
} from "@/services/api";
import type { Estoque, Product, ProductLot, WasteReason } from "@/types";
import { toast } from "sonner";
import { passwordChallengeMessage, resolvePasswordStatus } from "@/lib/passwordChallenge";
import { validateWaste } from "@/lib/wasteRules";

interface EmployeeLookup {
  id: number;
  nome: string;
  precisa_trocar_senha?: boolean;
  precisaTrocarSenha?: boolean;
  senha_expirada?: boolean;
  senhaExpirada?: boolean;
  password_status?: "first_access" | "expired";
  passwordStatus?: "first_access" | "expired";
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
  const [availableStockIds, setAvailableStockIds] = useState<number[] | null>(null);
  const [quantity, setQuantity] = useState("");
  const [lot, setLot] = useState("");
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [matricula, setMatricula] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<EmployeeLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<"first_access" | "expired">("first_access");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const selectedEstoqueId = fixedEstoqueId ? String(fixedEstoqueId) : estoqueId;
  const selectedEstoqueName = useMemo(() => {
    if (fixedEstoqueName) return fixedEstoqueName;
    return estoques.find((estoque) => String(estoque.id) === selectedEstoqueId)?.nome;
  }, [estoques, fixedEstoqueName, selectedEstoqueId]);
  const filteredEstoques = useMemo(() => {
    const activeStocks = estoques.filter((estoque) => estoque.ativo);
    if (!availableStockIds) return activeStocks;
    return activeStocks.filter((estoque) => availableStockIds.includes(estoque.id));
  }, [availableStockIds, estoques]);

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
    if (fixedEstoqueId) return;

    const code = barcode.trim();
    if (!code) {
      setAvailableStockIds(null);
      return;
    }

    const activeStocks = estoques.filter((estoque) => estoque.ativo);
    if (!activeStocks.length) {
      setAvailableStockIds([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      Promise.all(
        activeStocks.map((estoque) =>
          getProductByBarcode(code, estoque.id)
            .then((found) => (found ? estoque.id : null))
            .catch(() => null),
        ),
      ).then((ids) => {
        const linkedIds = ids.filter((id): id is number => id !== null);
        setAvailableStockIds(linkedIds);

        if (linkedIds.length && !linkedIds.includes(Number(estoqueId))) {
          setEstoqueId(String(linkedIds[0]));
        } else if (!linkedIds.length) {
          setEstoqueId("");
        }
      });
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [barcode, estoqueId, estoques, fixedEstoqueId]);

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
    if (!product || !selectedEstoqueId) {
      setLots([]);
      return;
    }
    getProductLots(product.id, selectedEstoqueId)
      .then((items) => setLots(items.filter((item) => item.quantity > 0)))
      .catch(() => setLots([]));
  }, [product, selectedEstoqueId]);

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
    setAvailableStockIds(null);
    setQuantity("");
    setLot("");
    setLots([]);
    setMatricula("");
    setPassword("");
    setUser(null);
    setCredentialsOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const validateWasteDetails = () => {
    const validation = validateWaste({
      selectedEstoqueId,
      barcode,
      product,
      reasonId,
      quantity,
      lot,
    });
    if ("error" in validation) {
      toast.error(validation.error);
      return null;
    }
    return validation.quantity;
  };

  const requestCredentials = () => {
    const qtd = validateWasteDetails();
    if (!qtd) return;
    setCredentialsOpen(true);
  };

  const save = async () => {
    const qtd = validateWasteDetails();
    if (!qtd) return;
    if (!matricula.trim() || !password) return toast.error("Informe matricula e senha");

    setLoading(true);
    try {
      await registerWaste({
        estoque_id: Number(selectedEstoqueId),
        codigo_barras: barcode.trim(),
        quantidade: qtd,
        motivo_id: Number(reasonId),
        matricula: matricula.trim(),
        senha: password,
        lote: lot.trim(),
      });
      toast.success("Desperdicio registrado");
      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (err: unknown) {
      const challenge = getPasswordChallenge(err);
      if (challenge) {
        setCurrentPassword(password);
        setPasswordStatus(challenge.password_status);
        setChangePasswordOpen(true);
        setCredentialsOpen(false);
        toast.warning(passwordChallengeMessage(challenge.password_status));
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "";
      if (/expir|primeiro acesso|troque a senha/i.test(errorMessage) && matricula.trim()) {
        try {
          const lookup = await getUserByMatricula(matricula.trim());
          const resolvedStatus = resolvePasswordStatus(lookup);
          if (resolvedStatus === "expired" || resolvedStatus === "first_access") {
            setUser(lookup);
            setCurrentPassword(password);
            setPasswordStatus(resolvedStatus);
            setChangePasswordOpen(true);
            setCredentialsOpen(false);
            toast.warning(passwordChallengeMessage(resolvedStatus));
            return;
          }
        } catch {
          // segue para o tratamento original
        }
      }
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
      await changeUserPassword(user.id, currentPassword, newPassword);
      toast.success("Senha alterada com sucesso");
      toast.info("Repita o desperdicio usando a nova senha");
      setPassword("");
      setCurrentPassword("");
      setPasswordStatus("first_access");
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
                    {filteredEstoques.map((estoque) => (
                      <SelectItem key={estoque.id} value={String(estoque.id)}>
                        {estoque.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {barcode.trim() && availableStockIds?.length === 0 && (
                  <p className="text-xs text-destructive">
                    Este produto nao esta cadastrado em nenhum estoque disponivel.
                  </p>
                )}
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
                <Label>Lote</Label>
                <Input
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  placeholder="Digite o lote ou final"
                />
              </div>

              {product && lots.length > 0 && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Lotes disponiveis</Label>
                  <div className="grid gap-2">
                    {lots
                      .filter((item) =>
                        lot.trim()
                          ? item.lot.toLowerCase().endsWith(lot.trim().toLowerCase())
                          : true,
                      )
                      .slice(0, 5)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => setLot(item.lot)}
                        >
                          <span className="font-medium">{item.lot}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.expirationDate ?? "Sem validade"} · {item.quantity}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={requestCredentials} disabled={loading} className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Criar desperdicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar responsavel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{product?.name ?? "Produto informado"}</div>
              <div className="text-xs text-muted-foreground">
                Quantidade: {quantity || 0} {product?.unit ?? ""}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Matricula</Label>
              <Input
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {user && (
              <div className="text-xs text-muted-foreground">
                Funcionario: <span className="font-medium">{user.nome}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsOpen(false)} disabled={loading}>
              Voltar
            </Button>
            <Button onClick={save} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Registrar desperdicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{passwordStatus === "expired" ? "Senha vencida" : "Primeiro acesso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {passwordStatus === "expired"
                ? "Sua senha venceu após 7 dias. Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. O desperdício não foi registrado."
                : "Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. O desperdício não foi registrado."}
            </div>
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
