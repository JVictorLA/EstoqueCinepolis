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
  tipo: "permanente" | "temporario";
  arquivado: boolean;
  arquivadoEm: string | null;
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

export type LotStatus =
  | "vencido"
  | "proximo_vencimento"
  | "validade_15"
  | "validade_30"
  | "ok"
  | "sem_validade";

export interface ProductLot {
  id: number;
  estoqueProdutoId: number;
  productId: number;
  estoqueId: number;
  estoqueNome: string;
  lot: string;
  expirationDate: string | null;
  quantity: number;
  status: LotStatus;
}

export interface FefoWarning {
  lote_id: number;
  lote: string;
  data_validade: string | null;
  quantidade: number;
  mensagem: string;
  permitir_ignorar_fefo?: boolean | number | string;
  exigir_justificativa_fefo?: boolean | number | string;
  permitirIgnorarFefo?: boolean | number | string;
  exigirJustificativaFefo?: boolean | number | string;
}

export type MovementType = "entrada" | "saida" | "desperdicio" | "ajuste";

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
  lotId?: number | null;
  lotCode?: string | null;
  ignoredFefo?: boolean;
  fefoJustification?: string | null;
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
  lotId?: number | null;
  lotCode?: string | null;
  ignoredFefo?: boolean;
}

export interface TransferStockBatchItem {
  codigo_barras: string;
  quantidade: number;
  lote: string;
  confirmar_ignorar_fefo?: boolean;
  justificativa_fefo?: string;
}

export interface TransferStockBatchPayload {
  estoque_origem_id: number;
  estoque_destino_id: number;
  matricula: string;
  senha: string;
  observacao?: string;
  autorizacao_admin?: {
    matricula: string;
    senha: string;
  };
  itens: TransferStockBatchItem[];
}

export interface TransferStockBatchResult {
  sourceStockId: number;
  sourceStockName: string | null;
  targetStockId: number;
  targetStockName: string | null;
  userId: number;
  userName: string;
  totalItems: number;
  totalQuantity: number;
  items: TransferMovement[];
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
  themePreference?: "light" | "dark";
  canDelete?: boolean;
}

export interface AuthUser {
  id: number;
  matricula: string;
  nome: string;
  email?: string;
  tipo: UserRole;
  ativo: boolean;
  themePreference: "light" | "dark";
  precisaTrocarSenha?: boolean;
  senhaExpirada?: boolean;
}

export type PasswordStatus = "first_access" | "expired";

export interface PasswordChallengeUser {
  id: number;
  matricula: string;
  nome: string;
  tipo?: UserRole;
  themePreference?: "light" | "dark";
  precisaTrocarSenha?: boolean;
  senhaExpirada?: boolean;
}

export interface PasswordChallenge {
  password_status: PasswordStatus;
  usuario: PasswordChallengeUser;
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
  lotId?: number | null;
  lotCode?: string | null;
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
  | "validade_15"
  | "validade_30"
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

export type KitStatus =
  | "pronto_para_retirada"
  | "em_uso"
  | "aguardando_recebimento"
  | "kit_incompleto";

export type KitMovementType =
  | "criacao"
  | "montagem"
  | "retirada"
  | "recebimento"
  | "reposicao"
  | "ajuste";

export interface KitItem {
  id: number;
  kitId: number;
  productId: number;
  productName: string;
  barcode: string;
  unit: string;
  defaultQuantity: number;
  currentQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Kit {
  id: number;
  estoqueId: number;
  estoqueNome: string;
  name: string;
  status: KitStatus;
  responsibleId: number | null;
  responsibleName: string | null;
  createdAt: string;
  updatedAt: string;
  lastMovementType?: KitMovementType | null;
  lastMovementAt?: string | null;
  items?: KitItem[];
}

export interface KitProductOption {
  id: number;
  barcode: string;
  name: string;
  unit: string;
  categoryId: number | null;
  categoryName: string | null;
  stock: number;
}

export interface KitMovementItem {
  productId: number;
  productName: string;
  previousQuantity: number;
  operationReplenishment: number;
  movedQuantity: number;
  finalQuantity: number;
}

export interface KitMovementHistory {
  id: number;
  kitId: number;
  kitName: string;
  estoqueId: number;
  estoqueNome: string;
  userId: number;
  userName: string;
  type: KitMovementType;
  note: string | null;
  createdAt: string;
  items: KitMovementItem[];
}
