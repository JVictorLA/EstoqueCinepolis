export interface Category {
  id: number;
  nome: string;
}

export interface Product {
  id: number;
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
  createdAt: string;
}

export type MovementType = "entrada" | "saida";

export interface Movement {
  id: number;
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
