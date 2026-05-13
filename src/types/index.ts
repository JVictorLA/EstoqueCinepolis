export interface Category {
  id: number;
  nome: string;
  produtosVinculados?: number;
}

export interface Estoque {
  id: number;
  nome: string;
  ativo: boolean;
  criadoEm: string;
}

export interface Product {
  id: number;
  estoqueId?: number | null;
  estoqueNome?: string | null;
  barcode: string;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  unit: string;
  price: number;
  stock: number;
  minStock: number;
  active: boolean;
  favorite: boolean;
  imageUrl?: string;
  lowStock?: boolean;
  noStock?: boolean;
  movementsCount?: number;
  createdAt: string;
}

export type MovementType = "entrada" | "saida";

export interface Movement {
  id: number;
  estoqueId?: number | null;
  estoqueNome?: string | null;
  productId: number;
  productName: string;
  type: MovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  userName: string;
  userId: number;
  note?: string | null;
  barcode?: string | null;
  createdAt: string;
}

export interface TransferMovement {
  saidaId: number;
  entradaId: number;
  productId: number;
  productName: string;
  sourceStockId: number;
  sourceStockName: string;
  targetStockId: number;
  targetStockName: string;
  quantity: number;
  userId: number;
  userName: string;
}

export type UserRole = "admin" | "operador";

export interface SystemUser {
  id: number;
  name: string;
  matricula: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  matricula: string;
  nome: string;
  email?: string;
  tipo: UserRole;
  ativo: boolean;
  precisaTrocarSenha?: boolean;
}
