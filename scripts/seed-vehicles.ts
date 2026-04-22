import { createDb } from "../lib/db";

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

// Verified Unsplash photo IDs
const PHOTOS = {
  hb20_red:      U("1550355291-bbee04a92027"), // Hyundai hatch vermelho
  polo_teal:     U("1541899481282-d53bffe3c35d"), // VW Polo teal hatch
  bmw_blue:      U("1502877338535-766e1452684a"), // BMW coupe azul
  suv_white:     U("1533473359331-0135ef1b58bf"), // Large white SUV
  audi_gray:     U("1606152421802-db97b9c7a11b"), // Audi RS7 cinza/prata
  porsche_black: U("1503376780353-7e6692767b70"), // Porsche Panamera preto
  mustang_black: U("1611016186353-9af58c69a533"), // Ford Mustang preto
  camaro_white:  U("1492144534655-ae79c964c9d7"), // Camaro branco em garagem
};

interface VehicleData {
  brand: string;
  model: string;
  year: number;
  km: number;
  cost_price: number;
  sale_price: number;
  transmission: string;
  fuel: string;
  color: string;
  doors: number;
  description: string;
  status: string;
  photos: string[];
}

const VEHICLES: VehicleData[] = [
  {
    brand: "Hyundai",
    model: "HB20 S Premium",
    year: 2022,
    km: 32_500,
    cost_price: 5_800_000,
    sale_price: 7_290_000,
    transmission: "manual",
    fuel: "flex",
    color: "Vermelho",
    doors: 4,
    description: "Único dono, revisões em dia, chave reserva. Completo: multimídia, câmera de ré, sensor de estacionamento, ar digital.",
    status: "disponivel",
    photos: [PHOTOS.hb20_red, PHOTOS.polo_teal],
  },
  {
    brand: "Volkswagen",
    model: "Polo Highline 200 TSI",
    year: 2023,
    km: 14_200,
    cost_price: 8_100_000,
    sale_price: 9_990_000,
    transmission: "automatico",
    fuel: "flex",
    color: "Azul",
    doors: 4,
    description: "Praticamente zero, ainda na garantia de fábrica. Motor turbo 1.0, bancos de couro, Apple CarPlay, Android Auto.",
    status: "disponivel",
    photos: [PHOTOS.bmw_blue, PHOTOS.polo_teal],
  },
  {
    brand: "Jeep",
    model: "Compass Limited 4x2",
    year: 2022,
    km: 28_000,
    cost_price: 11_500_000,
    sale_price: 14_190_000,
    transmission: "automatico",
    fuel: "flex",
    color: "Branco",
    doors: 4,
    description: "Full top de linha. Teto solar, couro, multimídia 8.4\", câmera 360°, Jeep Shield, rodas 18\".",
    status: "disponivel",
    photos: [PHOTOS.suv_white, PHOTOS.camaro_white],
  },
  {
    brand: "Toyota",
    model: "Corolla XEI 2.0",
    year: 2021,
    km: 55_000,
    cost_price: 8_800_000,
    sale_price: 10_890_000,
    transmission: "automatico",
    fuel: "flex",
    color: "Prata",
    doors: 4,
    description: "Prata metálico. Toyota Safety Sense, multimídia 9\", câmera de ré. Histórico de revisões completo na concessionária.",
    status: "disponivel",
    photos: [PHOTOS.audi_gray, PHOTOS.porsche_black],
  },
  {
    brand: "Honda",
    model: "Civic EXL 1.5 Turbo",
    year: 2022,
    km: 22_800,
    cost_price: 9_600_000,
    sale_price: 11_990_000,
    transmission: "automatico",
    fuel: "gasolina",
    color: "Preto",
    doors: 4,
    description: "Motor 1.5 turbo 173 cv, câmbio CVT, teto solar, couro bicolor, multimídia 7\". Em excelente estado.",
    status: "reservado",
    photos: [PHOTOS.porsche_black, PHOTOS.mustang_black],
  },
  {
    brand: "Chevrolet",
    model: "Onix Plus Premier 1.0T",
    year: 2022,
    km: 18_400,
    cost_price: 6_800_000,
    sale_price: 8_490_000,
    transmission: "automatico",
    fuel: "flex",
    color: "Branco",
    doors: 4,
    description: "Onix Plus Premier automático. Multimídia Mylink 8\", câmera de ré, controle de cruzeiro adaptativo, sensor de ponto cego.",
    status: "disponivel",
    photos: [PHOTOS.polo_teal, PHOTOS.hb20_red],
  },
  // Vendidos — terão transações de entrada e saída
  {
    brand: "Volkswagen",
    model: "T-Cross Comfortline 200 TSI",
    year: 2021,
    km: 61_000,
    cost_price: 8_400_000,
    sale_price: 10_400_000,
    transmission: "automatico",
    fuel: "flex",
    color: "Cinza",
    doors: 4,
    description: "Vendido. Cinza Platinum. Motor turbo 1.0, câmbio automático 6 vel., multimídia 9.2\", câmera de ré.",
    status: "vendido",
    photos: [PHOTOS.mustang_black, PHOTOS.audi_gray],
  },
  {
    brand: "Toyota",
    model: "Hilux SR 4x4 Diesel",
    year: 2020,
    km: 78_500,
    cost_price: 17_500_000,
    sale_price: 21_500_000,
    transmission: "automatico",
    fuel: "diesel",
    color: "Prata",
    doors: 4,
    description: "Vendida. Hilux SR 2.8 diesel 177 cv. Cabine dupla, 4x4. Rodas 17\", controle de tração, câmera de ré.",
    status: "vendido",
    photos: [PHOTOS.camaro_white, PHOTOS.suv_white],
  },
];

// Transactions for the sold vehicles (indices 6 and 7) + entry records for others
interface TxData {
  vehicle_idx: number;
  type: "entrada" | "saida";
  amount: number;
  date: string;
  buyer_name?: string;
  buyer_phone?: string;
  notes?: string;
}

const TRANSACTIONS: TxData[] = [
  // Entrada de todos (compra pelo dono)
  { vehicle_idx: 0, type: "entrada", amount: 5_800_000, date: "2024-11-10", notes: "Comprado de particular" },
  { vehicle_idx: 1, type: "entrada", amount: 8_100_000, date: "2025-01-20", notes: "Comprado na troca" },
  { vehicle_idx: 2, type: "entrada", amount: 11_500_000, date: "2024-12-05", notes: "Comprado de particular, IPVA pago" },
  { vehicle_idx: 3, type: "entrada", amount: 8_800_000, date: "2024-10-18", notes: "Comprado na troca" },
  { vehicle_idx: 4, type: "entrada", amount: 9_600_000, date: "2025-02-03", notes: "Comprado de particular" },
  { vehicle_idx: 5, type: "entrada", amount: 6_800_000, date: "2025-01-08", notes: "Comprado de particular" },
  // T-Cross — entrada e saída
  { vehicle_idx: 6, type: "entrada", amount: 8_400_000, date: "2024-09-15", notes: "Comprado de concessionária" },
  {
    vehicle_idx: 6, type: "saida", amount: 10_400_000, date: "2025-02-28",
    buyer_name: "Marcos Vinícius Santos", buyer_phone: "82981234567",
    notes: "Financiado pela Caixa. Transferência concluída.",
  },
  // Hilux — entrada e saída
  { vehicle_idx: 7, type: "entrada", amount: 17_500_000, date: "2024-08-20", notes: "Comprado de empresa, nota fiscal" },
  {
    vehicle_idx: 7, type: "saida", amount: 21_500_000, date: "2025-03-15",
    buyer_name: "Rafael Oliveira", buyer_phone: "82998765432",
    notes: "Pagamento à vista. Transferência feita no dia.",
  },
];

async function main() {
  const db = createDb();

  // Clear existing vehicle data (keep users)
  db.prepare("DELETE FROM transactions").run();
  db.prepare("DELETE FROM vehicle_photos").run();
  db.prepare("DELETE FROM vehicles").run();
  console.log("Tabelas limpas.");

  const vehicleIds: number[] = [];

  for (const v of VEHICLES) {
    const result = db.prepare(`
      INSERT INTO vehicles
        (brand, model, year, km, cost_price, sale_price, transmission, fuel,
         color, doors, description, status, primary_photo_url)
      VALUES
        (@brand, @model, @year, @km, @cost_price, @sale_price, @transmission, @fuel,
         @color, @doors, @description, @status, @primary_photo_url)
    `).run({
      brand: v.brand,
      model: v.model,
      year: v.year,
      km: v.km,
      cost_price: v.cost_price,
      sale_price: v.sale_price,
      transmission: v.transmission,
      fuel: v.fuel,
      color: v.color,
      doors: v.doors,
      description: v.description,
      status: v.status,
      primary_photo_url: v.photos[0] ?? null,
    });

    const vehicleId = Number(result.lastInsertRowid);
    vehicleIds.push(vehicleId);

    for (let i = 0; i < v.photos.length; i++) {
      db.prepare("INSERT INTO vehicle_photos (vehicle_id, url, order_idx) VALUES (?, ?, ?)").run(vehicleId, v.photos[i], i);
    }

    console.log(`✓ ${v.brand} ${v.model} ${v.year} [${v.status}]`);
  }

  for (const tx of TRANSACTIONS) {
    const vehicleId = vehicleIds[tx.vehicle_idx];
    db.prepare(`
      INSERT INTO transactions (vehicle_id, type, amount, date, buyer_name, buyer_phone, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(vehicleId, tx.type, tx.amount, tx.date, tx.buyer_name ?? null, tx.buyer_phone ?? null, tx.notes ?? null);

    console.log(`  → tx ${tx.type} ${tx.date} R$${(tx.amount / 100).toLocaleString("pt-BR")}`);
  }

  console.log("\n✅ Seed concluído!");
  console.log(`   ${VEHICLES.length} veículos · ${TRANSACTIONS.length} transações`);
}

main().catch(console.error);
