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
  UserRole,
  Estoque,
  TransferMovement,
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
} from "@/types";

const API_URL = import.meta.env?.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3333";

const TOKEN_KEY = "cinepolis.token";
const USER_KEY = "cinepolis.user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
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
    throw new Error(body?.message || `Erro ${res.status}`);
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
  tipo: "entrada" | "saida" | "desperdicio";
  quantidade: number;
  estoque_antes: number | string;
  estoque_depois: number | string;
  usuario_nome: string;
  produto_nome: string;
  observacao: string | null;
  codigo_barras?: string | null;
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
  };
}

interface RawEstoque {
  id: number;
  nome: string;
  ativo: 0 | 1 | boolean;
  criado_em: string;
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
    criadoEm: r.criado_em,
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
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
  }

  return data.usuario;
}

/* ----------------- SETUP ----------------- */

export async function getSetupStatus(): Promise<{ precisaSetup: boolean }> {
  return request<{ precisaSetup: boolean }>("/setup/status");
}

export async function createMasterUser(payload: {
  nome: string;
  matricula: string;
  email?: string;
  senha: string;
}): Promise<SystemUser> {
  const r = await request<RawUser>("/setup/master", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapUser(r);
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

export async function createEstoque(payload: { nome: string; ativo?: boolean }): Promise<Estoque> {
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
    const r = await request<RawProduct>(`/produtos/${encodeURIComponent(barcode)}${qs}`);
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
  ativo: boolean;
}
export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const r = await request<RawProduct>("/produtos", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
  return mapProduct(r);
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

/* ----------------- MOVIMENTAÇÕES ----------------- */

export async function registerMovement(payload: {
  codigo_barras: string;
  estoque_id: number;
  matricula: string;
  senha: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  observacao?: string;
}): Promise<Movement> {
  const r = await request<RawMovement>("/movimentacoes", {
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
}): Promise<TransferMovement> {
  const r = await request<RawTransferMovement>("/movimentacoes/transferencia", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapTransferMovement(r);
}

export interface MovementFilters {
  data_inicial?: string;
  data_final?: string;
  tipo?: "entrada" | "saida" | "desperdicio";
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
  senha: string;
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

export async function resetUserPassword(id: number): Promise<void> {
  await request<void>(`/usuarios/${id}/resetar-senha`, {
    method: "PATCH",
    auth: true,
  });
}
