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
  Product, Movement, SystemUser, Category, AuthUser, UserRole,
} from "@/types";

const API_URL =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:3333";

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


async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
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
    throw new Error(`Não foi possível conectar à API (${API_URL}). Verifique se o backend está rodando.`);
  }

  let body: ApiEnvelope<T> | null = null;
  try { body = (await res.json()) as ApiEnvelope<T>; } catch { /* sem corpo */ }

  if (!res.ok || (body && body.success === false)) {
    throw new Error(body?.message || `Erro ${res.status}`);
  }
  return (body?.data as T) ?? (null as any);
}

/* ----------------- Mappers (backend ⇄ UI) ----------------- */

interface RawProduct {
  id: number;
  codigo_barras: string;
  nome: string;
  categoria_id: number | null;
  categoria_nome: string | null;
  unidade: string;
  preco_venda: string | number;
  estoque_atual: string | number;
  estoque_minimo: string | number;
  ativo: 0 | 1 | boolean;
  criado_em: string;
  atualizado_em?: string;
  sem_estoque?: 0 | 1;
  estoque_baixo?: 0 | 1;
}

function mapProduct(r: RawProduct): Product {
  return {
    id: r.id,
    barcode: r.codigo_barras,
    name: r.nome,
    categoryId: r.categoria_id,
    categoryName: r.categoria_nome,
    unit: r.unidade,
    price: Number(r.preco_venda),
    stock: Number(r.estoque_atual),
    minStock: Number(r.estoque_minimo),
    active: !!r.ativo,
    favorite: false,
    lowStock: !!r.estoque_baixo,
    noStock: !!r.sem_estoque,
    createdAt: r.criado_em,
  };
}

interface RawMovement {
  id: number;
  produto_id: number;
  usuario_id: number;
  tipo: "entrada" | "saida";
  quantidade: number;
  estoque_antes: number | string;
  estoque_depois: number | string;
  usuario_nome: string;
  produto_nome: string;
  observacao: string | null;
  codigo_barras?: string | null;
  criado_em: string;
}
function mapMovement(r: RawMovement): Movement {
  return {
    id: r.id,
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

interface RawUser {
  id: number; matricula: string; nome: string; email: string | null;
  tipo: UserRole; ativo: 0 | 1 | boolean; criado_em: string;
}
function mapUser(r: RawUser): SystemUser {
  return {
    id: r.id, matricula: r.matricula, name: r.nome, email: r.email,
    role: r.tipo, active: !!r.ativo, createdAt: r.criado_em,
  };
}

/* ----------------- AUTH ----------------- */

export async function adminLogin(matricula: string, senha: string): Promise<AuthUser> {
  const data = await request<{ token: string; usuario: AuthUser }>("/login", {
    method: "POST",
    body: JSON.stringify({ matricula, senha }),
  });
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
  }
  return data.usuario;
}

/* ----------------- CATEGORIAS ----------------- */

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>("/categorias");
}

/* ----------------- PRODUTOS ----------------- */

export async function getProducts(): Promise<Product[]> {
  const rows = await request<RawProduct[]>("/produtos");
  return rows.map(mapProduct);
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const r = await request<RawProduct>(`/produtos/${encodeURIComponent(barcode)}`);
    return r ? mapProduct(r) : null;
  } catch (e: any) {
    if (/não encontrado/i.test(e?.message || "")) return null;
    throw e;
  }
}

export interface CreateProductPayload {
  codigo_barras: string;
  nome: string;
  categoria_id: number;
  unidade: string;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
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

/* ----------------- MOVIMENTAÇÕES ----------------- */

export async function registerMovement(payload: {
  codigo_barras: string;
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

export interface MovementFilters {
  data_inicial?: string;
  data_final?: string;
  tipo?: "entrada" | "saida";
  produto_id?: number;
  codigo_barras?: string;
  usuario_id?: number;
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

/* ----------------- USUÁRIOS (admin) ----------------- */

export async function getUsers(): Promise<SystemUser[]> {
  const rows = await request<RawUser[]>("/usuarios", { auth: true });
  return rows.map(mapUser);
}

export async function createUser(payload: {
  matricula: string; nome: string; email?: string;
  senha: string; tipo: UserRole; ativo: boolean;
}): Promise<SystemUser> {
  const r = await request<RawUser>("/usuarios", {
    method: "POST", auth: true, body: JSON.stringify(payload),
  });
  return mapUser(r);
}


export async function updateUser(id: number, payload: Partial<{
  matricula: string; nome: string; email: string;
  senha: string; tipo: UserRole; ativo: boolean;
}>): Promise<SystemUser> {
  const r = await request<RawUser>(`/usuarios/${id}`, {
    method: "PUT", auth: true, body: JSON.stringify(payload),
  });
  return mapUser(r);
}

export async function setUserStatus(id: number, ativo: boolean): Promise<SystemUser> {
  const r = await request<RawUser>(`/usuarios/${id}/status`, {
    method: "PATCH", auth: true, body: JSON.stringify({ ativo }),
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