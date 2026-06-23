/**
 * Cliente da API REST do backend (Node + Express + MySQL).
 *
 * Configure a URL da API definindo VITE_API_URL no .env do projeto:
 *   VITE_API_URL=http://192.168.0.10:3333
 *
 * Padrão de resposta esperado do backend:
 *   { success, message, data, error }
 */
import type {
  Product,
  Movement,
  SystemUser,
  Category,
  AuthUser,
  PasswordChallenge,
  UserRole,
  Estoque,
  TransferMovement,
  TransferStockBatchPayload,
  TransferStockBatchResult,
  Waste,
  WasteReason,
  WasteSummary,
  InventoryCurrentItem,
  InventoryStatus,
  Conference,
  ConferenceHistory,
  ConferenceItem,
  ConferenceProductOption,
  ConferenceStatus,
  ConferenceItemStatus,
  ProductLot,
  LotStatus,
  Kit,
  KitItem,
  KitMovementHistory,
  KitMovementType,
  KitProductOption,
  KitStatus,
} from "@/types";
import { getExpirationStatus } from "@/lib/expiration";

const API_URL = import.meta.env?.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3333";

const TOKEN_KEY = "cinepolis.token";
const USER_KEY = "cinepolis.user";

function normalizeThemePreference(value: unknown): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as AuthUser;
  return {
    ...parsed,
    themePreference: normalizeThemePreference(parsed.themePreference),
  };
}

export function setStoredUser(user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      ...user,
      themePreference: normalizeThemePreference(user.themePreference),
    }),
  );
}
export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  error: string | null;
}

export class ApiError<T = unknown> extends Error {
  status: number;
  data: T | null;

  constructor(message: string, status: number, data: T | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function isPasswordStatus(value: unknown): value is "first_access" | "expired" {
  return value === "first_access" || value === "expired";
}

export function getPasswordChallenge(error: unknown): PasswordChallenge | null {
  const candidates: unknown[] = [];

  if (error instanceof ApiError) {
    candidates.push(error.data);
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    candidates.push(record.data);
    candidates.push(record.response);

    const response = record.response;
    if (response && typeof response === "object") {
      const responseRecord = response as Record<string, unknown>;
      candidates.push(responseRecord.data);
      const nestedData = responseRecord.data;
      if (nestedData && typeof nestedData === "object") {
        candidates.push((nestedData as Record<string, unknown>).data);
      }
    }
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    const record = candidate as Record<string, unknown>;
    const directStatus = record.password_status;
    const directUser = record.usuario;
    if (
      isPasswordStatus(directStatus) &&
      directUser &&
      typeof directUser === "object" &&
      Number((directUser as Record<string, unknown>).id)
    ) {
      return {
        password_status: directStatus,
        usuario: directUser as PasswordChallenge["usuario"],
      };
    }

    const nested = record.data;
    if (!nested || typeof nested !== "object") continue;

    const nestedRecord = nested as Record<string, unknown>;
    if (
      isPasswordStatus(nestedRecord.password_status) &&
      nestedRecord.usuario &&
      typeof nestedRecord.usuario === "object" &&
      Number((nestedRecord.usuario as Record<string, unknown>).id)
    ) {
      return {
        password_status: nestedRecord.password_status,
        usuario: nestedRecord.usuario as PasswordChallenge["usuario"],
      };
    }
  }

  return null;
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      `Não foi possível conectar à API (${API_URL}). Verifique se o backend está rodando.`,
    );
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* sem corpo */
  }

  if (!res.ok || (body && body.success === false)) {
    throw new ApiError(body?.message || `Erro ${res.status}`, res.status, body?.data ?? null);
  }
  return (body?.data as T) ?? (null as T);
}

/* ----------------- Mappers (backend ⇄ UI) ----------------- */

interface RawProduct {
  id: number;
  estoque_id?: number | null;
  estoque_nome?: string | null;
  codigo_barras: string;
  nome: string;
  categoria_id: number | null;
  categoria_nome: string | null;
  exige_validade?: 0 | 1 | boolean;
  data_validade?: string | null;
  unidade: string;
  preco_venda: string | number;
  estoque_atual: string | number;
  estoque_minimo: string | number;
  ativo: 0 | 1 | boolean;
  criado_em: string;
  atualizado_em?: string;
  sem_estoque?: 0 | 1;
  estoque_baixo?: 0 | 1;
  movimentacoes_count?: number | string;
}

interface RawProductLot {
  id: number;
  estoque_produto_id: number;
  produto_id: number;
  estoque_id: number;
  estoque_nome: string;
  lote: string;
  data_validade: string | null;
  quantidade: string | number;
}

function lotStatus(expirationDate?: string | null): LotStatus {
  return getExpirationStatus(expirationDate);
}

function mapProductLot(r: RawProductLot): ProductLot {
  const expirationDate = r.data_validade ? String(r.data_validade).slice(0, 10) : null;
  return {
    id: r.id,
    estoqueProdutoId: r.estoque_produto_id,
    productId: r.produto_id,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    lot: r.lote,
    expirationDate,
    quantity: Number(r.quantidade),
    status: lotStatus(expirationDate),
  };
}

function mapProduct(r: RawProduct): Product {
  return {
    id: r.id,
    estoqueId: r.estoque_id ?? null,
    estoqueNome: r.estoque_nome ?? null,
    barcode: r.codigo_barras,
    name: r.nome,
    categoryId: r.categoria_id,
    categoryName: r.categoria_nome,
    requiresExpiration: !!r.exige_validade,
    expirationDate: r.data_validade ?? null,
    unit: r.unidade,
    price: Number(r.preco_venda),
    stock: Number(r.estoque_atual),
    minStock: Number(r.estoque_minimo),
    active: !!r.ativo,
    favorite: false,
    lowStock: !!r.estoque_baixo,
    noStock: !!r.sem_estoque,
    movementsCount: Number(r.movimentacoes_count ?? 0),
    createdAt: r.criado_em,
  };
}

interface RawMovement {
  id: number;
  estoque_id?: number | null;
  estoque_nome?: string | null;
  produto_id: number;
  usuario_id: number;
  tipo: "entrada" | "saida" | "desperdicio" | "ajuste";
  quantidade: number;
  estoque_antes: number | string;
  estoque_depois: number | string;
  usuario_nome: string;
  produto_nome: string;
  observacao: string | null;
  codigo_barras?: string | null;
  lote_id?: number | null;
  lote_codigo?: string | null;
  ignorou_fefo?: 0 | 1 | boolean;
  justificativa_fefo?: string | null;
  criado_em: string;
}

interface RawTransferMovement {
  saida_id: number;
  entrada_id: number;
  produto_id: number;
  produto_nome: string;
  estoque_origem_id: number;
  estoque_origem_nome: string;
  estoque_destino_id: number;
  estoque_destino_nome: string;
  quantidade: number;
  usuario_id: number;
  usuario_nome: string;
  lote_id?: number | null;
  lote_codigo?: string | null;
  ignorou_fefo?: 0 | 1 | boolean;
}

interface RawTransferBatch {
  estoque_origem_id: number;
  estoque_origem_nome: string | null;
  estoque_destino_id: number;
  estoque_destino_nome: string | null;
  usuario_id: number;
  usuario_nome: string;
  total_itens: number;
  quantidade_total: number;
  itens: RawTransferMovement[];
}

function mapTransferMovement(r: RawTransferMovement): TransferMovement {
  return {
    saidaId: r.saida_id,
    entradaId: r.entrada_id,
    productId: r.produto_id,
    productName: r.produto_nome,
    sourceStockId: r.estoque_origem_id,
    sourceStockName: r.estoque_origem_nome,
    targetStockId: r.estoque_destino_id,
    targetStockName: r.estoque_destino_nome,
    quantity: Number(r.quantidade),
    userId: r.usuario_id,
    userName: r.usuario_nome,
    lotId: r.lote_id ?? null,
    lotCode: r.lote_codigo ?? null,
    ignoredFefo: !!r.ignorou_fefo,
  };
}

function mapTransferBatch(r: RawTransferBatch): TransferStockBatchResult {
  return {
    sourceStockId: r.estoque_origem_id,
    sourceStockName: r.estoque_origem_nome,
    targetStockId: r.estoque_destino_id,
    targetStockName: r.estoque_destino_nome,
    userId: r.usuario_id,
    userName: r.usuario_nome,
    totalItems: Number(r.total_itens),
    totalQuantity: Number(r.quantidade_total),
    items: (r.itens ?? []).map(mapTransferMovement),
  };
}
function mapMovement(r: RawMovement): Movement {
  return {
    id: r.id,
    estoqueId: r.estoque_id ?? null,
    estoqueNome: r.estoque_nome ?? null,
    productId: r.produto_id,
    productName: r.produto_nome,
    type: r.tipo,
    quantity: Number(r.quantidade),
    stockBefore: Number(r.estoque_antes),
    stockAfter: Number(r.estoque_depois),
    userName: r.usuario_nome,
    userId: r.usuario_id,
    note: r.observacao,
    barcode: r.codigo_barras,
    lotId: r.lote_id ?? null,
    lotCode: r.lote_codigo ?? null,
    ignoredFefo: !!r.ignorou_fefo,
    fefoJustification: r.justificativa_fefo ?? null,
    createdAt: r.criado_em,
  };
}

interface RawWasteReason {
  id: number;
  nome: string;
  ativo: 0 | 1 | boolean;
  criado_em: string;
}

function mapWasteReason(r: RawWasteReason): WasteReason {
  return {
    id: r.id,
    nome: r.nome,
    ativo: !!r.ativo,
    criadoEm: r.criado_em,
  };
}

interface RawWaste {
  id: number;
  estoque_id: number;
  estoque_nome: string;
  produto_id: number;
  produto_nome: string;
  codigo_barras?: string | null;
  usuario_id: number;
  usuario_nome: string;
  matricula?: string;
  motivo_id: number;
  motivo_nome: string;
  quantidade: number | string;
  estoque_antes: number | string;
  estoque_depois: number | string;
  valor_unitario: number | string;
  valor_total: number | string;
  lote_id?: number | null;
  lote_codigo?: string | null;
  criado_em: string;
}

function mapWaste(r: RawWaste): Waste {
  return {
    id: r.id,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    productId: r.produto_id,
    productName: r.produto_nome,
    barcode: r.codigo_barras,
    userId: r.usuario_id,
    userName: r.usuario_nome,
    matricula: r.matricula,
    motivoId: r.motivo_id,
    motivoNome: r.motivo_nome,
    quantity: Number(r.quantidade),
    stockBefore: Number(r.estoque_antes),
    stockAfter: Number(r.estoque_depois),
    unitValue: Number(r.valor_unitario),
    totalValue: Number(r.valor_total),
    lotId: r.lote_id ?? null,
    lotCode: r.lote_codigo ?? null,
    createdAt: r.criado_em,
  };
}

interface RawUser {
  id: number;
  matricula: string;
  nome: string;
  email: string | null;
  tipo: UserRole;
  ativo: 0 | 1 | boolean;
  criado_em: string;
  theme_preference?: "light" | "dark" | null;
}
function mapUser(r: RawUser): SystemUser {
  return {
    id: r.id,
    matricula: r.matricula,
    name: r.nome,
    email: r.email,
    role: r.tipo,
    active: !!r.ativo,
    createdAt: r.criado_em,
    themePreference: normalizeThemePreference(r.theme_preference),
  };
}

interface RawEstoque {
  id: number;
  nome: string;
  ativo: 0 | 1 | boolean;
  tipo?: "permanente" | "temporario" | string | null;
  arquivado?: 0 | 1 | boolean;
  arquivado_em?: string | null;
  criado_em: string;
}

interface RawKitItem {
  id: number;
  kit_id: number;
  produto_id: number;
  produto_nome: string;
  codigo_barras: string;
  unidade: string;
  quantidade_padrao: number | string;
  quantidade_atual: number | string;
  criado_em: string;
  atualizado_em: string;
}

interface RawKit {
  id: number;
  estoque_id: number;
  estoque_nome: string;
  nome: string;
  status: KitStatus;
  responsavel_atual_id: number | null;
  responsavel_atual_nome: string | null;
  criado_em: string;
  atualizado_em: string;
  ultima_movimentacao_tipo?: KitMovementType | null;
  ultima_movimentacao_em?: string | null;
  itens?: RawKitItem[];
}

interface RawKitProductOption {
  id: number;
  codigo_barras: string;
  nome: string;
  unidade: string;
  categoria_id: number | null;
  categoria_nome: string | null;
  estoque_atual: number | string;
}

interface RawKitMovementHistory {
  id: number;
  kit_id: number;
  kit_nome: string;
  estoque_id: number;
  estoque_nome: string;
  usuario_id: number;
  usuario_nome: string;
  tipo: KitMovementType;
  observacao: string | null;
  criado_em: string;
  itens: Array<{
    produto_id: number;
      produto_nome: string;
      quantidade_anterior: number | string;
      reposicao_operacao: number | string;
      quantidade_movimentada: number | string;
      quantidade_final: number | string;
  }>;
}

interface RawInventoryItem {
  produto_id: number;
  codigo_barras: string;
  produto_nome: string;
  categoria_id: number | null;
  categoria_nome: string | null;
  exige_validade?: 0 | 1 | boolean;
  data_validade?: string | null;
  unidade: string;
  preco_venda: string | number;
  estoque_id: number | null;
  estoque_nome: string | null;
  estoque_atual: string | number;
  estoque_minimo: string | number;
  ativo: 0 | 1 | boolean;
  status: InventoryStatus;
  estoques?: Array<{
    estoque_id: number;
    estoque_nome: string;
    estoque_atual: string | number;
  }>;
}

function mapInventoryItem(r: RawInventoryItem): InventoryCurrentItem {
  return {
    productId: r.produto_id,
    barcode: r.codigo_barras,
    productName: r.produto_nome,
    categoryId: r.categoria_id,
    categoryName: r.categoria_nome,
    requiresExpiration: !!r.exige_validade,
    expirationDate: r.data_validade ?? null,
    unit: r.unidade,
    price: Number(r.preco_venda),
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    stock: Number(r.estoque_atual),
    minStock: Number(r.estoque_minimo),
    active: !!r.ativo,
    status: r.status,
    estoques: (r.estoques ?? []).map((stock) => ({
      estoqueId: stock.estoque_id,
      estoqueNome: stock.estoque_nome,
      stock: Number(stock.estoque_atual),
    })),
  };
}

interface RawConferenceHistory {
  id: number;
  estoque_id: number | null;
  estoque_nome: string | null;
  usuario_id: number | null;
  usuario_nome: string | null;
  status: ConferenceStatus;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  finalizado_em: string | null;
  itens_count?: number | string;
  divergencias_count?: number | string;
}

interface RawConferenceItem {
  id: number;
  conferencia_id: number;
  estoque_id: number;
  estoque_nome: string | null;
  produto_id: number;
  codigo_barras: string;
  produto_nome: string;
  quantidade_sistema: number | string;
  quantidade_contada: number | string;
  diferenca: number | string;
  status: ConferenceItemStatus;
  criado_em: string;
  atualizado_em: string;
}

interface RawConference extends RawConferenceHistory {
  itens?: RawConferenceItem[];
}

interface RawConferenceProductOption {
  produto_id: number;
  codigo_barras: string;
  produto_nome: string;
  estoque_id: number;
  estoque_nome: string;
  quantidade_sistema: number | string;
}

function mapConferenceHistory(r: RawConferenceHistory): ConferenceHistory {
  return {
    id: r.id,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    userId: r.usuario_id,
    userName: r.usuario_nome,
    status: r.status,
    note: r.observacao,
    createdAt: r.criado_em,
    updatedAt: r.atualizado_em,
    finalizedAt: r.finalizado_em,
    itemsCount: Number(r.itens_count ?? 0),
    divergencesCount: Number(r.divergencias_count ?? 0),
  };
}

function mapConferenceItem(r: RawConferenceItem): ConferenceItem {
  return {
    id: r.id,
    conferenceId: r.conferencia_id,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    productId: r.produto_id,
    barcode: r.codigo_barras,
    productName: r.produto_nome,
    systemQuantity: Number(r.quantidade_sistema),
    countedQuantity: Number(r.quantidade_contada),
    difference: Number(r.diferenca),
    status: r.status,
    createdAt: r.criado_em,
    updatedAt: r.atualizado_em,
  };
}

function mapConference(r: RawConference): Conference {
  return {
    ...mapConferenceHistory(r),
    items: (r.itens ?? []).map(mapConferenceItem),
  };
}

function mapConferenceProductOption(r: RawConferenceProductOption): ConferenceProductOption {
  return {
    productId: r.produto_id,
    barcode: r.codigo_barras,
    productName: r.produto_nome,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    systemQuantity: Number(r.quantidade_sistema),
  };
}

function mapEstoque(r: RawEstoque): Estoque {
  return {
    id: r.id,
    nome: r.nome,
    ativo: !!r.ativo,
    tipo: r.tipo === "temporario" ? "temporario" : "permanente",
    arquivado: !!r.arquivado,
    arquivadoEm: r.arquivado_em ?? null,
    criadoEm: r.criado_em,
  };
}

function mapKitItem(r: RawKitItem): KitItem {
  return {
    id: r.id,
    kitId: r.kit_id,
    productId: r.produto_id,
    productName: r.produto_nome,
    barcode: r.codigo_barras,
    unit: r.unidade,
    defaultQuantity: Number(r.quantidade_padrao),
    currentQuantity: Number(r.quantidade_atual),
    createdAt: r.criado_em,
    updatedAt: r.atualizado_em,
  };
}

function mapKit(r: RawKit): Kit {
  return {
    id: r.id,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    name: r.nome,
    status: r.status,
    responsibleId: r.responsavel_atual_id,
    responsibleName: r.responsavel_atual_nome,
    createdAt: r.criado_em,
    updatedAt: r.atualizado_em,
    lastMovementType: r.ultima_movimentacao_tipo ?? null,
    lastMovementAt: r.ultima_movimentacao_em ?? null,
    items: r.itens?.map(mapKitItem),
  };
}

function mapKitProductOption(r: RawKitProductOption): KitProductOption {
  return {
    id: r.id,
    barcode: r.codigo_barras,
    name: r.nome,
    unit: r.unidade,
    categoryId: r.categoria_id,
    categoryName: r.categoria_nome,
    stock: Number(r.estoque_atual),
  };
}

function mapKitMovementHistory(r: RawKitMovementHistory): KitMovementHistory {
  return {
    id: r.id,
    kitId: r.kit_id,
    kitName: r.kit_nome,
    estoqueId: r.estoque_id,
    estoqueNome: r.estoque_nome,
    userId: r.usuario_id,
    userName: r.usuario_nome,
    type: r.tipo,
    note: r.observacao,
    createdAt: r.criado_em,
    items: (r.itens ?? []).map((item) => ({
      productId: item.produto_id,
        productName: item.produto_nome,
        previousQuantity: Number(item.quantidade_anterior),
        operationReplenishment: Number(item.reposicao_operacao ?? 0),
        movedQuantity: Number(item.quantidade_movimentada),
        finalQuantity: Number(item.quantidade_final),
    })),
  };
}

/* ----------------- AUTH ----------------- */

export async function adminLogin(matricula: string, senha: string): Promise<AuthUser> {
  const data = await request<{
    token: string;
    usuario: AuthUser;
  }>("/login", {
    method: "POST",
    body: JSON.stringify({ matricula, senha }),
  });

  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, data.token);
    setStoredUser({
      ...data.usuario,
      themePreference: normalizeThemePreference(data.usuario.themePreference),
    });
  }

  return {
    ...data.usuario,
    themePreference: normalizeThemePreference(data.usuario.themePreference),
  };
}

/* ----------------- SETUP ----------------- */

export interface InitialSetupPayload {
  empresa: {
    nome_empresa: string;
    unidade_empresa?: string;
    cnpj_empresa?: string;
    cidade_empresa?: string;
    uf_empresa?: string;
    endereco_empresa?: string;
    telefone_empresa?: string;
    email_empresa?: string;
    logo_url?: string;
  };
  sistema: {
    nome_sistema: string;
    tema_padrao: "light" | "dark";
    dias_alerta_validade: number;
    permitir_estoque_negativo: boolean;
    bloquear_saida_produto_vencido: boolean;
    registrar_vencido_ao_tentar_retirar?: boolean;
    permitir_ignorar_fefo: boolean;
    exigir_justificativa_fefo: boolean;
  };
  estoques: string[];
  master: {
    nome: string;
    matricula: string;
    email?: string;
    senha: string;
  };
}

export async function getSetupStatus(): Promise<{
  precisaSetup: boolean;
  setupConcluido: boolean;
}> {
  return request<{ precisaSetup: boolean; setupConcluido: boolean }>("/setup/status");
}

export async function createInitialSetup(payload: InitialSetupPayload): Promise<void> {
  await request<void>("/setup/inicial", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ----------------- CATEGORIAS ----------------- */

interface RawCategory {
  id: number;
  nome: string;
  exige_validade?: 0 | 1 | boolean;
  produtos_vinculados?: number | string;
}

function mapCategory(r: RawCategory): Category {
  return {
    id: r.id,
    nome: r.nome,
    exigeValidade: !!r.exige_validade,
    produtosVinculados: Number(r.produtos_vinculados ?? 0),
  };
}

export async function getCategories(): Promise<Category[]> {
  const rows = await request<RawCategory[]>("/categorias");
  return rows.map(mapCategory);
}

export async function createCategory(payload: {
  nome: string;
  exige_validade?: boolean;
}): Promise<Category> {
  const r = await request<RawCategory>("/categorias", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapCategory(r);
}

export async function updateCategory(
  id: number,
  payload: { nome: string; exige_validade?: boolean },
): Promise<Category> {
  const r = await request<RawCategory>(`/categorias/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapCategory(r);
}

export async function deleteCategory(id: number): Promise<void> {
  await request<void>(`/categorias/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

/* ----------------- ESTOQUES (admin) ----------------- */

export async function getEstoques(): Promise<Estoque[]> {
  const rows = await request<RawEstoque[]>("/estoques");
  return rows.map(mapEstoque);
}

export async function createEstoque(payload: {
  nome: string;
  ativo?: boolean;
  tipo?: "permanente" | "temporario";
}): Promise<Estoque> {
  const r = await request<RawEstoque>("/estoques", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapEstoque(r);
}

export async function setEstoqueStatus(id: number, ativo: boolean): Promise<Estoque> {
  const r = await request<RawEstoque>(`/estoques/${id}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ ativo }),
  });
  return mapEstoque(r);
}

export async function archiveEstoque(id: number): Promise<Estoque> {
  const r = await request<RawEstoque>(`/estoques/${id}/arquivar`, {
    method: "PATCH",
    auth: true,
  });
  return mapEstoque(r);
}

/* ----------------- KITS DA BOMBONIERE ----------------- */

export interface SaveKitPayload {
  estoque_id: number;
  nome: string;
  itens: Array<{
    produto_id: number;
    quantidade_padrao: number;
  }>;
}

export async function getKits(estoqueId: number | string = "all"): Promise<Kit[]> {
  const qs = `?estoque_id=${encodeURIComponent(String(estoqueId))}`;
  const rows = await request<RawKit[]>(`/kits${qs}`, { auth: true });
  return rows.map(mapKit);
}

export async function getOperationalKits(estoqueId: number | string): Promise<Kit[]> {
  const qs = `?estoque_id=${encodeURIComponent(String(estoqueId))}`;
  const rows = await request<RawKit[]>(`/kits/operacional${qs}`);
  return rows.map(mapKit);
}

export async function getKit(id: number): Promise<Kit> {
  const row = await request<RawKit>(`/kits/${id}`, { auth: true });
  return mapKit(row);
}

export async function getOperationalKit(id: number, estoqueId: number | string): Promise<Kit> {
  const qs = `?estoque_id=${encodeURIComponent(String(estoqueId))}`;
  const row = await request<RawKit>(`/kits/operacional/${id}${qs}`);
  return mapKit(row);
}

export async function createKit(payload: SaveKitPayload): Promise<Kit> {
  const row = await request<RawKit>("/kits", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapKit(row);
}

export async function updateKit(id: number, payload: SaveKitPayload): Promise<Kit> {
  const row = await request<RawKit>(`/kits/${id}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapKit(row);
}

export async function mountKit(id: number, observacao?: string): Promise<Kit> {
  const row = await request<RawKit>(`/kits/${id}/montar`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ observacao }),
  });
  return mapKit(row);
}

export async function replenishKit(id: number, observacao?: string): Promise<Kit> {
  const row = await request<RawKit>(`/kits/${id}/repor`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ observacao }),
  });
  return mapKit(row);
}

export async function withdrawKit(
  id: number,
  payload: { matricula: string; senha: string; observacao?: string },
): Promise<Kit> {
  const row = await request<RawKit>(`/kits/${id}/retirar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapKit(row);
}

export async function receiveKit(
  id: number,
  payload: {
      matricula: string;
      senha: string;
      observacao?: string;
      itens: Array<{ produto_id: number; quantidade_atual: number; reposicao_operacao?: number }>;
    },
): Promise<Kit> {
  const row = await request<RawKit>(`/kits/${id}/receber`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapKit(row);
}

export async function getKitProducts(estoqueId: number | string): Promise<KitProductOption[]> {
  const qs = `?estoque_id=${encodeURIComponent(String(estoqueId))}`;
  const rows = await request<RawKitProductOption[]>(`/kits/produtos${qs}`, { auth: true });
  return rows.map(mapKitProductOption);
}

export async function getKitHistory(
  filters: { estoque_id?: number | string; kit_id?: number | string } = {},
): Promise<KitMovementHistory[]> {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  });
  const rows = await request<RawKitMovementHistory[]>(
    `/kits/historico${qs.toString() ? `?${qs}` : ""}`,
    { auth: true },
  );
  return rows.map(mapKitMovementHistory);
}

/* ----------------- CONFIGURACOES ----------------- */

export interface SystemConfig {
  chave: string;
  valor: string;
  categoria?: string | null;
  nivelAcesso?: string | null;
}

type RawSystemConfig = Record<string, unknown>;

function mapSystemConfig(row: RawSystemConfig): SystemConfig {
  return {
    chave: String(row.chave ?? row.key ?? row.nome ?? row.config_key ?? ""),
    valor: String(row.valor ?? row.value ?? row.config_value ?? ""),
    categoria:
      row.categoria !== undefined || row.grupo !== undefined || row.category !== undefined
        ? String(row.categoria ?? row.grupo ?? row.category ?? "")
        : null,
    nivelAcesso:
      row.nivel_acesso !== undefined || row.access_level !== undefined
        ? String(row.nivel_acesso ?? row.access_level ?? "")
        : null,
  };
}

export async function getSystemConfigs(): Promise<SystemConfig[]> {
  const rows = await request<RawSystemConfig[]>("/configuracoes", { auth: true });
  return rows.map(mapSystemConfig).filter((item) => item.chave);
}

export async function updateSystemConfigs(
  configs: Array<{
    chave: string;
    valor: string | number | boolean;
    categoria?: string;
    nivelAcesso?: "admin" | "master";
  }>,
): Promise<void> {
  await request<void>("/configuracoes", {
    method: "PUT",
    auth: true,
    body: JSON.stringify({ configs }),
  });
}

/* ----------------- INVENTARIO E CONFERENCIAS ----------------- */

export async function getInventoryCurrent(
  estoqueId: number | string = "all",
): Promise<InventoryCurrentItem[]> {
  const qs = `?estoque_id=${encodeURIComponent(String(estoqueId))}`;
  const rows = await request<RawInventoryItem[]>(`/inventario/estoque-atual${qs}`);
  return rows.map(mapInventoryItem);
}

export async function getConferences(): Promise<ConferenceHistory[]> {
  const rows = await request<RawConferenceHistory[]>("/conferencias", { auth: true });
  return rows.map(mapConferenceHistory);
}

export async function getConference(id: number): Promise<Conference> {
  const row = await request<RawConference>(`/conferencias/${id}`, { auth: true });
  return mapConference(row);
}

export async function createConference(payload: {
  estoque_id: number | null;
  observacao?: string;
}): Promise<Conference> {
  const row = await request<RawConference>("/conferencias", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapConference(row);
}

export async function updateConference(
  id: number,
  payload: { estoque_id?: number | null; observacao?: string; usuario_nome?: string },
): Promise<Conference> {
  const row = await request<RawConference>(`/conferencias/${id}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapConference(row);
}

export async function searchConferenceProduct(
  barcode: string,
  estoqueId: number | string | null,
): Promise<ConferenceProductOption[]> {
  const qs = new URLSearchParams();
  qs.set("codigo_barras", barcode);
  qs.set("estoque_id", estoqueId == null ? "all" : String(estoqueId));
  const rows = await request<RawConferenceProductOption[]>(
    `/conferencias/produtos/buscar?${qs.toString()}`,
    { auth: true },
  );
  return rows.map(mapConferenceProductOption);
}

export async function saveConferenceItem(
  conferenceId: number,
  payload: { codigo_barras: string; quantidade_contada: number; estoque_id?: number },
): Promise<Conference> {
  const row = await request<RawConference>(`/conferencias/${conferenceId}/itens`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapConference(row);
}

export async function deleteConferenceItem(conferenceId: number, itemId: number): Promise<void> {
  await request<void>(`/conferencias/${conferenceId}/itens/${itemId}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function deleteConference(id: number): Promise<void> {
  await request<void>(`/conferencias/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function finalizeConference(id: number): Promise<Conference> {
  const row = await request<RawConference>(`/conferencias/${id}/finalizar`, {
    method: "PATCH",
    auth: true,
  });
  return mapConference(row);
}

/* ----------------- PRODUTOS ----------------- */

export async function getProducts(estoqueId?: number | string): Promise<Product[]> {
  const qs = estoqueId ? `?estoque_id=${encodeURIComponent(String(estoqueId))}` : "";
  const rows = await request<RawProduct[]>(`/produtos${qs}`);
  return rows.map(mapProduct);
}

export async function getProductByBarcode(
  barcode: string,
  estoqueId?: number | string,
): Promise<Product | null> {
  try {
    const qs = estoqueId ? `?estoque_id=${encodeURIComponent(String(estoqueId))}` : "";
    const r = await request<RawProduct>(`/produtos/codigo/${encodeURIComponent(barcode)}${qs}`);
    return r ? mapProduct(r) : null;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (/encontrado/i.test(message)) return null;
    throw e;
  }
}

export interface CreateProductPayload {
  codigo_barras: string;
  nome: string;
  categoria_id: number;
  unidade: string;
  preco_venda: number;
  estoque_id: number;
  estoque_atual: number;
  estoque_minimo: number;
  data_validade?: string | null;
  lote?: string;
  ativo: boolean;
}
export async function createProductsBatch(payload: {
  produtos: CreateProductPayload[];
}): Promise<Product[]> {
  const rows = await request<RawProduct[]>("/produtos/batch", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return rows.map(mapProduct);
}

export type UpdateProductPayload = Partial<
  Omit<CreateProductPayload, "estoque_atual" | "estoque_minimo">
>;

export async function updateProduct(id: number, payload: UpdateProductPayload): Promise<Product> {
  const r = await request<RawProduct>(`/produtos/${id}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapProduct(r);
}

export async function setProductStatus(id: number, ativo: boolean): Promise<Product> {
  const r = await request<RawProduct>(`/produtos/${id}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ ativo }),
  });
  return mapProduct(r);
}

export async function deleteProduct(id: number): Promise<void> {
  await request<void>(`/produtos/${id}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function getProductLots(
  productId: number,
  estoqueId?: number | string,
): Promise<ProductLot[]> {
  const qs = estoqueId ? `?estoque_id=${encodeURIComponent(String(estoqueId))}` : "";
  const rows = await request<RawProductLot[]>(`/produtos/${productId}/lotes${qs}`);
  return rows.map(mapProductLot);
}

export async function updateProductLot(
  productId: number,
  lotId: number,
  payload: {
    lote: string;
    data_validade?: string | null;
    quantidade: number;
  },
): Promise<ProductLot> {
  const row = await request<RawProductLot>(`/produtos/${productId}/lotes/${lotId}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapProductLot(row);
}

/* ----------------- MOVIMENTAÇÕES ----------------- */

export async function registerMovement(payload: {
  codigo_barras: string;
  estoque_id: number;
  matricula: string;
  senha: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao?: string;
  lote: string;
  data_validade?: string | null;
  confirmar_ignorar_fefo?: boolean;
  justificativa_fefo?: string;
}): Promise<Movement> {
  const endpoint = payload.tipo === "entrada" ? "/movimentacoes/entrada" : "/movimentacoes/saida";
  const r = await request<RawMovement>(endpoint, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapMovement(r);
}

export async function transferStock(payload: {
  codigo_barras: string;
  estoque_origem_id: number;
  estoque_destino_id: number;
  matricula: string;
  senha: string;
  quantidade: number;
  observacao?: string;
  lote: string;
  confirmar_ignorar_fefo?: boolean;
  justificativa_fefo?: string;
}): Promise<TransferMovement> {
  const r = await request<RawTransferMovement>("/movimentacoes/transferencia", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapTransferMovement(r);
}

export async function transferStockBatch(
  payload: TransferStockBatchPayload,
): Promise<TransferStockBatchResult> {
  const r = await request<RawTransferBatch>("/movimentacoes/transferencia/lote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapTransferBatch(r);
}

export interface MovementFilters {
  data_inicial?: string;
  data_final?: string;
  tipo?: "entrada" | "saida" | "desperdicio" | "ajuste";
  categoria_id?: number | string;
  produto_id?: number;
  codigo_barras?: string;
  usuario_id?: number;
  estoque_id?: number | string;
}
export async function getMovements(filters: MovementFilters = {}): Promise<Movement[]> {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const path = `/movimentacoes${qs.toString() ? `?${qs}` : ""}`;
  const rows = await request<RawMovement[]>(path);
  return rows.map(mapMovement);
}

export async function adjustStock(payload: {
  itens: Array<{
    produto_id: number;
    estoque_id: number;
    lote_id?: number | null;
    quantidade_final: number;
    motivo: string;
  }>;
}): Promise<Movement[]> {
  const rows = await request<RawMovement[]>("/movimentacoes/ajuste", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return rows.map(mapMovement);
}

/* ----------------- DESPERDICIOS ----------------- */

export interface WasteFilters {
  estoque_id?: number | string;
  produto_id?: number;
  usuario_id?: number;
  motivo_id?: number | string;
  data_inicial?: string;
  data_final?: string;
}

export async function getWasteReasons(): Promise<WasteReason[]> {
  const rows = await request<RawWasteReason[]>("/motivos-desperdicio");
  return rows.map(mapWasteReason);
}

export async function registerWaste(payload: {
  estoque_id: number;
  codigo_barras: string;
  quantidade: number;
  motivo_id: number;
  matricula: string;
  senha: string;
  lote: string;
}): Promise<Waste> {
  const r = await request<RawWaste>("/desperdicios", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapWaste(r);
}

export async function getWastes(filters: WasteFilters = {}): Promise<Waste[]> {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const rows = await request<RawWaste[]>(`/desperdicios${qs.toString() ? `?${qs}` : ""}`);
  return rows.map(mapWaste);
}

export async function getWasteSummary(filters: WasteFilters = {}): Promise<WasteSummary> {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return request<WasteSummary>(`/desperdicios/resumo${qs.toString() ? `?${qs}` : ""}`);
}

export async function processExpiredWastes(): Promise<{ processados: number; itens: RawWaste[] }> {
  return request<{ processados: number; itens: RawWaste[] }>("/desperdicios/processar-vencidos", {
    method: "POST",
    auth: true,
  });
}

/* ----------------- USUÁRIOS (admin) ----------------- */

export async function getUsers(): Promise<SystemUser[]> {
  const rows = await request<RawUser[]>("/usuarios", { auth: true });
  return rows.map(mapUser);
}

export async function createUser(payload: {
  matricula: string;
  nome: string;
  email?: string;
  senha?: string;
  tipo: UserRole;
  ativo: boolean;
}): Promise<SystemUser> {
  const r = await request<RawUser>("/usuarios", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapUser(r);
}

export async function updateUser(
  id: number,
  payload: Partial<{
    matricula: string;
    nome: string;
    email: string;
    senha: string;
    tipo: UserRole;
    ativo: boolean;
  }>,
): Promise<SystemUser> {
  const r = await request<RawUser>(`/usuarios/${id}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapUser(r);
}

export async function setUserStatus(id: number, ativo: boolean): Promise<SystemUser> {
  const r = await request<RawUser>(`/usuarios/${id}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ ativo }),
  });
  return mapUser(r);
}
export async function getUserByMatricula(matricula: string) {
  const res = await fetch(`${API_URL}/usuarios/${matricula}`);

  const body = await res.json();

  if (!res.ok || body.success === false) {
    throw new Error(body.message || "Usuário não encontrado");
  }

  return body.data;
}

export async function changeUserPassword(
  id: number,
  senhaAtual: string,
  novaSenha: string,
): Promise<void> {
  await request<void>(`/usuarios/${id}/senha`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify({
      senhaAtual,
      novaSenha,
    }),
  });
}

export async function updateMyPreferences(payload: {
  themePreference: "light" | "dark";
}): Promise<{ themePreference: "light" | "dark" }> {
  const response = await request<{ id: number; themePreference: "light" | "dark" }>(
    "/usuarios/me/preferencias",
    {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(payload),
    },
  );

  const storedUser = getStoredUser();
  if (storedUser) {
    setStoredUser({
      ...storedUser,
      themePreference: normalizeThemePreference(response.themePreference),
    });
  }

  return {
    themePreference: normalizeThemePreference(response.themePreference),
  };
}

export async function resetUserPassword(id: number): Promise<void> {
  await request<void>(`/usuarios/${id}/resetar-senha`, {
    method: "PATCH",
    auth: true,
  });
}
