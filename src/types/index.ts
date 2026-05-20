export interface Category {
  id: number;
  nome: string;
  exigeValidade: boolean;
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
  requiresExpiration: boolean;
  expirationDate: string | null;
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

export type MovementType = "entrada" | "saida" | "desperdicio";

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

export type UserRole = "master" | "admin" | "operador";

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

export interface WasteReason {
  id: number;
  nome: string;
  ativo: boolean;
  criadoEm: string;
}

export interface Waste {
  id: number;
  estoqueId: number;
  estoqueNome: string;
  productId: number;
  productName: string;
  barcode?: string | null;
  userId: number;
  userName: string;
  matricula?: string;
  motivoId: number;
  motivoNome: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  unitValue: number;
  totalValue: number;
  createdAt: string;
}

export interface WasteSummaryGroup {
  dia?: string;
  produto_id?: number;
  produto_nome?: string;
  usuario_id?: number;
  usuario_nome?: string;
  motivo_id?: number;
  motivo_nome?: string;
  registros?: number;
  quantidade: number | string;
  valor_total: number | string;
}

export interface WasteSummary {
  totais: {
    valor_total: number;
    quantidade_total: number;
    registros: number;
  };
  por_dia: WasteSummaryGroup[];
  por_produto: WasteSummaryGroup[];
  por_funcionario: WasteSummaryGroup[];
  por_motivo: WasteSummaryGroup[];
  ranking: Array<{
    id: number;
    criado_em: string;
    estoque_nome: string;
    produto_nome: string;
    usuario_nome: string;
    motivo_nome: string;
    quantidade: number | string;
    valor_total: number | string;
  }>;
}

export type InventoryStatus =
  | "ok"
  | "estoque_baixo"
  | "sem_estoque"
  | "vencido"
  | "proximo_vencimento";

export interface InventoryStockLocation {
  estoqueId: number;
  estoqueNome: string;
  stock: number;
}

export interface InventoryCurrentItem {
  productId: number;
  barcode: string;
  productName: string;
  categoryId: number | null;
  categoryName: string | null;
  requiresExpiration: boolean;
  expirationDate: string | null;
  unit: string;
  price: number;
  estoqueId: number | null;
  estoqueNome: string | null;
  stock: number;
  minStock: number;
  active: boolean;
  status: InventoryStatus;
  estoques: InventoryStockLocation[];
}

export type ConferenceStatus = "aberta" | "finalizada";
export type ConferenceItemStatus = "ok" | "falta" | "sobra";

export interface ConferenceHistory {
  id: number;
  estoqueId: number | null;
  estoqueNome: string | null;
  userId: number | null;
  userName: string | null;
  status: ConferenceStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  itemsCount: number;
  divergencesCount: number;
}

export interface ConferenceItem {
  id: number;
  conferenceId: number;
  estoqueId: number;
  estoqueNome: string | null;
  productId: number;
  barcode: string;
  productName: string;
  systemQuantity: number;
  countedQuantity: number;
  difference: number;
  status: ConferenceItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Conference extends ConferenceHistory {
  items: ConferenceItem[];
}

export interface ConferenceProductOption {
  productId: number;
  barcode: string;
  productName: string;
  estoqueId: number;
  estoqueNome: string;
  systemQuantity: number;
}
