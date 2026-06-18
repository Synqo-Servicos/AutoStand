/**
 * Enriquece a loja AutoPrime com exemplos de TODAS as operações do painel:
 * veículos + compras (entrada), vendas (saída) com comissão automática,
 * vendedores (ativos e desligado), despesas diretas e operacionais e leads
 * em todos os status. Pensado pro ambiente de homologação.
 *
 * É IDEMPOTENTE: apaga vehicles/photos/docs/transactions/leads/sellers DA
 * AUTOPRIME e reconstrói do zero. Os outros tenants não são tocados.
 *
 * NUNCA roda contra um banco que pareça produção (nome contém "prod").
 *
 * Uso:
 *   DATABASE_URL="postgres://user:pass@host:5432/autostand_homolog" \
 *     npx tsx scripts/enrich-autoprime.ts
 */
import { eq } from "drizzle-orm";
import {
  client,
  createLead,
  createSeller,
  createTransaction,
  db,
  getFinanceiroResumo,
  getTenantBySlug,
} from "@/lib/db";
import {
  leads,
  sellers,
  transactions,
  vehicle_documents,
  vehicle_photos,
  vehicles,
} from "@/lib/schema";
import { DEALERSHIPS, type VehicleSeed } from "./mock-data";

const SLUG = "autoprime";

// Fotos Unsplash (mesmos IDs do pool de mock-data.ts).
const U = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;
const PH = {
  suv_white: U("1533473359331-0135ef1b58bf"),
  suv_silver: U("1606152421802-db97b9c7a11b"),
  suv_dark: U("1605618826115-fb9e0c6e2af2"),
  sedan_white: U("1605559424843-9e4c228bf1c2"),
  sedan_silver: U("1606664515524-ed2f786a0bd6"),
  pickup_white: U("1583121274602-3e2820c69888"),
};

/** Veículos extras (além dos 8 base do mock) para dar volume à frota. */
const EXTRA_VEHICLES: VehicleSeed[] = [
  {
    brand: "Chevrolet", model: "Tracker", version: "1.2 Turbo Premier",
    year: 2023, year_manufacture: 2022, km: 19_800,
    cost_price: 10_900_000, sale_price: 12_990_000,
    transmission: "automatico", fuel: "flex", color: "Branco", doors: 4,
    body_type: "suv", condition: "seminovo", single_owner: true,
    optionals: ["Multimídia 8\"", "Wireless Apple CarPlay", "Câmera de ré", "Bancos de couro"],
    description: "Tracker Premier turbo, único dono, baixa KM. Multimídia, couro, câmera de ré.",
    status: "disponivel", photos: [PH.suv_white, PH.suv_silver],
  },
  {
    brand: "Volkswagen", model: "T-Cross", version: "1.4 250 TSI Highline",
    year: 2022, year_manufacture: 2022, km: 33_100,
    cost_price: 11_400_000, sale_price: 13_590_000,
    transmission: "automatico", fuel: "flex", color: "Cinza", doors: 4,
    body_type: "suv", condition: "seminovo",
    optionals: ["VW Play", "Park Assist", "Bancos de couro", "Painel digital"],
    description: "T-Cross Highline 150 cv. VW Play, Park Assist, couro, painel digital. Revisões VW.",
    status: "disponivel", photos: [PH.suv_dark, PH.suv_silver],
  },
  {
    brand: "Toyota", model: "Hilux", version: "2.8 SRX 4x4 Diesel",
    year: 2022, year_manufacture: 2021, km: 52_400,
    cost_price: 24_500_000, sale_price: 28_990_000,
    transmission: "automatico", fuel: "diesel", color: "Branco", doors: 4,
    body_type: "picape", condition: "seminovo",
    optionals: ["4x4 com reduzida", "Couro", "Multimídia 8\"", "Capota marítima", "Santo Antônio"],
    description: "Hilux SRX 4x4 diesel 204 cv. Top de linha, couro, multimídia, capota marítima. Revisões Toyota.",
    status: "disponivel", photos: [PH.pickup_white],
  },
  {
    brand: "Nissan", model: "Kicks", version: "1.6 Exclusive CVT",
    year: 2022, year_manufacture: 2022, km: 29_600,
    cost_price: 9_800_000, sale_price: 11_690_000,
    transmission: "cvt", fuel: "flex", color: "Prata", doors: 4,
    body_type: "suv", condition: "seminovo", single_owner: true,
    optionals: ["Bose Personal", "Câmera 360°", "Teto duas cores", "Multimídia 8\""],
    description: "Kicks Exclusive top, único dono. Bose, câmera 360°, teto duas cores. IPVA 2026 pago.",
    status: "disponivel", photos: [PH.suv_silver, PH.suv_white],
  },
  {
    brand: "Honda", model: "HR-V", version: "1.5 Turbo Touring",
    year: 2023, year_manufacture: 2022, km: 21_300,
    cost_price: 14_200_000, sale_price: 16_490_000,
    transmission: "cvt", fuel: "gasolina", color: "Cinza", doors: 4,
    body_type: "suv", condition: "seminovo", single_owner: true,
    optionals: ["Honda Sensing", "Teto solar", "Couro", "Multimídia 9\"", "Painel digital"],
    description: "HR-V Touring turbo 177 cv. Honda Sensing, teto solar, couro, painel digital. Garantia de fábrica.",
    status: "disponivel", photos: [PH.suv_dark, PH.suv_white],
  },
  {
    brand: "Jeep", model: "Renegade", version: "1.3 T270 Longitude",
    year: 2022, year_manufacture: 2021, km: 44_700,
    cost_price: 9_300_000, sale_price: 11_290_000,
    transmission: "automatico", fuel: "flex", color: "Cinza", doors: 4,
    body_type: "suv", condition: "seminovo",
    optionals: ["Multimídia 8,4\"", "Câmera de ré", "Faróis full LED", "Bancos de couro"],
    description: "Renegade Longitude turbo. Multimídia 8,4\", câmera, LED, couro. Revisões na concessionária.",
    status: "disponivel", photos: [PH.suv_silver, PH.suv_dark],
  },
];

type SellerInput = Parameters<typeof createSeller>[1];

/** Vendedores — modelos de comissão variados + um desligado. */
const SELLERS: SellerInput[] = [
  { name: "Carlos Mendes", phone: "5511980001111", email: "carlos@autoprime.com", document: "32145698700", photo_url: null, commission_pct: 300, commission_fixed_cents: 0, status: "ativo" },
  { name: "Ana Paula Silva", phone: "5511980002222", email: "ana@autoprime.com", document: "45698712300", photo_url: null, commission_pct: 200, commission_fixed_cents: 50_000, status: "ativo" },
  { name: "Roberto Lima", phone: "5511980003333", email: "roberto@autoprime.com", document: "78912345600", photo_url: null, commission_pct: 0, commission_fixed_cents: 150_000, status: "ativo" },
  { name: "Juliana Costa", phone: "5511980004444", email: "juliana@autoprime.com", document: "15975346800", photo_url: null, commission_pct: 250, commission_fixed_cents: 0, status: "desligado" },
];

/** Vendas: índice do veículo (na frota completa), vendedor (índice em SELLERS), comprador e data. */
const SALES: { vi: number; seller: number; date: string; buyer_name: string; buyer_phone: string }[] = [
  { vi: 2, seller: 0, date: "2026-02-14", buyer_name: "Marina Albuquerque", buyer_phone: "5511970001234" }, // Corolla
  { vi: 4, seller: 1, date: "2026-03-08", buyer_name: "Eduardo Tavares", buyer_phone: "5511970002345" }, // Creta
  { vi: 5, seller: 2, date: "2026-03-26", buyer_name: "Ricardo Fontes", buyer_phone: "5511970009876" }, // BMW 320i
  { vi: 8, seller: 0, date: "2026-04-04", buyer_name: "Patrícia Nogueira", buyer_phone: "5511970003456" }, // Tracker
  { vi: 10, seller: 1, date: "2026-04-22", buyer_name: "Fernando Quintela", buyer_phone: "5511970004567" }, // Hilux
  { vi: 6, seller: 2, date: "2026-05-15", buyer_name: "Larissa Monteiro", buyer_phone: "5511970008765" }, // Audi Q3
  { vi: 11, seller: 0, date: "2026-06-05", buyer_name: "Camila Rezende", buyer_phone: "5511970005678" }, // Kicks
];

const RESERVED_VI = 1; // Honda Civic fica reservado

/** Datas de compra (entrada) por veículo — alguns meses antes da venda. */
const PURCHASE_DATES = [
  "2025-11-05", "2025-12-02", "2025-12-18", "2026-01-09", "2026-01-22",
  "2025-10-14", "2025-11-28", "2025-12-11", "2026-01-15", "2026-02-03",
  "2026-02-20", "2026-03-05", "2026-03-21", "2026-04-08",
];

function assertNotProd(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("✗ DATABASE_URL não definido.");
    process.exit(1);
  }
  const dbName = url.split("/").pop()?.split("?")[0] ?? "";
  if (/prod/i.test(dbName)) {
    console.error(`✗ Recusando rodar: o banco "${dbName}" parece ser de produção.`);
    process.exit(1);
  }
  return dbName || "(desconhecido)";
}

async function main() {
  const dbName = assertNotProd();
  console.log(`→ Banco alvo: ${dbName}`);

  const tenant = await getTenantBySlug(SLUG);
  if (!tenant) {
    console.error(`✗ Tenant "${SLUG}" não encontrado nesse banco.`);
    process.exit(1);
  }
  const tid = tenant.id;
  console.log(`→ AutoPrime encontrada (tenant_id=${tid})`);

  // 1) Limpa os dados transacionais da AutoPrime (idempotência).
  await db.delete(transactions).where(eq(transactions.tenant_id, tid));
  await db.delete(leads).where(eq(leads.tenant_id, tid));
  await db.delete(sellers).where(eq(sellers.tenant_id, tid));
  await db.delete(vehicle_documents).where(eq(vehicle_documents.tenant_id, tid));
  await db.delete(vehicle_photos).where(eq(vehicle_photos.tenant_id, tid));
  await db.delete(vehicles).where(eq(vehicles.tenant_id, tid));
  console.log("· dados anteriores da AutoPrime removidos");

  // 2) Frota: 8 base do mock + extras.
  const fleet: VehicleSeed[] = [...DEALERSHIPS.autoprime.vehicles, ...EXTRA_VEHICLES];
  const vehicleIds: number[] = [];
  for (const v of fleet) {
    const [row] = await db
      .insert(vehicles)
      .values({
        tenant_id: tid,
        brand: v.brand,
        model: v.model,
        version: v.version ?? null,
        year: v.year,
        year_manufacture: v.year_manufacture ?? v.year,
        km: v.km,
        cost_price: v.cost_price,
        sale_price: v.sale_price,
        transmission: v.transmission,
        fuel: v.fuel,
        color: v.color,
        doors: v.doors,
        body_type: v.body_type ?? null,
        condition: v.condition ?? "seminovo",
        optionals: v.optionals ?? [],
        armored: v.armored ?? false,
        single_owner: v.single_owner ?? false,
        fipe_code: v.fipe_code ?? null,
        description: v.description,
        status: "disponivel",
        primary_photo_url: v.photos[0] ?? null,
      })
      .returning();
    vehicleIds.push(row.id);
    for (let i = 0; i < v.photos.length; i++) {
      await db.insert(vehicle_photos).values({
        tenant_id: tid,
        vehicle_id: row.id,
        url: v.photos[i],
        order_idx: i,
      });
    }
  }
  console.log(`· ${vehicleIds.length} veículos inseridos`);

  // 3) Vendedores.
  const sellerIds: number[] = [];
  for (const s of SELLERS) {
    const created = await createSeller(tid, s);
    sellerIds.push(created.id);
  }
  console.log(`· ${sellerIds.length} vendedores criados`);

  // 4) Compras (entrada) — uma por veículo, ao custo.
  for (let i = 0; i < fleet.length; i++) {
    await db.insert(transactions).values({
      tenant_id: tid,
      vehicle_id: vehicleIds[i],
      type: "entrada",
      amount: fleet[i].cost_price,
      date: PURCHASE_DATES[i] ?? "2026-01-10",
      notes: "Aquisição de estoque",
    });
  }
  console.log(`· ${fleet.length} compras (entrada) registradas`);

  // 5) Vendas (saída) — via createTransaction: marca o veículo como vendido
  //    e cria a comissão do vendedor automaticamente.
  for (const sale of SALES) {
    const amount = Math.round(fleet[sale.vi].sale_price * 0.99); // leve negociação
    await createTransaction(tid, {
      vehicle_id: vehicleIds[sale.vi],
      type: "saida",
      amount,
      date: sale.date,
      category: null,
      seller_id: sellerIds[sale.seller],
      buyer_name: sale.buyer_name,
      buyer_phone: sale.buyer_phone,
      notes: "Venda à vista",
    });
  }
  console.log(`· ${SALES.length} vendas (saída) + comissões automáticas`);

  // 6) Um veículo reservado.
  await db.update(vehicles).set({ status: "reservado" }).where(eq(vehicles.id, vehicleIds[RESERVED_VI]));

  // 7) Despesas diretas (atreladas a veículos).
  const directExpenses: { vi: number; amount: number; date: string; category: string; notes: string }[] = [
    { vi: 0, amount: 35_000, date: "2025-11-12", category: "Polimento", notes: "Polimento e cristalização" },
    { vi: 2, amount: 28_000, date: "2025-12-20", category: "Laudo cautelar", notes: "Laudo cautelar pré-venda" },
    { vi: 5, amount: 180_000, date: "2025-12-15", category: "Reparo mecânico", notes: "Revisão completa + pastilhas" },
    { vi: 8, amount: 65_000, date: "2026-01-15", category: "Despachante", notes: "Transferência e documentação" },
    { vi: 10, amount: 120_000, date: "2026-02-25", category: "NF de peça", notes: "Troca de pneus 4x" },
    { vi: 11, amount: 32_000, date: "2026-02-22", category: "Detran", notes: "Vistoria e licenciamento" },
    { vi: 6, amount: 45_000, date: "2025-12-05", category: "Documentação", notes: "Regularização de multa anterior" },
    { vi: 13, amount: 28_000, date: "2026-04-10", category: "Polimento", notes: "Higienização interna + polimento" },
  ];
  for (const e of directExpenses) {
    await db.insert(transactions).values({
      tenant_id: tid,
      vehicle_id: vehicleIds[e.vi],
      type: "despesa_direta",
      amount: e.amount,
      date: e.date,
      category: e.category,
      notes: e.notes,
    });
  }
  console.log(`· ${directExpenses.length} despesas diretas`);

  // 8) Despesas operacionais (fixas e variáveis) — vários meses.
  const months = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const opExpenses: { type: string; amount: number; date: string; category: string; notes: string }[] = [];
  for (const m of months) {
    opExpenses.push({ type: "despesa_fixa", amount: 600_000, date: `${m}-05`, category: "Aluguel", notes: "Aluguel do pátio" });
    opExpenses.push({ type: "despesa_fixa", amount: 1_100_000, date: `${m}-05`, category: "Salários", notes: "Folha da equipe" });
    opExpenses.push({ type: "despesa_fixa", amount: 110_000, date: `${m}-10`, category: "Energia", notes: "Conta de energia" });
    opExpenses.push({ type: "despesa_fixa", amount: 30_000, date: `${m}-10`, category: "Internet", notes: "Internet/telefonia" });
  }
  opExpenses.push({ type: "despesa_var", amount: 350_000, date: "2026-03-03", category: "Marketing", notes: "Tráfego pago + anúncios" });
  opExpenses.push({ type: "despesa_var", amount: 420_000, date: "2026-05-02", category: "Marketing", notes: "Campanha de Dia das Mães" });
  opExpenses.push({ type: "despesa_var", amount: 60_000, date: "2026-04-14", category: "Combustível", notes: "Test drives e transporte" });
  for (const e of opExpenses) {
    await db.insert(transactions).values({
      tenant_id: tid,
      vehicle_id: null,
      type: e.type,
      amount: e.amount,
      date: e.date,
      category: e.category,
      notes: e.notes,
    });
  }
  console.log(`· ${opExpenses.length} despesas operacionais`);

  // 9) Leads cobrindo todos os status e origens.
  const leadSeeds: {
    name: string; phone: string; email?: string; vi?: number;
    message?: string; source: "site" | "whatsapp" | "manual" | "marketplace";
    status: "novo" | "contatado" | "negociando" | "convertido" | "perdido";
  }[] = [
    { name: "Rafael Antunes", phone: "5511960001111", email: "rafael@email.com", vi: 0, message: "Tem interesse no Compass, aceita troca?", source: "site", status: "novo" },
    { name: "Bianca Moraes", phone: "5511960002222", vi: 3, message: "Qual o valor à vista do Taos?", source: "whatsapp", status: "novo" },
    { name: "Otávio Lacerda", phone: "5511960003333", email: "otavio@email.com", vi: 5, message: "Quero agendar test drive da BMW", source: "site", status: "contatado" },
    { name: "Letícia Prado", phone: "5511960004444", vi: 6, message: "Financiamento do Q3 em 48x?", source: "marketplace", status: "contatado" },
    { name: "Diego Saraiva", phone: "5511960005555", email: "diego@email.com", vi: 9, message: "Negociando o HR-V, proposta enviada", source: "whatsapp", status: "negociando" },
    { name: "Marina Albuquerque", phone: "5511970001234", email: "marina@email.com", vi: 2, message: "Fechou o Corolla", source: "site", status: "convertido" },
    { name: "Eduardo Tavares", phone: "5511970002345", vi: 4, message: "Comprou o Creta", source: "manual", status: "convertido" },
    { name: "Sandra Vasconcelos", phone: "5511960006666", vi: 12, message: "Achou caro, desistiu", source: "site", status: "perdido" },
    { name: "Henrique Bastos", phone: "5511960007777", email: "henrique@email.com", message: "Procura SUV até 120k", source: "manual", status: "novo" },
    { name: "Paula Ribeiro", phone: "5511960008888", vi: 7, message: "Sumiu depois da proposta", source: "marketplace", status: "perdido" },
  ];
  for (const l of leadSeeds) {
    await createLead(tid, {
      name: l.name,
      phone: l.phone,
      email: l.email,
      vehicle_id: l.vi != null ? vehicleIds[l.vi] : undefined,
      message: l.message,
      source: l.source,
      status: l.status,
    });
  }
  console.log(`· ${leadSeeds.length} leads`);

  // Resumo financeiro do período (sanity check).
  const resumo = await getFinanceiroResumo(tid);
  const brl = (c: number) => `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  console.log("\n=== Resumo financeiro AutoPrime ===");
  console.log(`  Vendas:        ${resumo.vendasUnits} un.`);
  console.log(`  Receita:       ${brl(resumo.receita)}`);
  console.log(`  Custos:        ${brl(resumo.custos)}`);
  console.log(`  Desp. diretas: ${brl(resumo.despesasDir)}`);
  console.log(`  Desp. operac.: ${brl(resumo.despesasOp)}`);
  console.log(`  Lucro bruto:   ${brl(resumo.lucroBruto)}`);
  console.log(`  Lucro líquido: ${brl(resumo.lucroLiquido)}`);

  await client.end();
  console.log("\n✓ AutoPrime enriquecida.");
}

main().catch(async (err) => {
  console.error(err);
  await client.end().catch(() => {});
  process.exit(1);
});
