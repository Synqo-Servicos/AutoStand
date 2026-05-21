/**
 * Registro central de templates de documentos do admin.
 *
 * Cada template:
 *  - `fields`: schema dos campos pedidos ao admin (render genérico no form)
 *  - O componente PDF correspondente fica em `components/pdf/templates/<id>.tsx`
 *    e é resolvido em `lib/pdf.ts → renderTemplate()`.
 */

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "select" | "checkbox";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  /** Largura no grid (1 ou 2 colunas). */
  span?: 1 | 2;
}

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  /** Se exige veículo do estoque. Quase todos sim, exceto consignação (vem de fora). */
  requiresVehicle: boolean;
  fields: FieldDef[];
}

export type TemplateId =
  | "compra_venda"
  | "recibo_sinal"
  | "consignacao"
  | "garantia"
  | "os_preparacao"
  | "test_drive"
  | "procuracao_transferencia"
  | "checklist_entrada";

export const TEMPLATES: TemplateConfig[] = [
  // ---------------------------------------------------------------------------
  {
    id: "compra_venda",
    name: "Contrato de Compra e Venda",
    description: "Documento principal de venda do veículo para o cliente final.",
    requiresVehicle: true,
    fields: [
      { key: "buyer_name",    label: "Nome do comprador",     type: "text",     required: true, span: 2 },
      { key: "buyer_cpf",     label: "CPF",                   type: "text",     required: true, placeholder: "000.000.000-00" },
      { key: "buyer_rg",      label: "RG / Órgão expedidor",  type: "text" },
      { key: "buyer_address", label: "Endereço completo",     type: "textarea", required: true, span: 2 },
      { key: "buyer_phone",   label: "Telefone",              type: "text",     placeholder: "(00) 00000-0000" },
      { key: "buyer_email",   label: "Email",                 type: "text" },
      { key: "sale_price",    label: "Valor da venda (R$)",   type: "money",    required: true },
      { key: "payment_method",label: "Forma de pagamento",    type: "select",   required: true, options: [
        { value: "a_vista",    label: "À vista" },
        { value: "financiado", label: "Financiado" },
        { value: "parcelado",  label: "Parcelado direto com a loja" },
      ]},
      { key: "downpayment",   label: "Valor da entrada (R$)", type: "money", hint: "Em caso de financiamento ou parcelamento." },
      { key: "installments",  label: "Nº de parcelas",        type: "number", hint: "Em caso de parcelamento." },
      { key: "warranty_days", label: "Garantia (dias)",       type: "number", defaultValue: 90 },
      { key: "warranty_km",   label: "Garantia (km)",         type: "number", defaultValue: 5000 },
      { key: "city",          label: "Cidade do contrato",    type: "text" },
      { key: "signed_date",   label: "Data",                  type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "recibo_sinal",
    name: "Recibo de Sinal / Entrada",
    description: "Comprovante de pagamento de sinal antes da venda fechar.",
    requiresVehicle: true,
    fields: [
      { key: "buyer_name",   label: "Nome do comprador",  type: "text",  required: true, span: 2 },
      { key: "buyer_cpf",    label: "CPF",                type: "text",  required: true },
      { key: "buyer_phone",  label: "Telefone",           type: "text" },
      { key: "signal_value", label: "Valor do sinal (R$)",type: "money", required: true },
      { key: "sale_price",   label: "Valor total da venda (R$)", type: "money", required: true },
      { key: "payment_form", label: "Forma de pagamento do sinal", type: "select", options: [
        { value: "dinheiro", label: "Dinheiro" },
        { value: "pix",      label: "PIX" },
        { value: "transferencia", label: "Transferência bancária" },
        { value: "cartao",   label: "Cartão" },
        { value: "cheque",   label: "Cheque" },
      ]},
      { key: "city",         label: "Cidade",             type: "text" },
      { key: "signed_date",  label: "Data",               type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "consignacao",
    name: "Contrato de Consignação",
    description: "Cliente deixa o veículo na loja para a loja vender por ele.",
    requiresVehicle: false,
    fields: [
      { key: "owner_name",    label: "Nome do consignante (proprietário)", type: "text", required: true, span: 2 },
      { key: "owner_cpf",     label: "CPF",                                type: "text", required: true },
      { key: "owner_rg",      label: "RG",                                 type: "text" },
      { key: "owner_address", label: "Endereço",                           type: "textarea", required: true, span: 2 },
      { key: "owner_phone",   label: "Telefone",                           type: "text" },
      { key: "vehicle_description", label: "Veículo (marca, modelo, versão, ano)", type: "text", required: true, span: 2 },
      { key: "vehicle_chassi", label: "Chassi", type: "text" },
      { key: "vehicle_plate",  label: "Placa",  type: "text" },
      { key: "vehicle_km",     label: "KM atual",                          type: "number" },
      { key: "min_sale_price", label: "Valor mínimo de venda (R$)",        type: "money", required: true },
      { key: "days_term",      label: "Prazo (dias)",                      type: "number", defaultValue: 60 },
      { key: "commission_pct", label: "Comissão da loja (%)",              type: "number", defaultValue: 8 },
      { key: "owner_pays_prep",label: "Consignante arca com preparação?",  type: "checkbox" },
      { key: "city",           label: "Cidade",                            type: "text" },
      { key: "signed_date",    label: "Data",                              type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "garantia",
    name: "Termo de Garantia",
    description: "Garantia oferecida pela loja após a venda.",
    requiresVehicle: true,
    fields: [
      { key: "buyer_name",     label: "Nome do comprador",  type: "text", required: true, span: 2 },
      { key: "buyer_cpf",      label: "CPF",                type: "text", required: true },
      { key: "warranty_days",  label: "Prazo da garantia (dias)", type: "number", defaultValue: 90 },
      { key: "warranty_km",    label: "Limite de km",       type: "number", defaultValue: 5000 },
      { key: "covered_items",  label: "Itens cobertos",     type: "textarea", span: 2,
        defaultValue: "Motor, câmbio, diferencial e sistema de injeção eletrônica contra defeitos não decorrentes de mau uso." },
      { key: "excluded_items", label: "Itens NÃO cobertos", type: "textarea", span: 2,
        defaultValue: "Itens de desgaste natural (pastilhas, discos, embreagem, pneus, lâmpadas, fluidos), componentes elétricos secundários, sistema de som, ar-condicionado por mau uso, qualquer dano por colisão, alagamento ou modificação não autorizada." },
      { key: "city",           label: "Cidade",             type: "text" },
      { key: "signed_date",    label: "Data",               type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "os_preparacao",
    name: "OS Interna de Preparação",
    description: "Lista de serviços para deixar o veículo pronto para a vitrine. Uso interno.",
    requiresVehicle: true,
    fields: [
      { key: "responsible",   label: "Responsável interno",            type: "text" },
      { key: "estimated_date",label: "Previsão de conclusão",          type: "date" },
      { key: "services",      label: "Serviços a executar",            type: "textarea", required: true, span: 2,
        placeholder: "Um por linha: descrição + custo. Ex.:\nTroca de óleo e filtros — R$ 480\nPolimento técnico — R$ 320\nReparo no para-choque traseiro — R$ 850" },
      { key: "notes",         label: "Observações",                    type: "textarea", span: 2 },
      { key: "signed_date",   label: "Data de abertura",               type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "test_drive",
    name: "Termo de Test Drive",
    description: "Condutor assume responsabilidade durante a experimentação do veículo.",
    requiresVehicle: true,
    fields: [
      { key: "driver_name",      label: "Nome do condutor",     type: "text", required: true, span: 2 },
      { key: "driver_cpf",       label: "CPF",                  type: "text", required: true },
      { key: "driver_cnh",       label: "CNH",                  type: "text", required: true },
      { key: "driver_phone",     label: "Telefone",             type: "text" },
      { key: "duration_minutes", label: "Duração prevista (min)", type: "number", defaultValue: 30 },
      { key: "city",             label: "Cidade",               type: "text" },
      { key: "signed_date",      label: "Data",                 type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "procuracao_transferencia",
    name: "Procuração para Transferência",
    description: "Cliente autoriza a revenda a fazer a transferência no Detran em seu nome.",
    requiresVehicle: true,
    fields: [
      { key: "grantor_name",    label: "Nome do outorgante (cliente)", type: "text", required: true, span: 2 },
      { key: "grantor_cpf",     label: "CPF",                          type: "text", required: true },
      { key: "grantor_rg",      label: "RG / Órgão expedidor",         type: "text" },
      { key: "grantor_nationality", label: "Nacionalidade",            type: "text", defaultValue: "brasileiro(a)" },
      { key: "grantor_marital", label: "Estado civil",                 type: "text" },
      { key: "grantor_profession", label: "Profissão",                 type: "text" },
      { key: "grantor_address", label: "Endereço completo",            type: "textarea", required: true, span: 2 },
      { key: "city",            label: "Cidade da assinatura",         type: "text" },
      { key: "signed_date",     label: "Data",                         type: "date" },
    ],
  },
  // ---------------------------------------------------------------------------
  {
    id: "checklist_entrada",
    name: "Checklist de Entrada do Veículo",
    description: "Estado do veículo na chegada à loja — base para laudo interno.",
    requiresVehicle: true,
    fields: [
      { key: "entry_km",       label: "KM de entrada",   type: "number", required: true },
      { key: "fuel_level",     label: "Nível de combustível", type: "select", options: [
        { value: "reserva", label: "Na reserva" },
        { value: "1_4",     label: "1/4" },
        { value: "1_2",     label: "1/2" },
        { value: "3_4",     label: "3/4" },
        { value: "cheio",   label: "Tanque cheio" },
      ]},
      { key: "keys_count",     label: "Chaves recebidas", type: "number", defaultValue: 1 },
      { key: "has_manual",     label: "Manual do proprietário?", type: "checkbox" },
      { key: "has_crlv",       label: "CRLV em mãos?",            type: "checkbox" },
      { key: "tires",          label: "Estado dos pneus",         type: "textarea", span: 2 },
      { key: "bodywork",       label: "Lataria (riscos, amassados, retoques)", type: "textarea", span: 2 },
      { key: "interior",       label: "Interior (rasgos, manchas, desgaste)", type: "textarea", span: 2 },
      { key: "electronics",    label: "Eletrônica (rádio, ar, vidros, travas, painel)", type: "textarea", span: 2 },
      { key: "notes",          label: "Observações gerais",       type: "textarea", span: 2 },
      { key: "inspector",      label: "Avaliado por",             type: "text" },
      { key: "signed_date",    label: "Data",                     type: "date" },
    ],
  },
];

export const TEMPLATES_BY_ID: Record<TemplateId, TemplateConfig> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
) as Record<TemplateId, TemplateConfig>;

export function getTemplate(id: string): TemplateConfig | null {
  return TEMPLATES_BY_ID[id as TemplateId] ?? null;
}
