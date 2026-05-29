/**
 * Catálogo de demo do AutoStand: 3 concessionárias com frota distinta.
 *
 * - AutoPrime Seminovos (SP, Premium) — vitrine principal, frota top de linha
 * - Garagem 082 (Maceió/AL, Pro) — revenda local de bairro, hatch/sedan populares
 * - Premium Motors (BH, Premium) — boutique de importados
 *
 * Preços calibrados com a Tabela FIPE de mai/2026.
 */

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;

// Pool de fotos do Unsplash por perfil visual.
// REGRA: cada veículo usa apenas fotos do seu perfil — nunca vazar
// porsche_black/bmw_blue/mustang_black em veículos de outra marca.
const P = {
  // Compactos hatch (HB20, Polo, Argo, Kwid, Mini)
  hatch_red:        U("1571561944842-542037875b50"),  // hatch vermelho
  hatch_teal:       U("1541899481282-d53bffe3c35d"),  // hatch verde-água/azul vivo
  hatch_silver:     U("1485291571150-772bcfc10da5"),  // hatch prata neutro
  // Sedans compactos/médios (HB20S, Onix Plus, Corolla, Civic, A3)
  sedan_white:      U("1605559424843-9e4c228bf1c2"),  // sedan branco
  sedan_silver:     U("1606664515524-ed2f786a0bd6"),  // sedan prata
  sedan_dark:       U("1542362567-b07e54358753"),     // sedan cinza escuro
  sedan_black:      U("1556800572-1b8aedf82db0"),     // sedan preto
  // SUVs e crossovers (Compass, T-Cross, Tracker, Creta, Kicks, Taos, Q3, GLA, Evoque, XC40, XC60)
  suv_white:        U("1533473359331-0135ef1b58bf"),  // suv branco
  suv_silver:       U("1606152421802-db97b9c7a11b"),  // suv prata/cinza
  suv_dark:         U("1605618826115-fb9e0c6e2af2"),  // suv escuro/preto
  // Marca-específicos — USAR APENAS para o veículo correto
  bmw_blue:         U("1502877338535-766e1452684a"),  // BMW azul — só BMW 320i e X1
  porsche_black:    U("1503376780353-7e6692767b70"),  // Porsche 911 preto — só Macan
  premium_white:    U("1492144534655-ae79c964c9d7"),  // branco premium genérico (Volvo, Audi)
  // Picapes (Hilux)
  pickup_silver:    U("1559416523-140ddc3d238c"),     // picape prata
  pickup_white:     U("1583121274602-3e2820c69888"),  // picape branco
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

export interface LeadSeed {
  name: string; phone: string; email?: string;
  vehicle_idx: number; message?: string;
  source?: "site" | "whatsapp" | "manual";
  status?: "novo" | "contatado" | "negociando" | "convertido" | "perdido";
}

export interface DealershipSeed {
  vehicles: VehicleSeed[];
  transactions: TransactionSeed[];
  leads: LeadSeed[];
}

// =============================================================================
// AutoPrime Seminovos (São Paulo, SP) — Premium tier
// SUVs médios e sedans premium, mix top de linha. Demo da vitrine "completa".
// =============================================================================
const AUTOPRIME: DealershipSeed = {
  vehicles: [
    {
      brand: "Jeep", model: "Compass", version: "1.3 T270 Limited",
      year: 2022, year_manufacture: 2022, km: 28_400,
      cost_price: 11_500_000, sale_price: 13_990_000,
      transmission: "automatico", fuel: "flex", color: "Branco", doors: 4,
      body_type: "suv", condition: "seminovo", single_owner: true,
      optionals: ["Teto solar", "Bancos de couro", "Multimídia 10,1\"", "Câmera 360°", "Rodas de liga 18\"", "Adaptive Cruise"],
      fipe_code: "017070-4",
      description: "Limited top de linha, único dono, revisões na concessionária. Teto solar, couro, multimídia 10,1\", câmera 360°, ACC. Garantia de fábrica até 11/2026.",
      status: "disponivel", photos: [P.suv_white, P.suv_silver, P.suv_dark],   // Compass branco
    },
    {
      brand: "Honda", model: "Civic", version: "1.5 Turbo EXL",
      year: 2022, year_manufacture: 2021, km: 22_800,
      cost_price: 10_800_000, sale_price: 12_890_000,
      transmission: "automatico", fuel: "gasolina", color: "Preto", doors: 4,
      body_type: "sedan", condition: "seminovo",
      optionals: ["Teto solar elétrico", "Couro bicolor", "Honda Sensing", "Multimídia 7\"", "Câmbio CVT"],
      description: "Civic EXL turbo 173 cv, CVT, teto solar, couro, Honda Sensing completo. Único dono, IPVA 2026 pago.",
      status: "reservado", photos: [P.sedan_black, P.sedan_dark, P.sedan_silver],  // Civic preto
    },
    {
      brand: "Toyota", model: "Corolla", version: "2.0 Altis Premium",
      year: 2022, year_manufacture: 2022, km: 31_500,
      cost_price: 11_200_000, sale_price: 13_490_000,
      transmission: "automatico", fuel: "flex", color: "Prata", doors: 4,
      body_type: "sedan", condition: "seminovo", single_owner: true,
      optionals: ["Toyota Safety Sense 3.0", "Multimídia 9\"", "Câmera de ré", "Bancos de couro", "Wireless charger"],
      description: "Altis Premium full. Toyota Safety Sense 3.0, multimídia 9\", couro, carregador wireless. Revisões em dia na Toyota.",
      status: "disponivel", photos: [P.sedan_silver, P.sedan_white, P.sedan_dark],  // Corolla prata
    },
    {
      brand: "Volkswagen", model: "Taos", version: "1.4 250 TSI Highline",
      year: 2022, year_manufacture: 2021, km: 38_200,
      cost_price: 13_200_000, sale_price: 15_790_000,
      transmission: "automatico", fuel: "flex", color: "Cinza", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["Teto solar panorâmico", "Bancos de couro ventilados", "VW Play", "Park Assist", "ACC", "Beats Audio"],
      description: "Taos Highline 1.4 TSI 150 cv. Teto panorâmico, couro ventilado, VW Play 10\", som Beats, ACC, Park Assist. Revisões VW.",
      status: "disponivel", photos: [P.suv_dark, P.suv_silver, P.suv_white],   // Taos cinza
    },
    {
      brand: "Hyundai", model: "Creta", version: "2.0 Ultimate",
      year: 2022, year_manufacture: 2022, km: 26_700,
      cost_price: 11_800_000, sale_price: 13_990_000,
      transmission: "automatico", fuel: "flex", color: "Branco", doors: 4,
      body_type: "suv", condition: "seminovo", single_owner: true,
      optionals: ["Teto duas cores", "Bose 8 alto-falantes", "Hyundai SmartSense", "Multimídia 10,25\"", "Painel digital"],
      description: "Creta Ultimate full top de linha. Teto duas cores, Bose, SmartSense (ACC + lane keep), painel digital 10,25\". Garantia 2027.",
      status: "disponivel", photos: [P.suv_white, P.suv_dark, P.suv_silver],   // Creta branco
    },
    {
      brand: "BMW", model: "320i", version: "M Sport 2.0 Turbo",
      year: 2021, year_manufacture: 2020, km: 48_900,
      cost_price: 19_500_000, sale_price: 23_490_000,
      transmission: "automatico", fuel: "gasolina", color: "Azul", doors: 4,
      body_type: "sedan", condition: "seminovo",
      optionals: ["Pacote M Sport", "Bancos esportivos couro", "Head-up display", "Harman Kardon", "Faróis Laser", "Teto solar"],
      description: "320i M Sport com pacote completo. 184 cv, head-up display, Harman Kardon, faróis Laser. Revisões BMW, IPVA 2026 pago.",
      status: "disponivel", photos: [P.bmw_blue, P.sedan_dark, P.sedan_silver],  // BMW 320i azul
    },
    {
      brand: "Audi", model: "Q3", version: "1.4 TFSI Black",
      year: 2022, year_manufacture: 2021, km: 41_300,
      cost_price: 17_800_000, sale_price: 20_990_000,
      transmission: "automatico", fuel: "gasolina", color: "Cinza Daytona", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["Pacote Black", "Virtual Cockpit Plus", "Bancos esportivos couro", "Teto panorâmico", "Bang & Olufsen", "Rodas 19\""],
      description: "Q3 Black 150 cv. Pacote Black completo, Virtual Cockpit Plus, teto panorâmico, B&O. Carro de executivo, impecável.",
      status: "disponivel", photos: [P.suv_dark, P.suv_silver, P.premium_white],  // Audi Q3 cinza
    },
    {
      brand: "Volvo", model: "XC40", version: "T5 R-Design AWD",
      year: 2021, year_manufacture: 2020, km: 56_400,
      cost_price: 18_200_000, sale_price: 21_490_000,
      transmission: "automatico", fuel: "gasolina", color: "Preto Onyx", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["R-Design completo", "Bancos couro Nappa", "Harman Kardon Premium Audio", "Pilot Assist", "Teto panorâmico"],
      description: "XC40 R-Design AWD 254 cv. Pilot Assist, Harman Kardon Premium, teto panorâmico. Revisões na Volvo, garantia até 11/2026.",
      status: "disponivel", photos: [P.suv_dark, P.suv_silver, P.premium_white],  // Volvo XC40 preto
    },
  ],
  transactions: [
    { vehicle_idx: 0, type: "entrada", amount: 11_500_000, date: "2026-02-12", notes: "Compra de particular, único dono" },
    { vehicle_idx: 1, type: "entrada", amount: 10_800_000, date: "2026-02-05", notes: "Comprado na troca" },
    { vehicle_idx: 2, type: "entrada", amount: 11_200_000, date: "2026-01-18", notes: "Compra de particular, IPVA pago" },
    { vehicle_idx: 3, type: "entrada", amount: 13_200_000, date: "2026-01-09", notes: "Comprado em leilão executivo" },
    { vehicle_idx: 4, type: "entrada", amount: 11_800_000, date: "2026-02-22", notes: "Comprado de particular" },
    { vehicle_idx: 5, type: "entrada", amount: 19_500_000, date: "2025-12-15", notes: "Carro de executivo" },
    { vehicle_idx: 6, type: "entrada", amount: 17_800_000, date: "2026-01-30", notes: "Comprado de particular, único dono" },
    { vehicle_idx: 7, type: "entrada", amount: 18_200_000, date: "2025-12-28", notes: "Comprado de empresa, nota fiscal" },
  ],
  leads: [
    { name: "Marcelo Tavares", phone: "11987654321", email: "marcelo.tavares@gmail.com",
      vehicle_idx: 0, message: "Aceita meu Renegade 2020 na troca? Tenho FGTS para entrada.",
      source: "site", status: "negociando" },
    { name: "Renata Costa", phone: "11991234567", email: "renatacosta@outlook.com",
      vehicle_idx: 3, message: "Esse Taos tem o pacote Tech? Posso ver hoje à tarde?",
      source: "site", status: "contatado" },
    { name: "Eduardo Lima", phone: "11999998877",
      vehicle_idx: 5, message: "BMW ainda na garantia? Histórico de revisões?",
      source: "whatsapp", status: "novo" },
    { name: "Camila Bezerra", phone: "11988776655", email: "camila.bzr@gmail.com",
      vehicle_idx: 4, message: "Tem desconto à vista? Aceitam meu HB20S 2019?",
      source: "site", status: "novo" },
  ],
};

// =============================================================================
// Garagem 082 (Maceió, AL) — Pro tier
// Revenda de bairro com 10 carros populares (hatch + sedan compacto + SUV entrada).
// Argumento de venda: "loja de bairro, mas com site profissional e domínio próprio".
// =============================================================================
const GARAGEM082: DealershipSeed = {
  vehicles: [
    {
      brand: "Hyundai", model: "HB20S", version: "1.0 Turbo Platinum Plus",
      year: 2022, year_manufacture: 2021, km: 32_500,
      cost_price: 5_800_000, sale_price: 7_390_000,
      transmission: "automatico", fuel: "flex", color: "Vermelho", doors: 4,
      body_type: "sedan", condition: "seminovo", single_owner: true,
      optionals: ["Multimídia 8\"", "Câmera de ré", "Sensores estacionamento", "Ar digital", "Bluelink"],
      fipe_code: "015205-6",
      description: "Único dono, revisões em dia, chave reserva. Completo: multimídia 8\", câmera de ré, sensor de estacionamento, ar digital. IPVA 2026 pago.",
      status: "disponivel", photos: [P.sedan_white, P.sedan_silver, P.hatch_red],  // HB20S vermelho (sedan)
    },
    {
      brand: "Volkswagen", model: "Polo", version: "1.0 200 TSI Highline",
      year: 2023, year_manufacture: 2022, km: 14_200,
      cost_price: 8_100_000, sale_price: 9_790_000,
      transmission: "automatico", fuel: "flex", color: "Azul Biscay", doors: 4,
      body_type: "hatch", condition: "seminovo",
      optionals: ["Bancos de couro", "Apple CarPlay", "Android Auto", "Piloto automático", "VW Play 10\""],
      description: "Praticamente zero, ainda na garantia VW até 2027. Motor turbo 1.0, bancos de couro, VW Play 10\", Apple CarPlay sem fio.",
      status: "disponivel", photos: [P.hatch_teal, P.hatch_silver, P.hatch_red],  // Polo azul Biscay (hatch)
    },
    {
      brand: "Chevrolet", model: "Onix Plus", version: "1.0 Turbo Premier II",
      year: 2022, year_manufacture: 2022, km: 21_400,
      cost_price: 6_400_000, sale_price: 7_990_000,
      transmission: "automatico", fuel: "flex", color: "Branco", doors: 4,
      body_type: "sedan", condition: "seminovo", single_owner: true,
      optionals: ["MyLink 8\" sem fio", "Câmera de ré", "Cruise adaptativo", "Alerta ponto cego", "Wireless charger"],
      description: "Premier II automático. MyLink sem fio, câmera de ré, cruise adaptativo, sensor de ponto cego, carregador wireless. Único dono.",
      status: "disponivel", photos: [P.sedan_white, P.sedan_silver, P.sedan_dark],  // Onix Plus branco (sedan)
    },
    {
      brand: "Volkswagen", model: "T-Cross", version: "1.0 200 TSI Comfortline",
      year: 2022, year_manufacture: 2021, km: 41_000,
      cost_price: 8_200_000, sale_price: 9_990_000,
      transmission: "automatico", fuel: "flex", color: "Cinza Platinum", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["VW Play 9,2\"", "Câmera de ré", "Sensor de chuva", "Ar-condicionado digital"],
      description: "Cinza Platinum. Motor turbo 1.0 128 cv, câmbio automático 6 vel., VW Play 9,2\", câmera de ré. Garantia VW até 09/2026.",
      status: "disponivel", photos: [P.suv_silver, P.suv_white, P.suv_dark],   // T-Cross cinza (suv)
    },
    {
      brand: "Hyundai", model: "HB20", version: "1.0 Vision",
      year: 2022, year_manufacture: 2021, km: 38_900,
      cost_price: 4_800_000, sale_price: 6_290_000,
      transmission: "manual", fuel: "flex", color: "Prata", doors: 4,
      body_type: "hatch", condition: "seminovo",
      optionals: ["Multimídia 8\"", "Câmera de ré", "Ar-condicionado", "Trava elétrica"],
      description: "HB20 Vision manual. Econômico, perfeito para uso urbano e Uber. Multimídia 8\", câmera de ré. IPVA 2026 pago.",
      status: "disponivel", photos: [P.hatch_silver, P.hatch_teal, P.hatch_red],  // HB20 prata (hatch)
    },
    {
      brand: "Fiat", model: "Argo", version: "1.3 Drive",
      year: 2022, year_manufacture: 2021, km: 35_200,
      cost_price: 5_200_000, sale_price: 6_590_000,
      transmission: "automatico", fuel: "flex", color: "Vermelho Marsala", doors: 4,
      body_type: "hatch", condition: "seminovo", single_owner: true,
      optionals: ["Multimídia 7\"", "Câmera de ré", "Ar digital", "Rodas de liga 15\""],
      description: "Argo Drive automático CVT. Vermelho Marsala, único dono, IPVA 2026 pago. Multimídia 7\", câmera de ré, ar digital.",
      status: "disponivel", photos: [P.hatch_red, P.hatch_silver, P.hatch_teal],  // Argo vermelho (hatch)
    },
    {
      brand: "Chevrolet", model: "Tracker", version: "1.0 Turbo Premier",
      year: 2022, year_manufacture: 2022, km: 29_800,
      cost_price: 9_200_000, sale_price: 11_290_000,
      transmission: "automatico", fuel: "flex", color: "Branco Summit", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["MyLink 11\"", "Câmera 360°", "Bose 7 alto-falantes", "Cruise adaptativo", "Painel digital 8\""],
      description: "Tracker Premier full. MyLink 11\", câmera 360°, Bose, cruise adaptativo, painel digital. Garantia GM até 02/2027.",
      status: "disponivel", photos: [P.suv_white, P.suv_silver, P.suv_dark],   // Tracker branco (suv)
    },
    {
      brand: "Renault", model: "Kwid", version: "1.0 Outsider",
      year: 2023, year_manufacture: 2022, km: 18_400,
      cost_price: 4_900_000, sale_price: 6_190_000,
      transmission: "manual", fuel: "flex", color: "Laranja Ocre", doors: 4,
      body_type: "hatch", condition: "seminovo",
      optionals: ["Multimídia 8\" carplay", "Câmera de ré", "Sensor de ré", "Ar-condicionado", "Rodas 14\""],
      description: "Kwid Outsider 2023 quase zero. Laranja Ocre, look aventureiro. Multimídia 8\" com CarPlay, câmera de ré. Excelente custo-benefício.",
      status: "disponivel", photos: [P.hatch_red, P.hatch_silver, P.hatch_teal],  // Kwid laranja (hatch)
    },
    {
      brand: "Fiat", model: "Pulse", version: "1.0 Turbo Drive AT-CVT",
      year: 2023, year_manufacture: 2022, km: 22_100,
      cost_price: 7_400_000, sale_price: 9_190_000,
      transmission: "automatico", fuel: "flex", color: "Branco Banchisa", doors: 4,
      body_type: "suv", condition: "seminovo", single_owner: true,
      optionals: ["Multimídia 8,4\"", "Câmera de ré", "Painel digital 7\"", "Keyless entry", "Ar digital"],
      description: "Pulse Drive turbo 130 cv automático. Painel digital, multimídia 8,4\", keyless entry. Único dono, na garantia Fiat até 04/2027.",
      status: "disponivel", photos: [P.suv_white, P.suv_silver, P.suv_dark],   // Pulse branco (suv/crossover)
    },
    {
      brand: "Nissan", model: "Kicks", version: "1.6 Advance Xtronic",
      year: 2021, year_manufacture: 2021, km: 58_400,
      cost_price: 7_500_000, sale_price: 9_290_000,
      transmission: "automatico", fuel: "flex", color: "Prata Estrela", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["Multimídia 8\"", "Câmera de ré", "Painel digital", "Apple CarPlay", "Sensor ponto cego"],
      description: "Vendido. Kicks Advance Xtronic. Multimídia 8\", câmera de ré, sensor de ponto cego, painel digital. Pneus novos.",
      status: "vendido", photos: [P.suv_silver, P.suv_dark, P.suv_white],   // Kicks prata (suv)
    },
  ],
  transactions: [
    { vehicle_idx: 0, type: "entrada", amount: 5_800_000, date: "2025-11-10", notes: "Comprado de particular" },
    { vehicle_idx: 1, type: "entrada", amount: 8_100_000, date: "2026-01-20", notes: "Comprado na troca de um Polo Track" },
    { vehicle_idx: 2, type: "entrada", amount: 6_400_000, date: "2026-02-03", notes: "Comprado de particular, IPVA pago" },
    { vehicle_idx: 3, type: "entrada", amount: 8_200_000, date: "2025-12-15", notes: "Comprado de concessionária" },
    { vehicle_idx: 4, type: "entrada", amount: 4_800_000, date: "2026-01-28", notes: "Comprado de particular" },
    { vehicle_idx: 5, type: "entrada", amount: 5_200_000, date: "2025-12-22", notes: "Comprado na troca de um Mobi" },
    { vehicle_idx: 6, type: "entrada", amount: 9_200_000, date: "2026-02-18", notes: "Comprado em leilão executivo" },
    { vehicle_idx: 7, type: "entrada", amount: 4_900_000, date: "2026-02-25", notes: "Comprado de particular, único dono" },
    { vehicle_idx: 8, type: "entrada", amount: 7_400_000, date: "2026-01-12", notes: "Comprado de particular" },
    { vehicle_idx: 9, type: "entrada", amount: 7_500_000, date: "2025-10-08", notes: "Comprado de concessionária" },
    {
      vehicle_idx: 9, type: "saida", amount: 9_290_000, date: "2026-03-22",
      buyer_name: "Marcos Vinícius Santos", buyer_phone: "82981234567",
      notes: "Financiado pela Caixa. Transferência concluída.",
    },
  ],
  leads: [
    { name: "Carla Mendes", phone: "82991112233", email: "carla.mendes@email.com",
      vehicle_idx: 0, message: "Tenho interesse neste carro, ele aceita troca?",
      source: "site", status: "novo" },
    { name: "João Pereira", phone: "82994445566",
      vehicle_idx: 2, message: "Qual o valor da entrada e em quantas vezes?",
      source: "site", status: "contatado" },
    { name: "Aline Cavalcante", phone: "82998887766", email: "aline.cav@hotmail.com",
      vehicle_idx: 6, message: "Ainda na garantia? Aceitam Onix LT 2019 na troca?",
      source: "whatsapp", status: "negociando" },
    { name: "Roberto Lins", phone: "82996665544",
      vehicle_idx: 1, message: "É manual ou automático? Tem laudo cautelar?",
      source: "site", status: "novo" },
    { name: "Patrícia Almeida", phone: "82992223344", email: "pat.almeida@gmail.com",
      vehicle_idx: 7, message: "Esse Kwid serve para Uber? Tem placa Mercosul?",
      source: "site", status: "convertido" },
  ],
};

// =============================================================================
// Premium Motors (Belo Horizonte, MG) — Premium tier
// Boutique de importados e esportivos. Demo do tier Premium "high-end" — IA + insights.
// =============================================================================
const PREMIUMMOTORS: DealershipSeed = {
  vehicles: [
    {
      brand: "Porsche", model: "Macan", version: "2.0 Turbo",
      year: 2021, year_manufacture: 2020, km: 38_500,
      cost_price: 39_500_000, sale_price: 44_900_000,
      transmission: "automatico", fuel: "gasolina", color: "Preto Jet", doors: 4,
      body_type: "suv", condition: "seminovo", single_owner: true,
      optionals: ["Pacote Sport Chrono", "Bancos elétricos couro", "BOSE Surround", "Teto panorâmico", "Rodas 20\"", "Faróis LED Matrix"],
      description: "Macan 2.0 252 cv com Sport Chrono. Único dono, manuais e chaves reserva. Teto panorâmico, BOSE, LED Matrix. Garantia estendida até 12/2026.",
      status: "disponivel", photos: [P.porsche_black, P.suv_dark, P.suv_silver],  // Porsche Macan preto
    },
    {
      brand: "BMW", model: "X1", version: "sDrive20i M Sport",
      year: 2022, year_manufacture: 2022, km: 32_800,
      cost_price: 24_500_000, sale_price: 28_490_000,
      transmission: "automatico", fuel: "gasolina", color: "Branco Alpine", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["Pacote M Sport completo", "Head-up display", "Harman Kardon", "Teto panorâmico", "Bancos esportivos", "Rodas 19\" M"],
      description: "X1 sDrive20i M Sport 2.0 turbo 204 cv. Pacote M completo, head-up, Harman Kardon, teto panorâmico. Revisões BMW Eurobike.",
      status: "disponivel", photos: [P.suv_white, P.bmw_blue, P.suv_silver],   // BMW X1 branco
    },
    {
      brand: "Audi", model: "A3 Sedan", version: "2.0 TFSI Performance Black",
      year: 2022, year_manufacture: 2021, km: 36_400,
      cost_price: 18_900_000, sale_price: 22_490_000,
      transmission: "automatico", fuel: "gasolina", color: "Cinza Daytona", doors: 4,
      body_type: "sedan", condition: "seminovo",
      optionals: ["Pacote Black", "Virtual Cockpit Plus", "Bancos esportivos couro Nappa", "Bang & Olufsen 3D", "Faróis Matrix LED", "Rodas 18\""],
      description: "A3 Performance Black 190 cv. Pacote Black completo, Virtual Cockpit Plus, B&O 3D, Matrix LED. Carro de executivo, impecável.",
      status: "disponivel", photos: [P.sedan_dark, P.sedan_black, P.sedan_silver],  // Audi A3 cinza (sedan)
    },
    {
      brand: "Mercedes-Benz", model: "GLA", version: "200 AMG Line",
      year: 2021, year_manufacture: 2020, km: 47_200,
      cost_price: 19_800_000, sale_price: 23_290_000,
      transmission: "automatico", fuel: "gasolina", color: "Preto Cosmos", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["Pacote AMG Line", "MBUX 10,25\"", "Bancos couro Artico", "Teto panorâmico", "Burmester Premium", "Rodas AMG 19\""],
      description: "GLA 200 AMG Line 163 cv. Pacote AMG completo, MBUX 10,25\", Burmester, teto panorâmico. Manutenção Mercedes-Benz Newland.",
      status: "reservado", photos: [P.suv_dark, P.suv_silver, P.suv_white],    // Mercedes GLA preto
    },
    {
      brand: "Land Rover", model: "Range Rover Evoque", version: "2.0 P250 R-Dynamic SE",
      year: 2021, year_manufacture: 2020, km: 52_800,
      cost_price: 28_500_000, sale_price: 32_990_000,
      transmission: "automatico", fuel: "gasolina", color: "Branco Fuji", doors: 4,
      body_type: "suv", condition: "seminovo", single_owner: true,
      optionals: ["R-Dynamic SE", "Bancos couro Windsor", "Pivi Pro 11\"", "Meridian Surround", "Teto panorâmico fixo", "Rodas 20\""],
      description: "Evoque R-Dynamic SE 250 cv 4WD. Único dono, manuais. Pivi Pro 11\", Meridian, teto panorâmico, Windsor leather. Garantia 12/2025.",
      status: "disponivel", photos: [P.suv_white, P.premium_white, P.suv_silver],  // Range Rover Evoque branco
    },
    {
      brand: "Volvo", model: "XC60", version: "T8 Recharge Inscription",
      year: 2022, year_manufacture: 2021, km: 38_900,
      cost_price: 31_800_000, sale_price: 36_990_000,
      transmission: "automatico", fuel: "híbrido", color: "Cinza Thunder", doors: 4,
      body_type: "suv", condition: "seminovo",
      optionals: ["Híbrido plug-in 455 cv", "Bowers & Wilkins", "Bancos couro Nappa ventilados", "Pilot Assist", "Teto panorâmico", "Air Suspension"],
      description: "XC60 T8 Recharge Inscription híbrido plug-in 455 cv. B&W, Pilot Assist, Air Suspension. Tomada CA 220V, autonomia elétrica ~40 km.",
      status: "disponivel", photos: [P.suv_silver, P.suv_dark, P.premium_white],  // Volvo XC60 cinza
    },
    {
      brand: "Mini", model: "Cooper", version: "S 2.0 Top",
      year: 2021, year_manufacture: 2020, km: 41_500,
      cost_price: 14_800_000, sale_price: 17_490_000,
      transmission: "automatico", fuel: "gasolina", color: "Verde British Racing", doors: 2,
      body_type: "hatch", condition: "seminovo",
      optionals: ["Pacote John Cooper Works styling", "Teto solar elétrico", "Bancos esportivos couro", "Harman Kardon", "Faróis LED Union Jack", "Rodas 17\""],
      description: "Mini Cooper S 192 cv. Verde British Racing inconfundível. Teto solar, JCW styling, Harman Kardon, faróis Union Jack. Único dono.",
      status: "disponivel", photos: [P.hatch_teal, P.hatch_silver, P.hatch_red],  // Mini Cooper verde (hatch)
    },
    {
      brand: "Toyota", model: "Hilux", version: "2.8 SRX 4x4 Diesel",
      year: 2021, year_manufacture: 2020, km: 78_500,
      cost_price: 14_900_000, sale_price: 17_890_000,
      transmission: "automatico", fuel: "diesel", color: "Prata", doors: 4,
      body_type: "picape", condition: "seminovo",
      optionals: ["Cabine dupla", "Tração 4x4", "Bancos de couro", "Multimídia 8\"", "Câmera de ré", "Santo Antônio cromado"],
      description: "Hilux SRX 2.8 diesel 204 cv 4x4. Cabine dupla, couro, multimídia 8\", santo antônio cromado. Revisões Toyota, segundo dono.",
      status: "disponivel", photos: [P.pickup_silver, P.pickup_white, P.suv_silver],
    },
  ],
  transactions: [
    { vehicle_idx: 0, type: "entrada", amount: 39_500_000, date: "2025-12-05", notes: "Comprado de cliente Porsche Center" },
    { vehicle_idx: 1, type: "entrada", amount: 24_500_000, date: "2026-01-12", notes: "Carro de executivo, único dono" },
    { vehicle_idx: 2, type: "entrada", amount: 18_900_000, date: "2026-02-08", notes: "Comprado de particular" },
    { vehicle_idx: 3, type: "entrada", amount: 19_800_000, date: "2026-01-25", notes: "Comprado em leilão Mercedes" },
    { vehicle_idx: 4, type: "entrada", amount: 28_500_000, date: "2025-11-30", notes: "Comprado de particular, único dono" },
    { vehicle_idx: 5, type: "entrada", amount: 31_800_000, date: "2026-02-15", notes: "Comprado de empresa" },
    { vehicle_idx: 6, type: "entrada", amount: 14_800_000, date: "2026-01-18", notes: "Comprado de particular" },
    { vehicle_idx: 7, type: "entrada", amount: 14_900_000, date: "2025-12-22", notes: "Comprado de fazenda, NF e revisões Toyota" },
  ],
  leads: [
    { name: "Dr. Henrique Vasconcelos", phone: "31987651234", email: "h.vasconcelos@advmg.com.br",
      vehicle_idx: 0, message: "Aceitam Cayenne 2018 na troca? Quero ver presencialmente sábado.",
      source: "site", status: "negociando" },
    { name: "Bruna Tavares", phone: "31999887766", email: "brunat@gmail.com",
      vehicle_idx: 4, message: "É 4 rodas motrizes mesmo? Tem laudo cautelar e blindagem opcional?",
      source: "site", status: "contatado" },
    { name: "Felipe Andrade", phone: "31991234567",
      vehicle_idx: 1, message: "Posso financiar via BMW Financial Services com vocês?",
      source: "whatsapp", status: "novo" },
    { name: "Mariana Souza", phone: "31988556699", email: "mari.souza@uol.com.br",
      vehicle_idx: 5, message: "Esse XC60 T8 carrega em tomada comum 220V? Qual a autonomia elétrica real?",
      source: "site", status: "novo" },
  ],
};

export const DEALERSHIPS = {
  autoprime: AUTOPRIME,
  garagem082: GARAGEM082,
  premiummotors: PREMIUMMOTORS,
} as const;

/** Catálogo "global" antigo — mantido como agregação p/ analytics de demanda. */
export const MOCK_VEHICLES: VehicleSeed[] = [
  ...AUTOPRIME.vehicles,
  ...GARAGEM082.vehicles,
  ...PREMIUMMOTORS.vehicles,
];

export const MOCK_TRANSACTIONS: TransactionSeed[] = GARAGEM082.transactions;
