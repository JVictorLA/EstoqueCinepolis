import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Barcode, Check, Loader2, PackagePlus, Plus, RefreshCw, Save, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { createProductsBatch, getCategories, getEstoques, type CreateProductPayload } from "@/services/api";
import type { Category, Estoque } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/produtos/cadastro")({
  head: () => ({ meta: [{ title: "Cadastro de produtos · Zytrex Inventory" }] }),
  component: ProductBatchCreatePage,
});

type ProductBatchRow = {
  id: string;
  codigoBarras: string;
  nome: string;
  categoriaId: string;
  unidade: string;
  preco: string;
  estoqueId: string;
  estoqueAtual: string;
  estoqueMinimo: string;
  lote: string;
  validade: string;
  ativo: boolean;
};

function createRow(): ProductBatchRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    codigoBarras: "",
    nome: "",
    categoriaId: "",
    unidade: "un",
    preco: "",
    estoqueId: "",
    estoqueAtual: "",
    estoqueMinimo: "",
    lote: "",
    validade: "",
    ativo: true,
  };
}

function ean13CheckDigit(base: string) {
  const sum = base
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

function generateInternalBarcode() {
  const timestampPart = Date.now().toString().slice(-8);
  const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  const base = `29${timestampPart}${randomPart}`;
  return `${base}${ean13CheckDigit(base)}`;
}

function parseNumber(value: string) {
  if (!value.trim()) return 0;
  return Number(value.replace(",", "."));
}

function isRowTouched(row: ProductBatchRow) {
  return !!(
    row.codigoBarras.trim() ||
    row.nome.trim() ||
    row.categoriaId ||
    row.preco.trim() ||
    row.estoqueId ||
    row.estoqueAtual.trim() ||
    row.estoqueMinimo.trim() ||
    row.lote.trim() ||
    row.validade
  );
}

function getCategory(categories: Category[], row: ProductBatchRow) {
  return categories.find((category) => String(category.id) === row.categoriaId) ?? null;
}

function validateRow(row: ProductBatchRow, categories: Category[]) {
  if (!row.codigoBarras.trim()) return "Informe o codigo de barras";
  if (!row.nome.trim()) return "Informe o nome";
  if (!row.categoriaId) return "Selecione a categoria";
  if (!row.preco.trim()) return "Informe o preco";
  if (!row.estoqueId) return "Selecione o estoque";

  const price = parseNumber(row.preco);
  const currentStock = parseNumber(row.estoqueAtual);
  const minStock = parseNumber(row.estoqueMinimo);
  if (!Number.isFinite(price) || price < 0) return "Preco invalido";
  if (!Number.isFinite(currentStock) || currentStock < 0) return "Estoque inicial invalido";
  if (!Number.isFinite(minStock) || minStock < 0) return "Estoque minimo invalido";

  const category = getCategory(categories, row);
  if (category?.exigeValidade && !row.lote.trim()) return "Informe o lote";
  if (category?.exigeValidade && !row.validade) return "Informe a validade";

  return null;
}

function isRowComplete(row: ProductBatchRow, categories: Category[]) {
  return isRowTouched(row) && !validateRow(row, categories);
}

function ProductBatchCreatePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProductBatchRow[]>([createRow()]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getCategories(), getEstoques()])
      .then(([loadedCategories, loadedStocks]) => {
        setCategories(loadedCategories);
        setEstoques(loadedStocks);
      })
      .catch(() => toast.error("Erro ao carregar dados para cadastro"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const lastRow = rows[rows.length - 1];
    if (lastRow && isRowComplete(lastRow, categories)) {
      setRows((current) => [...current, createRow()]);
    }
  }, [rows, categories]);

  const filledRows = useMemo(() => rows.filter(isRowTouched), [rows]);

  const updateRow = <K extends keyof ProductBatchRow>(
    rowId: string,
    field: K,
    value: ProductBatchRow[K],
  ) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  };

  const removeRow = (rowId: string) => {
    setRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createRow()];
    });
  };

  const generateBarcode = (rowId: string) => {
    updateRow(rowId, "codigoBarras", generateInternalBarcode());
    toast.success("Codigo de barras gerado");
  };

  const buildPayload = (): CreateProductPayload[] | null => {
    if (!filledRows.length) {
      toast.error("Preencha ao menos um produto");
      return null;
    }

    for (const [index, row] of rows.entries()) {
      if (!isRowTouched(row)) continue;
      const error = validateRow(row, categories);
      if (error) {
        toast.error(`Linha ${index + 1}: ${error}`);
        return null;
      }
    }

    return filledRows.map((row) => ({
      codigo_barras: row.codigoBarras.trim(),
      nome: row.nome.trim(),
      categoria_id: Number(row.categoriaId),
      unidade: row.unidade.trim() || "un",
      preco_venda: parseNumber(row.preco),
      estoque_id: Number(row.estoqueId),
      estoque_atual: parseNumber(row.estoqueAtual),
      estoque_minimo: parseNumber(row.estoqueMinimo),
      data_validade: row.validade || null,
      lote: row.lote.trim(),
      ativo: row.ativo,
    }));
  };

  const save = async () => {
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      await createProductsBatch({ produtos: payload });
      toast.success("Produtos cadastrados");
      navigate({ to: "/admin/produtos" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar produtos");
    } finally {
      setSaving(false);
    }
  };

  const activeStocks = estoques.filter((estoque) => estoque.ativo);

  return (
    <>
      <PageHeader
        title="Cadastro de produtos"
        subtitle="Cadastre varios produtos em uma unica operacao. Se uma linha falhar, nada sera salvo."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate({ to: "/admin/produtos" })}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button className="gap-2" onClick={save} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar produtos
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border bg-card shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <div className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Produtos do cadastro</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Linhas vazias sao ignoradas. Ao completar uma linha, uma nova aparece automaticamente.
            </p>
          </div>
          <Badge variant="secondary">{filledRows.length} preenchidos</Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando cadastro...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1500px]">
              <div className="grid grid-cols-[170px_40px_240px_190px_90px_120px_180px_120px_120px_150px_150px_90px_52px] gap-2 border-b bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
                <div>Codigo</div>
                <div></div>
                <div>Nome</div>
                <div>Categoria</div>
                <div>Unidade</div>
                <div>Preco</div>
                <div>Estoque</div>
                <div>Inicial</div>
                <div>Minimo</div>
                <div>Lote</div>
                <div>Validade</div>
                <div>Ativo</div>
                <div></div>
              </div>

              <div className="divide-y">
                {rows.map((row, index) => {
                  const category = getCategory(categories, row);
                  const requiresExpiration = !!category?.exigeValidade;
                  const rowError = isRowTouched(row) ? validateRow(row, categories) : null;

                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-[170px_40px_240px_190px_90px_120px_180px_120px_120px_150px_150px_90px_52px] gap-2 px-4 py-3"
                    >
                      <div className="space-y-1">
                        <Label className="sr-only">Codigo da linha {index + 1}</Label>
                        <Input
                          value={row.codigoBarras}
                          onChange={(event) => updateRow(row.id, "codigoBarras", event.target.value)}
                          placeholder="EAN-13"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Gerar codigo de barras"
                        onClick={() => generateBarcode(row.id)}
                      >
                        <Barcode className="h-4 w-4" />
                      </Button>
                      <Input
                        value={row.nome}
                        onChange={(event) => updateRow(row.id, "nome", event.target.value)}
                        placeholder="Nome do produto"
                      />
                      <Select
                        value={row.categoriaId}
                        onValueChange={(value) => updateRow(row.id, "categoriaId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((categoryItem) => (
                            <SelectItem key={categoryItem.id} value={String(categoryItem.id)}>
                              {categoryItem.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={row.unidade}
                        onChange={(event) => updateRow(row.id, "unidade", event.target.value)}
                        placeholder="un"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.preco}
                        onChange={(event) => updateRow(row.id, "preco", event.target.value)}
                        placeholder="0,00"
                      />
                      <Select
                        value={row.estoqueId}
                        onValueChange={(value) => updateRow(row.id, "estoqueId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Estoque" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeStocks.map((stock) => (
                            <SelectItem key={stock.id} value={String(stock.id)}>
                              {stock.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={row.estoqueAtual}
                        onChange={(event) => updateRow(row.id, "estoqueAtual", event.target.value)}
                        placeholder="0"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={row.estoqueMinimo}
                        onChange={(event) => updateRow(row.id, "estoqueMinimo", event.target.value)}
                        placeholder="0"
                      />
                      <Input
                        value={row.lote}
                        onChange={(event) => updateRow(row.id, "lote", event.target.value)}
                        placeholder={requiresExpiration ? "Obrigatorio" : "Opcional"}
                      />
                      <Input
                        type="date"
                        value={row.validade}
                        onChange={(event) => updateRow(row.id, "validade", event.target.value)}
                        className={requiresExpiration ? "" : "opacity-80"}
                      />
                      <div className="flex h-10 items-center gap-2">
                        <Switch
                          checked={row.ativo}
                          onCheckedChange={(checked) => updateRow(row.id, "ativo", checked)}
                        />
                        {row.ativo ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Remover linha"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1 && !isRowTouched(row)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {rowError && (
                        <div className="col-span-full -mt-1 text-xs text-destructive">
                          Linha {index + 1}: {rowError}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setRows((current) => [...current, createRow()])}
          >
            <Plus className="h-4 w-4" /> Adicionar linha
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/admin/produtos" })}>
              Cancelar
            </Button>
            <Button className="gap-2" onClick={save} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Salvar produtos
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
