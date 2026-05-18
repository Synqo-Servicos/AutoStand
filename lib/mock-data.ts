const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const PHOTOS = {
  hb20_red:      U("1571561944842-542037875b50"),
  polo_teal:     U("1541899481282-d53bffe3c35d"),
  bmw_blue:      U("1502877338535-766e1452684a"),
  suv_white:     U("1533473359331-0135ef1b58bf"),
  audi_gray:     U("1606152421802-db97b9c7a11b"),
  porsche_black: U("1503376780353-7e6692767b70"),
  mustang_black: U("1611016186353-9af58c69a533"),
  camaro_white:  U("1492144534655-ae79c964c9d7"),
  hilux_pickup:  U("1559416523-140ddc3d238c"),
};

export interface VehicleSeed {
  brand: string; model: string; version?: string;
  year: number; year_manufacture?: number; km: number;
  cost_price: number; sale_price: number; transmission: string;
  fuel: string; color: string; doors: number;
  body_type?: string; condition?: string; optionals?: string[];
  armored?: boolean; single_owner?: boolean; fipe_code?: string;
  description: string; status: string; photos: string[];
}

export interface TransactionSeed {
  vehicle_idx: number; type: "entrada" | "saida";
  amount: number; date: string;
  buyer_name?: string; buyer_phone?: string; notes?: string;
}

export const MOCK_VEHICLES: VehicleSeed[] = [
  {
    brand: "Hyundai", model: "HB20S", version: "1.0 Turbo Premium",
    year: 2022, year_manufacture: 2021, km: 32_500,
    cost_price: 5_800_000, sale_price: 7_290_000,
    transmission: "manual", fuel: "flex", color: "Vermelho", doors: 4,
    body_type: "sedan", condition: "seminovo", single_owner: true,
    optionals: ["Multimídia", "Câmera de ré", "Sensores de estacionamento", "Ar-condicionado digital"],
    description: "Único dono, revisões em dia, chave reserva. Completo: multimídia, câmera de ré, sensor de estacionamento, ar digital.",
    status: "disponivel", photos: [PHOTOS.hb20_red, PHOTOS.polo_teal],
  },
  {
    brand: "Volkswagen", model: "Polo", version: "1.0 200 TSI Highline",
    year: 2023, year_manufacture: 2022, km: 14_200,
    cost_price: 8_100_000, sale_price: 9_990_000,
    transmission: "automatico", fuel: "flex", color: "Azul", doors: 4,
    body_type: "hatch", condition: "seminovo",
    optionals: ["Bancos de couro", "Apple CarPlay", "Android Auto", "Piloto automático"],
    description: "Praticamente zero, ainda na garantia de fábrica. Motor turbo 1.0, bancos de couro, Apple CarPlay, Android Auto.",
    status: "disponivel", photos: [PHOTOS.polo_teal, PHOTOS.bmw_blue],
  },
  {
    brand: "Jeep", model: "Compass", version: "2.0 Limited 4x2 Flex",
    year: 2022, year_manufacture: 2022, km: 28_000,
    cost_price: 11_500_000, sale_price: 14_190_000,
    transmission: "automatico", fuel: "flex", color: "Branco", doors: 4,
    body_type: "suv", condition: "seminovo",
    optionals: ["Teto solar", "Bancos de couro", "Multimídia 8.4\"", "Câmera 360°", "Rodas de liga 18\""],
    description: "Full top de linha. Teto solar, couro, multimídia 8.4\", câmera 360°, Jeep Shield, rodas 18\".",
    status: "disponivel", photos: [PHOTOS.suv_white, PHOTOS.mustang_black],
  },
  {
    brand: "Toyota", model: "Corolla", version: "2.0 XEI",
    year: 2021, year_manufacture: 2020, km: 55_000,
    cost_price: 8_800_000, sale_price: 10_890_000,
    transmission: "automatico", fuel: "flex", color: "Prata", doors: 4,
    body_type: "sedan", condition: "seminovo", single_owner: true,
    optionals: ["Toyota Safety Sense", "Multimídia 9\"", "Câmera de ré"],
    description: "Prata metálico. Toyota Safety Sense, multimídia 9\", câmera de ré. Histórico de revisões completo na concessionária.",
    status: "disponivel", photos: [PHOTOS.audi_gray, PHOTOS.porsche_black],
  },
  {
    brand: "Honda", model: "Civic", version: "1.5 Turbo EXL",
    year: 2022, year_manufacture: 2021, km: 22_800,
    cost_price: 9_600_000, sale_price: 11_990_000,
    transmission: "automatico", fuel: "gasolina", color: "Preto", doors: 4,
    body_type: "sedan", condition: "seminovo",
    optionals: ["Teto solar", "Couro bicolor", "Multimídia 7\"", "Câmbio CVT"],
    description: "Motor 1.5 turbo 173 cv, câmbio CVT, teto solar, couro bicolor, multimídia 7\". Em excelente estado.",
    status: "reservado", photos: [PHOTOS.porsche_black, PHOTOS.mustang_black],
  },
  {
    brand: "Chevrolet", model: "Onix Plus", version: "1.0 Turbo Premier",
    year: 2022, year_manufacture: 2022, km: 18_400,
    cost_price: 6_800_000, sale_price: 8_490_000,
    transmission: "automatico", fuel: "flex", color: "Branco", doors: 4,
    body_type: "sedan", condition: "seminovo", single_owner: true,
    optionals: ["Multimídia MyLink 8\"", "Câmera de ré", "Controle de cruzeiro adaptativo", "Alerta de ponto cego"],
    description: "Onix Plus Premier automático. Multimídia Mylink 8\", câmera de ré, controle de cruzeiro adaptativo, sensor de ponto cego.",
    status: "disponivel", photos: [PHOTOS.bmw_blue, PHOTOS.audi_gray],
  },
  {
    brand: "Volkswagen", model: "T-Cross", version: "1.0 200 TSI Comfortline",
    year: 2021, year_manufacture: 2020, km: 61_000,
    cost_price: 8_400_000, sale_price: 10_400_000,
    transmission: "automatico", fuel: "flex", color: "Cinza", doors: 4,
    body_type: "suv", condition: "seminovo",
    optionals: ["Multimídia 9.2\"", "Câmera de ré", "Câmbio automático 6 marchas"],
    description: "Vendido. Cinza Platinum. Motor turbo 1.0, câmbio automático 6 vel., multimídia 9.2\", câmera de ré.",
    status: "vendido", photos: [PHOTOS.suv_white, PHOTOS.camaro_white],
  },
  {
    brand: "Toyota", model: "Hilux", version: "2.8 SR 4x4 Diesel",
    year: 2020, year_manufacture: 2020, km: 78_500,
    cost_price: 17_500_000, sale_price: 21_500_000,
    transmission: "automatico", fuel: "diesel", color: "Prata", doors: 4,
    body_type: "picape", condition: "seminovo",
    optionals: ["Cabine dupla", "Tração 4x4", "Rodas de liga 17\"", "Controle de tração", "Câmera de ré"],
    description: "Vendida. Hilux SR 2.8 diesel 177 cv. Cabine dupla, 4x4. Rodas 17\", controle de tração, câmera de ré.",
    status: "vendido", photos: [PHOTOS.hilux_pickup, PHOTOS.suv_white],
  },
];

export const MOCK_TRANSACTIONS: TransactionSeed[] = [
  { vehicle_idx: 0, type: "entrada", amount: 5_800_000, date: "2024-11-10", notes: "Comprado de particular" },
  { vehicle_idx: 1, type: "entrada", amount: 8_100_000, date: "2025-01-20", notes: "Comprado na troca" },
  { vehicle_idx: 2, type: "entrada", amount: 11_500_000, date: "2024-12-05", notes: "Comprado de particular, IPVA pago" },
  { vehicle_idx: 3, type: "entrada", amount: 8_800_000, date: "2024-10-18", notes: "Comprado na troca" },
  { vehicle_idx: 4, type: "entrada", amount: 9_600_000, date: "2025-02-03", notes: "Comprado de particular" },
  { vehicle_idx: 5, type: "entrada", amount: 6_800_000, date: "2025-01-08", notes: "Comprado de particular" },
  { vehicle_idx: 6, type: "entrada", amount: 8_400_000, date: "2024-09-15", notes: "Comprado de concessionária" },
  {
    vehicle_idx: 6, type: "saida", amount: 10_400_000, date: "2025-02-28",
    buyer_name: "Marcos Vinícius Santos", buyer_phone: "82981234567",
    notes: "Financiado pela Caixa. Transferência concluída.",
  },
  { vehicle_idx: 7, type: "entrada", amount: 17_500_000, date: "2024-08-20", notes: "Comprado de empresa, nota fiscal" },
  {
    vehicle_idx: 7, type: "saida", amount: 21_500_000, date: "2025-03-15",
    buyer_name: "Rafael Oliveira", buyer_phone: "82998765432",
    notes: "Pagamento à vista. Transferência feita no dia.",
  },
];
