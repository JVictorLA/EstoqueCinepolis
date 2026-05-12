import { useEffect, useState } from "react";
import {
  Package,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { BarcodeInput } from "@/components/scanner/BarcodeInput";

import { toast } from "sonner";

import {
  getProductByBarcode,
  getUserByMatricula,
  registerMovement,
  changeUserPassword,
} from "@/services/api";

import type { Product } from "@/types";

interface MovementFormProps {
  type: "entrada" | "saida";
  requireAuth?: boolean;
}

export function MovementForm({
  type,
}: MovementFormProps) {

  const [barcode, setBarcode] = useState("");

  const [product, setProduct] =
    useState<Product | null>(null);

  const [searching, setSearching] =
    useState(false);

  const [quantity, setQuantity] =
    useState("");

  const [note, setNote] =
    useState("");

  const [matricula, setMatricula] =
    useState("");

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [user, setUser] =
    useState<any>(null);

  const [loadingUser, setLoadingUser] =
    useState(false);

  // 🔥 PRIMEIRO ACESSO
  const [showChangePassword, setShowChangePassword] =
    useState(false);

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [userId, setUserId] =
    useState<number | null>(null);

  useEffect(() => {
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

  }, [matricula]);

  useEffect(() => {
    if (!barcode) {
      setProduct(null);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);

      try {
        const p = await getProductByBarcode(barcode);

        setProduct(p);

      } catch {
        setProduct(null);

      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);

  }, [barcode]);

  const handleConfirmClick = () => {
    if (!barcode) {
      return toast.error(
        "Informe o código de barras"
      );
    }

    if (!quantity || parseInt(quantity) <= 0) {
      return toast.error(
        "Informe a quantidade"
      );
    }

    if (!matricula) {
      return toast.error(
        "Informe a matrícula"
      );
    }

    setConfirmOpen(true);
  };

  const doSubmit = async () => {
    if (!password) {
      return toast.error("Informe a senha");
    }

    // 🔥 PRIMEIRO LOGIN
    if (
      password === "123456" &&
      user?.precisa_trocar_senha
    ) {
      setUserId(user.id);

      setConfirmOpen(false);

      setShowChangePassword(true);

      toast.warning(
        "Primeiro acesso detectado. Crie uma nova senha."
      );

      return;
    }

    setSubmitting(true);

    try {
      await registerMovement({
        codigo_barras: barcode,
        matricula,
        senha: password,
        tipo: type,
        quantidade: parseInt(quantity),
        observacao: note || undefined,
      });

      toast.success(
        type === "entrada"
          ? "Entrada registrada"
          : "Retirada registrada"
      );

      setBarcode("");
      setProduct(null);
      setQuantity("");
      setNote("");
      setMatricula("");
      setPassword("");
      setConfirmOpen(false);

    } catch (e: any) {
      toast.error(
        e?.message ||
          "Falha ao registrar movimentação"
      );

    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 ALTERAR SENHA
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
        "123456",
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
    type === "entrada"
      ? "success"
      : "destructive";

  return (
    <div className="grid lg:grid-cols-3 gap-6">

      {/* FORM */}
      <div className="lg:col-span-2 space-y-4 rounded-xl bg-card border p-6 shadow-[var(--shadow-soft)]">

        <BarcodeInput
          value={barcode}
          onChange={setBarcode}
          autoFocus
        />

        <div className="grid sm:grid-cols-2 gap-4">

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

        </div>

        {type === "entrada" && (
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
            type === "entrada"
              ? "bg-success hover:bg-success/90"
              : "bg-destructive hover:bg-destructive/90"
          } text-${accent}-foreground`}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          )}

          {type === "entrada"
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
            Procurando…
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

            {type === "entrada" && (
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

                {!matricula && "—"}

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
              onClick={doSubmit}
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

      {/* 🔥 MODAL TROCAR SENHA */}
      <Dialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              Primeiro acesso
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <div className="text-sm text-muted-foreground">
              Você está utilizando a senha padrão do sistema.
              Crie uma nova senha para continuar.
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

    </div>
  );
}