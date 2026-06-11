export const VEHICLE_STATUS = ["disponivel", "reservado", "vendido"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUS)[number];

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
};

// Badge: fundo tonal + texto `ink` (legível) + anel/ponto colorido carregando
// o sinal semântico. `success`/`warning` são claros demais para servir de texto.
export const STATUS_BADGE_COLORS: Record<VehicleStatus, string> = {
  disponivel: "bg-success/15 text-ink ring-1 ring-success/40",
  reservado: "bg-warning/15 text-ink ring-1 ring-warning/40",
  vendido: "bg-n100 text-n600 ring-1 ring-n200",
};

export const STATUS_DOT_COLORS: Record<VehicleStatus, string> = {
  disponivel: "bg-success",
  reservado: "bg-warning",
  vendido: "bg-n400",
};

export const FUELS = ["flex", "gasolina", "etanol", "diesel", "eletrico", "hibrido", "gnv"] as const;
export type Fuel = (typeof FUELS)[number];

export const FUEL_LABELS: Record<Fuel, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
  gnv: "GNV",
};

export const TRANSMISSIONS = ["automatico", "manual", "cvt", "semi_automatico"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  automatico: "Automático",
  manual: "Manual",
  cvt: "CVT",
  semi_automatico: "Semi-automático",
};

export const BODY_TYPES = [
  "hatch", "sedan", "suv", "picape", "minivan", "cupe", "conversivel", "perua",
] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  hatch: "Hatch",
  sedan: "Sedã",
  suv: "SUV",
  picape: "Picape",
  minivan: "Minivan",
  cupe: "Cupê",
  conversivel: "Conversível",
  perua: "Perua / SW",
};

export const CONDITIONS = ["novo", "seminovo", "usado"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  novo: "Novo",
  seminovo: "Seminovo",
  usado: "Usado",
};

export const COMMON_BRANDS = [
  "Chevrolet",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jeep",
  "Mitsubishi",
  "Nissan",
  "Renault",
  "Toyota",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Kia",
  "Peugeot",
  "Citroën",
] as const;

export const TRANSACTION_TYPES = [
  "entrada", "saida", "despesa_direta", "despesa_fixa", "despesa_var", "comissao",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  entrada: "Entrada (compra)",
  saida: "Saída (venda)",
  despesa_direta: "Custo direto do veículo",
  despesa_fixa: "Despesa fixa",
  despesa_var: "Despesa variável",
  comissao: "Comissão",
};

/** Categorias-padrão para despesas operacionais. */
export const EXPENSE_CATEGORIES = {
  estrutura: ["Aluguel", "Energia", "Água", "Internet", "Telefone", "IPTU", "Condomínio"],
  pessoal:   ["Salários", "Pró-labore", "Vale-transporte", "Vale-refeição", "Treinamento"],
  operacao:  ["Marketing", "Combustível", "Limpeza", "Material de escritório", "Software"],
  veiculo:   ["Polimento", "Reparo mecânico", "NF de peça", "Detran", "Despachante", "Laudo cautelar", "IPVA proporcional", "Documentação"],
  impostos:  ["DAS", "INSS", "ISS", "ICMS", "Contador"],
} as const;

export type ExpenseGroup = keyof typeof EXPENSE_CATEGORIES;

export const EXPENSE_GROUP_LABELS: Record<ExpenseGroup, string> = {
  estrutura: "Estrutura",
  pessoal:   "Pessoal",
  operacao:  "Operação",
  veiculo:   "Veículo (avulso)",
  impostos:  "Impostos",
};

/** Lista chapada de todas as categorias para uso em selects simples. */
export const ALL_EXPENSE_CATEGORIES: string[] = Object.values(EXPENSE_CATEGORIES).flat();

/** Tipos de transação que exigem um veículo associado. */
export const TX_REQUIRES_VEHICLE: ReadonlySet<TransactionType> = new Set([
  "entrada", "saida", "despesa_direta",
]);

// --- Leads ---

export const LEAD_STATUS = ["novo", "contatado", "negociando", "convertido", "perdido"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const LEAD_SOURCES = ["site", "whatsapp", "manual", "marketplace"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  manual: "Manual",
  marketplace: "Marketplace",
};

/** Estágios do funil de leads, na ordem — rótulo + cor de badge. */
export const LEAD_STAGES = [
  { key: "novo",        label: "Novo",          color: "bg-signal/10 text-signal ring-signal/40" },
  { key: "contatado",   label: "Contatado",     color: "bg-warning/15 text-ink ring-warning/40" },
  { key: "negociando",  label: "Em negociação", color: "bg-sky-100 text-ink ring-sky-300" },
  { key: "convertido",  label: "Convertido",    color: "bg-success/15 text-ink ring-success/40" },
  { key: "perdido",     label: "Perdido",       color: "bg-n100 text-n600 ring-n200" },
] as const;

// Branding (nome, contatos, cores) vem do tenant — ver tabela `tenants` em lib/schema.ts.
