import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Package,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

import { BarcodeInput } from "@/components/scanner/BarcodeInput";

import { toast } from "sonner";

import {
  getProductByBarcode,
  getUserByMatricula,
  registerMovement,
  transferStock,
  changeUserPassword,
  getEstoques,
  getStoredUser,
  getPasswordChallenge,
  getProductLots,
  ApiError,
} from "@/services/api";

import type { Estoque, Product, ProductLot, FefoWarning } from "@/types";
import { isExpired, isNearExpiration } from "@/lib/expiration";
import { validateMovement } from "@/lib/movementRules";
import { passwordChallengeMessage, resolvePasswordStatus } from "@/lib/passwordChallenge";

interface MovementFormProps {
  type: "entrada" | "saida";
  requireAuth?: boolean;
  useStoredStock?: boolean;
  useLoggedUser?: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function configFlag(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "sim", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "nao", "não", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function MovementForm({
  type,
  useStoredStock = false,
  useLoggedUser = false,
}: MovementFormProps) {
  const navigate = useNavigate();

  const [barcode, setBarcode] = useState("");
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [selectedEstoqueId, setSelectedEstoqueId] = useState("");
  const [targetEstoqueId, setTargetEstoqueId] = useState("");
  const [operation, setOperation] = useState<"saida" | "transferencia">("saida");

  const [product, setProduct] =
    useState<Product | null>(null);

  const [searching, setSearching] =
    useState(false);

  const [quantity, setQuantity] =
    useState("");
  const [lot, setLot] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [fefoWarning, setFefoWarning] = useState<FefoWarning | null>(null);
  const [fefoJustification, setFefoJustification] = useState("");
  const [expiredBlockMessage, setExpiredBlockMessage] = useState("");

  const [note, setNote] =
    useState("");

  const [matricula, setMatricula] =
    useState("");

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [reviewOpen, setReviewOpen] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [user, setUser] =
    useState<any>(null);

  const [loadingUser, setLoadingUser] =
    useState(false);

  // PRIMEIRO ACESSO
  const [showChangePassword, setShowChangePassword] =
    useState(false);
  const [passwordStatus, setPasswordStatus] =
    useState<"first_access" | "expired">("first_access");
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [userId, setUserId] =
    useState<number | null>(null);

  useEffect(() => {
    getEstoques().then((data) => {
      setEstoques(data);
      if (useStoredStock) {
        const raw = localStorage.getItem("cinepolis.estoque");
        const stored = raw ? JSON.parse(raw) : null;
        if (stored?.id) {
          setSelectedEstoqueId(String(stored.id));
        } else {
          navigate({ to: "/operador" });
        }
        return;
      }

      const firstActive = data.find((estoque) => estoque.ativo) ?? data[0];
      if (firstActive) setSelectedEstoqueId(String(firstActive.id));
    });
  }, [navigate, useStoredStock]);

  useEffect(() => {
    if (type !== "saida" || operation !== "transferencia") return;

    const firstTarget = estoques.find(
      (estoque) => estoque.ativo && String(estoque.id) !== selectedEstoqueId
    );

    if (firstTarget && (!targetEstoqueId || targetEstoqueId === selectedEstoqueId)) {
      setTargetEstoqueId(String(firstTarget.id));
    }
  }, [estoques, operation, selectedEstoqueId, targetEstoqueId, type]);

  useEffect(() => {
    if (!useLoggedUser) return;
    const storedUser = getStoredUser();
    if (!storedUser) {
      navigate({ to: "/" });
      return;
    }

    setMatricula(storedUser.matricula);
    setUser(storedUser);
  }, [navigate, useLoggedUser]);

  useEffect(() => {
    if (useLoggedUser) return;
    if (!matricula) {
      setUser(null);
      return;
    }

    const t = setTimeout(async () => {
      setLoadingUser(true);

      try {
        const u = await getUserByMatricula(matricula);

        setUser(u);

      } catch {
        setUser(null);

      } finally {
        setLoadingUser(false);
      }
    }, 400);

    return () => clearTimeout(t);

  }, [matricula, useLoggedUser]);

  useEffect(() => {
    if (!barcode || !selectedEstoqueId) {
      setProduct(null);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);

      try {
        const p = await getProductByBarcode(barcode, selectedEstoqueId);

        setProduct(p);
        setLots([]);

      } catch {
        setProduct(null);
        setLots([]);

      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);

  }, [barcode, selectedEstoqueId]);

  useEffect(() => {
    if (!product || !selectedEstoqueId || type !== "saida") {
      setLots([]);
      return;
    }

    getProductLots(product.id, selectedEstoqueId)
      .then((items) => setLots(items.filter((item) => item.quantity > 0)))
      .catch(() => setLots([]));
  }, [product, selectedEstoqueId, type]);

  const handleConfirmClick = () => {
    const validation = validateMovement({
      barcode,
      selectedEstoqueId,
      targetEstoqueId,
      operation,
      quantity,
      product,
      type,
      lot,
      expirationDate,
      matricula,
    });
    if (validation) return toast.error(validation);

    setConfirmOpen(true);
  };

  const handlePasswordConfirm = () => {
    if (!password) {
      return toast.error("Informe a senha");
    }

    // PRIMEIRO LOGIN
    setConfirmOpen(false);
    setReviewOpen(true);
  };

  const doSubmit = async () => {
    setSubmitting(true);

    try {
      const ignoreFefo = !!fefoWarning;
      if (operation === "transferencia") {
        await transferStock({
          codigo_barras: barcode,
          estoque_origem_id: parseInt(selectedEstoqueId),
          estoque_destino_id: parseInt(targetEstoqueId),
          matricula,
          senha: password,
          quantidade: parseInt(quantity),
          observacao: note || undefined,
          lote: lot.trim(),
          confirmar_ignorar_fefo: ignoreFefo,
          justificativa_fefo: ignoreFefo ? fefoJustification.trim() : undefined,
        });
      } else {
        await registerMovement({
          codigo_barras: barcode,
          estoque_id: parseInt(selectedEstoqueId),
          matricula,
          senha: password,
          tipo: type,
          quantidade: parseInt(quantity),
          observacao: note || undefined,
          lote: lot.trim(),
          data_validade: type === "entrada" ? expirationDate || null : undefined,
          confirmar_ignorar_fefo: ignoreFefo,
          justificativa_fefo: ignoreFefo ? fefoJustification.trim() : undefined,
        });
      }

      toast.success(
        operation === "transferencia"
          ? "Transferencia registrada"
          : type === "entrada"
          ? "Entrada registrada"
          : "Retirada registrada"
      );

      setBarcode("");
      setProduct(null);
      setQuantity("");
      setLot("");
      setExpirationDate("");
      setLots([]);
      setFefoWarning(null);
      setFefoJustification("");
      setNote("");
      if (!useLoggedUser) {
        setMatricula("");
        setUser(null);
      }
      setPassword("");
      setConfirmOpen(false);
      setReviewOpen(false);

    } catch (e: any) {
      const challenge = getPasswordChallenge(e);
      if (challenge) {
        setUserId(challenge.usuario.id);
        setCurrentPassword(password);
        setPasswordStatus(challenge.password_status);
        setConfirmOpen(false);
        setReviewOpen(false);
        setShowChangePassword(true);
        toast.warning(passwordChallengeMessage(challenge.password_status));
        return;
      }
      const errorMessage = e instanceof Error ? e.message : "";
      if (/expir|primeiro acesso|troque a senha/i.test(errorMessage) && matricula) {
        try {
          const lookup = await getUserByMatricula(matricula);
          const resolvedStatus = resolvePasswordStatus(lookup);
          if (resolvedStatus === "expired" || resolvedStatus === "first_access") {
            setUserId(lookup.id);
            setCurrentPassword(password);
            setPasswordStatus(resolvedStatus);
            setConfirmOpen(false);
            setReviewOpen(false);
            setShowChangePassword(true);
            toast.warning(passwordChallengeMessage(resolvedStatus));
            return;
          }
        } catch {
          // segue para o tratamento original
        }
      }
      if (e instanceof ApiError && (e.data as any)?.fefo) {
        setFefoWarning((e.data as { fefo: FefoWarning }).fefo);
        setFefoJustification("");
        setReviewOpen(true);
        toast.warning("Ha um alerta FEFO para este lote");
        return;
      }
      if (
        e instanceof ApiError &&
        e.status === 400 &&
        /vencid|produto vencido|lote .*venc/i.test(e.message)
      ) {
        setReviewOpen(false);
        setExpiredBlockMessage(e.message);
        if (/registrado automaticamente como desperd/i.test(e.message) && product && selectedEstoqueId) {
          getProductLots(product.id, selectedEstoqueId)
            .then((items) => setLots(items.filter((item) => item.quantity > 0)))
            .catch(() => setLots([]));
        }
        return;
      }

      toast.error(
        e?.message ||
          "Falha ao registrar movimentação"
      );

    } finally {
      setSubmitting(false);
    }
  };

  // ALTERAR SENHA
  const changeFirstPassword = async () => {
    if (!newPassword || !confirmPassword) {
      return toast.error(
        "Preencha os campos"
      );
    }

    if (newPassword !== confirmPassword) {
      return toast.error(
        "As senhas não coincidem"
      );
    }

    if (!userId) {
      return toast.error(
        "Usuário inválido"
      );
    }

    try {
      await changeUserPassword(
        userId,
        currentPassword,
        newPassword
      );

      toast.success(
        "Senha alterada com sucesso"
      );

      toast.info(
        "Agora repita a movimentação usando sua nova senha"
      );

      setShowChangePassword(false);

      setPassword("");
      setCurrentPassword("");
      setPasswordStatus("first_access");

      setNewPassword("");
      setConfirmPassword("");

    } catch (err: any) {
      toast.error(
        err?.message ||
          "Erro ao alterar senha"
      );
    }
  };

  const accent =
    type === "entrada" || operation === "transferencia"
      ? "success"
      : "destructive";

  const selectedEstoque = estoques.find(
    (estoque) => String(estoque.id) === selectedEstoqueId
  );

  const targetEstoque = estoques.find(
    (estoque) => String(estoque.id) === targetEstoqueId
  );

  const movementLabel =
    operation === "transferencia"
      ? "transferencia de estoque"
      : type === "entrada" ? "entrada de produto" : "retirada de produto";

  const movementVerb =
    operation === "transferencia"
      ? "transferir entre estoques"
      : type === "entrada" ? "adicionar ao" : "retirar do";

  const movementActionLabel =
    operation === "transferencia"
      ? "Sim, transferir produto"
      : type === "entrada" ? "Sim, registrar entrada" : "Sim, registrar retirada";

  const matchingLots = lot.trim()
    ? lots.filter((item) => item.lot.toLowerCase().endsWith(lot.trim().toLowerCase()))
    : lots;

  const expiredWasAutoWaste = /registrado automaticamente como desperd/i.test(
    expiredBlockMessage,
  );
  const canIgnoreFefo = configFlag(
    fefoWarning?.permitir_ignorar_fefo ?? fefoWarning?.permitirIgnorarFefo,
    true,
  );
  const requiresFefoJustification =
    !!fefoWarning &&
    canIgnoreFefo &&
    configFlag(
      fefoWarning.exigir_justificativa_fefo ?? fefoWarning.exigirJustificativaFefo,
      true,
    );

  return (
    <div className="grid lg:grid-cols-3 gap-6">

      {/* FORM */}
      <div className="lg:col-span-2 space-y-4 rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)]">

        {type === "saida" && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <Button
              type="button"
              variant={operation === "saida" ? "default" : "ghost"}
              onClick={() => setOperation("saida")}
              className={
                operation === "saida"
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  : ""
              }
            >
              Retirada
            </Button>
            <Button
              type="button"
              variant={operation === "transferencia" ? "default" : "ghost"}
              onClick={() => setOperation("transferencia")}
              className={
                operation === "transferencia"
                  ? "bg-success hover:bg-success/90 text-success-foreground"
                  : ""
              }
            >
              Transferir estoque
            </Button>
          </div>
        )}

        <BarcodeInput
          value={barcode}
          onChange={setBarcode}
          autoFocus
        />

        <div className="grid sm:grid-cols-2 gap-4">
          {useStoredStock ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Estoque</Label>
              <Input value={selectedEstoque?.nome ?? "Selecione um estoque no modo operador"} disabled />
            </div>
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <Label>Estoque</Label>
              <Select value={selectedEstoqueId} onValueChange={setSelectedEstoqueId}>
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

          {operation === "transferencia" && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Estoque destino</Label>
              <Select value={targetEstoqueId} onValueChange={setTargetEstoqueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estoque destino" />
                </SelectTrigger>
                <SelectContent>
                  {estoques
                    .filter((estoque) => estoque.ativo && String(estoque.id) !== selectedEstoqueId)
                    .map((estoque) => (
                      <SelectItem key={estoque.id} value={String(estoque.id)}>
                        {estoque.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Quantidade</Label>

            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) =>
                setQuantity(e.target.value)
              }
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Lote</Label>
            <Input
              value={lot}
              onChange={(e) => {
                setLot(e.target.value);
                setFefoWarning(null);
              }}
              placeholder={type === "entrada" ? "Ex: WAFFLE-2026-000123" : "Digite o lote ou final"}
            />
          </div>

          {type === "entrada" && product?.requiresExpiration && (
            <div className="space-y-2">
              <Label>Validade do lote</Label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          )}

          {type === "saida" && product && matchingLots.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Lotes disponiveis</Label>
              <div className="grid gap-2">
                {matchingLots.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setLot(item.lot);
                      setFefoWarning(null);
                    }}
                  >
                    <span className="font-medium">{item.lot}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.expirationDate ? formatDate(item.expirationDate) : "Sem validade"} - {item.quantity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {useLoggedUser ? (
            <div className="space-y-2">
              <Label>Responsavel</Label>
              <Input
                value={
                  user?.nome
                    ? `${user.nome} (${matricula})`
                    : matricula
                }
                disabled
              />
            </div>
          ) : (
          <div className="space-y-2">
            <Label>
              Usuário do funcionário
            </Label>

            <Input
              value={matricula}
              onChange={(e) =>
                setMatricula(e.target.value)
              }
              placeholder="Ex: 1234"
            />
          </div>
          )}

        </div>

        {(type === "entrada" || operation === "transferencia") && (
          <div className="space-y-2">
            <Label>
              Observação{" "}
              <span className="text-muted-foreground">
                (opcional)
              </span>
            </Label>

            <Textarea
              value={note}
              onChange={(e) =>
                setNote(e.target.value)
              }
              rows={3}
            />
          </div>
        )}

        <Button
          onClick={handleConfirmClick}
          disabled={submitting}
          className={`w-full ${
            type === "entrada" || operation === "transferencia"
              ? "bg-success hover:bg-success/90"
              : "bg-destructive hover:bg-destructive/90"
          } text-${accent}-foreground`}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          )}

          {operation === "transferencia"
            ? "Confirmar Transferencia"
            : type === "entrada"
            ? "Confirmar Entrada"
            : "Confirmar Retirada"}
        </Button>

      </div>

      {/* PRODUTO */}
      <div className="rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)]">

        <h3 className="font-semibold mb-1">
          Produto
        </h3>

        <p className="text-xs text-muted-foreground mb-4">
          Identificação automática pelo código
        </p>

        {searching ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procurando...
          </div>

        ) : product ? (
          <div className="space-y-3">

            <div className="flex items-center gap-3">

              <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>

              <div>
                <div className="font-medium">
                  {product.name}
                </div>

                <div className="text-xs text-muted-foreground font-mono">
                  {product.barcode}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isExpired(product.expirationDate) && (
                    <Badge variant="destructive">Vencido</Badge>
                  )}
                  {isNearExpiration(product.expirationDate) && (
                    <Badge variant="secondary" className="bg-warning/15 text-warning border-warning/30">
                      Próximo do vencimento
                    </Badge>
                  )}
                </div>

                {product.requiresExpiration && product.expirationDate && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Validade: {formatDate(product.expirationDate)}
                  </div>
                )}
              </div>

            </div>

            <div className="rounded-lg bg-muted p-3">

              <div className="text-xs text-muted-foreground">
                Estoque atual
              </div>

              <div className="text-2xl font-bold">
                {product.stock}
              </div>

            </div>

          </div>

        ) : barcode ? (
          <div className="text-sm text-muted-foreground">
            Nenhum produto encontrado para esse código.
          </div>

        ) : (
          <div className="text-sm text-muted-foreground">
            Escaneie ou digite um código de barras para identificar o produto.
          </div>
        )}
      </div>

      {/* MODAL CONFIRMAR */}
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              Confirmar com senha
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {type === "entrada" && !useLoggedUser && (
              <div className="space-y-2">

                <Label>Matrícula</Label>

                <Input
                  value={matricula}
                  onChange={(e) =>
                    setMatricula(e.target.value)
                  }
                />

              </div>
            )}

            <div className="rounded-lg bg-muted p-3 text-sm">

              <div className="text-muted-foreground text-xs">
                Funcionário
              </div>

              <div className="font-medium">

                {loadingUser && "Buscando..."}

                {!loadingUser &&
                  user &&
                  user.nome}

                {!loadingUser &&
                  matricula &&
                  !user && (
                    <span className="text-red-500">
                      Usuário não encontrado
                    </span>
                  )}

                {!matricula && "-"}

              </div>

            </div>

            <div className="space-y-2">

              <Label>
                Senha do funcionário
              </Label>

              <Input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoFocus
              />

            </div>

          </div>

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() =>
                setConfirmOpen(false)
              }
            >
              Cancelar
            </Button>

            <Button
              onClick={handlePasswordConfirm}
              disabled={submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}

              Confirmar
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* MODAL TROCAR SENHA */}
      <AlertDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      >
        <AlertDialogContent>

          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className={`h-5 w-5 ${
                  type === "entrada" || operation === "transferencia"
                    ? "text-success"
                    : "text-destructive"
                }`}
              />
              Confirmar {movementLabel}
            </AlertDialogTitle>

            <AlertDialogDescription>
              Voce esta prestes a {movementVerb} estoque a quantidade abaixo.
              Confira os dados antes de concluir a operacao.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Operacao</span>
              <span
                className={`font-semibold ${
                  type === "entrada" || operation === "transferencia"
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {operation === "transferencia"
                  ? "Transferencia"
                  : type === "entrada" ? "Entrada" : "Retirada"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Estoque</span>
              <span className="font-medium text-right">
                {selectedEstoque?.nome ?? "Estoque selecionado"}
              </span>
            </div>

            {operation === "transferencia" && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Destino</span>
                <span className="font-medium text-right">
                  {targetEstoque?.nome ?? "Estoque destino"}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Produto</span>
              <span className="font-medium text-right">
                {product?.name ?? barcode}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Quantidade</span>
              <span className="font-semibold">
                {quantity}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Lote</span>
              <span className="font-medium text-right">{lot}</span>
            </div>

            {fefoWarning && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <div className="font-medium text-warning">Alerta FEFO</div>
                <div className="mt-1 text-muted-foreground">{fefoWarning.mensagem}</div>
                {!canIgnoreFefo && (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                    Este produto nao pode ser retirado porque existe outro lote que vence
                    primeiro. Retire primeiro o lote com vencimento mais proximo.
                  </div>
                )}
                {canIgnoreFefo && requiresFefoJustification && (
                  <div className="mt-3 space-y-2">
                    <Label>Justificativa obrigatoria</Label>
                    <Textarea
                      value={fefoJustification}
                      onChange={(e) => setFefoJustification(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
                {canIgnoreFefo && !requiresFefoJustification && (
                  <div className="mt-3 rounded-md border border-warning/30 bg-background/70 p-3 text-muted-foreground">
                    Voce esta retirando um produto que vence depois de outro lote disponivel.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Funcionario</span>
              <span className="font-medium text-right">
                {user?.nome ?? matricula}
              </span>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              Revisar dados
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={(event) => {
                if (fefoWarning && !canIgnoreFefo) {
                  event.preventDefault();
                  toast.error("Nao e permitido ignorar a ordem FEFO");
                  return;
                }
                if (requiresFefoJustification && !fefoJustification.trim()) {
                  event.preventDefault();
                  toast.error("Informe a justificativa FEFO");
                  return;
                }
                doSubmit();
              }}
              disabled={submitting}
              className={`gap-2 ${
                type === "entrada" || operation === "transferencia"
                  ? "bg-success hover:bg-success/90 text-success-foreground"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              }`}
            >
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {fefoWarning && canIgnoreFefo ? "Ignorar FEFO e continuar" : movementActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              {passwordStatus === "expired" ? "Senha vencida" : "Primeiro acesso"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div className="text-sm text-muted-foreground">
              {passwordStatus === "expired"
                ? "Sua senha venceu após 7 dias. Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. A movimentação não foi executada."
                : "Crie uma nova senha para continuar. A nova senha não pode ser igual à atual. A movimentação não foi executada."}
            </div>

            <div className="space-y-2">

              <Label>Nova senha</Label>

              <Input
                type="password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(e.target.value)
                }
              />

            </div>

            <div className="space-y-2">

              <Label>
                Confirmar senha
              </Label>

              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />

            </div>

          </div>

          <DialogFooter>

            <Button
              className="w-full"
              onClick={changeFirstPassword}
            >
              Salvar nova senha
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!expiredBlockMessage}
        onOpenChange={(open) => {
          if (!open) setExpiredBlockMessage("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Retirada bloqueada
            </AlertDialogTitle>
            <AlertDialogDescription>
              {expiredBlockMessage ||
                "A retirada foi bloqueada porque o lote selecionado esta vencido."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            {expiredWasAutoWaste
              ? "A baixa de saida nao foi registrada. O lote vencido foi removido do estoque como desperdicio automaticamente. Deixe o produto na area de produtos improprios para consumo."
              : "Nenhuma baixa foi registrada no estoque. Este produto deve ser registrado como desperdicio. Deixe-o na area de produtos improprios para consumo."}
          </div>

          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => setExpiredBlockMessage("")}
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
