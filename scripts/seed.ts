import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  client,
  createTenant,
  createUser,
  db,
  getTenantBySlug,
  getUserByEmail,
  updateTenant,
} from "@/lib/db";
import { DEALERSHIPS, type DealershipSeed, MOCK_VEHICLES } from "./mock-data";
import type { NewDemandEvent, NewTenant } from "@/lib/schema";
import { demand_events, leads, transactions, vehicle_photos, vehicles } from "@/lib/schema";

/** Escolha aleatória ponderada. */
function pick<T>(weighted: [T, number][]): T {
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weighted) {
    r -= w;
    if (r <= 0) return v;
  }
  return weighted[0][0];
}

/**
 * Semeia eventos de demanda sintéticos para a demo não nascer vazia.
 * Skew proposital: hatch/SUV baratos puxam a procura — dá insight visível.
 */
async function seedDemand(tenantIds: number[]) {
  await db.delete(demand_events);

  const brand = (): string | null =>
    pick<string | null>([
      ["Volkswagen", 5], ["Chevrolet", 4], ["Hyundai", 4],
      ["Toyota", 3], ["Honda", 3], ["Jeep", 2], ["Fiat", 3], [null, 6],
    ]);
  const body = (): string | null =>
    pick<string | null>([["hatch", 6], ["suv", 5], ["sedan", 3], ["picape", 1], [null, 8]]);
  const city = (): string | null =>
    pick<string | null>([
      ["Maceió, AL", 5], ["São Paulo, SP", 4], ["Belo Horizonte, MG", 3],
      ["Recife, PE", 2], ["Salvador, BA", 2], [null, 6],
    ]);
  const priceCents = (): number | null => {
    const b = pick<string | null>([["lo", 6], ["mid", 4], ["hi", 2], ["top", 1], [null, 7]]);
    if (b === "lo") return 3_000_000 + Math.floor(Math.random() * 2_000_000);
    if (b === "mid") return 5_000_000 + Math.floor(Math.random() * 3_000_000);
    if (b === "hi") return 8_000_000 + Math.floor(Math.random() * 4_000_000);
    if (b === "top") return 12_000_000 + Math.floor(Math.random() * 8_000_000);
    return null;
  };

  const events: NewDemandEvent[] = [];
  const addSearches = (tenantId: number | null, n: number) => {
    for (let i = 0; i < n; i++) {
      events.push({
        tenant_id: tenantId,
        event_type: "search",
        brand: brand(),
        body_type: body(),
        city: tenantId === null ? city() : null,
        fuel: pick<string | null>([["flex", 4], [null, 9], ["diesel", 1]]),
        price: priceCents(),
      });
    }
  };
  const addViews = (tenantId: number | null, n: number) => {
    for (let i = 0; i < n; i++) {
      const v = MOCK_VEHICLES[Math.floor(Math.random() * MOCK_VEHICLES.length)];
      events.push({
        tenant_id: tenantId,
        event_type: "view",
        brand: v.brand,
        model: v.model,
        body_type: v.body_type ?? null,
        price: v.sale_price,
      });
    }
  };

  addSearches(null, 180);
  addViews(null, 120);
  for (const id of tenantIds) {
    addSearches(id, 50);
    addViews(id, 40);
  }

  for (let i = 0; i < events.length; i += 200) {
    await db.insert(demand_events).values(events.slice(i, i + 200));
  }
  console.log(`  ✓ ${events.length} eventos de demanda`);
}

/**
 * Provisiona uma concessionária: tenant + admin user + frota + transações + leads.
 * Re-rodável: limpa estoque/leads/transações antes de inserir.
 */
async function seedDealership(opts: {
  tenant: NewTenant;
  admin: { name: string; email: string; password: string };
  data: DealershipSeed;
}) {
  let tenant = await getTenantBySlug(opts.tenant.slug);
  if (!tenant) {
    tenant = await createTenant(opts.tenant);
    console.log(`✓ ${tenant.name} (${tenant.slug}.localhost:3000)`);
  } else {
    console.log(`· ${tenant.name} já existe`);
  }
  // Mantém plano/layout/marca sempre alinhados com o seed.
  const patch: Partial<NewTenant> = {};
  if (opts.tenant.plan && tenant.plan !== opts.tenant.plan) patch.plan = opts.tenant.plan;
  if (opts.tenant.layout_config !== undefined) patch.layout_config = opts.tenant.layout_config;
  if (opts.tenant.marketplace_opt_in !== undefined) {
    patch.marketplace_opt_in = opts.tenant.marketplace_opt_in;
  }
  if (opts.tenant.primary_color !== undefined) patch.primary_color = opts.tenant.primary_color;
  if (opts.tenant.accent_color !== undefined) patch.accent_color = opts.tenant.accent_color;
  if (opts.tenant.accent_dark_color !== undefined) {
    patch.accent_dark_color = opts.tenant.accent_dark_color;
  }
  if (opts.tenant.hero_title !== undefined) patch.hero_title = opts.tenant.hero_title;
  if (opts.tenant.hero_subtitle !== undefined) patch.hero_subtitle = opts.tenant.hero_subtitle;
  if (opts.tenant.city !== undefined) patch.city = opts.tenant.city;
  if (Object.keys(patch).length > 0) {
    tenant = (await updateTenant(tenant.id, patch)) ?? tenant;
  }
  const tenantId = tenant.id;

  if (!(await getUserByEmail(opts.admin.email))) {
    await createUser({
      email: opts.admin.email,
      password: await bcrypt.hash(opts.admin.password, 12),
      name: opts.admin.name,
      role: "tenant_admin",
      tenant_id: tenantId,
    });
    console.log(`  ✓ Admin: ${opts.admin.email}`);
  }

  // Fresh inventory (re-seedable).
  await db.delete(transactions).where(eq(transactions.tenant_id, tenantId));
  await db.delete(leads).where(eq(leads.tenant_id, tenantId));
  await db.delete(vehicle_photos).where(eq(vehicle_photos.tenant_id, tenantId));
  await db.delete(vehicles).where(eq(vehicles.tenant_id, tenantId));

  const vehicleIds: number[] = [];
  for (const v of opts.data.vehicles) {
    const [row] = await db
      .insert(vehicles)
      .values({
        tenant_id: tenantId,
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
        optionals: v.optionals ?? null,
        armored: v.armored ?? false,
        single_owner: v.single_owner ?? false,
        fipe_code: v.fipe_code ?? null,
        description: v.description,
        status: v.status,
        primary_photo_url: v.photos[0] ?? null,
      })
      .returning();
    vehicleIds.push(row.id);
    for (let i = 0; i < v.photos.length; i++) {
      await db.insert(vehicle_photos).values({
        tenant_id: tenantId,
        vehicle_id: row.id,
        url: v.photos[i],
        order_idx: i,
      });
    }
  }

  for (const tx of opts.data.transactions) {
    await db.insert(transactions).values({
      tenant_id: tenantId,
      vehicle_id: vehicleIds[tx.vehicle_idx],
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      buyer_name: tx.buyer_name ?? null,
      buyer_phone: tx.buyer_phone ?? null,
      notes: tx.notes ?? null,
    });
  }

  for (const lead of opts.data.leads) {
    await db.insert(leads).values({
      tenant_id: tenantId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email ?? null,
      vehicle_id: vehicleIds[lead.vehicle_idx],
      message: lead.message ?? null,
      source: lead.source ?? "site",
      status: lead.status ?? "novo",
    });
  }

  console.log(
    `  ✓ ${opts.data.vehicles.length} veículos · ${opts.data.transactions.length} transações · ${opts.data.leads.length} leads`,
  );
  return tenantId;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("ABORT: seed.ts não deve rodar em produção.");
    process.exit(1);
  }

  // --- Super admin (platform owner) ---
  const superEmail = (process.env.SUPER_ADMIN_EMAIL ?? "super@plataforma.com").trim();
  const superPass = (process.env.SUPER_ADMIN_PASSWORD ?? "super123").trim();
  if (!(await getUserByEmail(superEmail))) {
    await createUser({
      email: superEmail,
      password: await bcrypt.hash(superPass, 12),
      name: "Super Admin",
      role: "super_admin",
      tenant_id: null,
    });
    console.log(`✓ Super admin: ${superEmail}`);
  } else {
    console.log(`· Super admin ${superEmail} já existe`);
  }

  // ---------------------------------------------------------------------------
  // 1) AutoPrime Seminovos — São Paulo, SP — Premium tier (vitrine principal)
  // ---------------------------------------------------------------------------
  const autoprimeId = await seedDealership({
    tenant: {
      slug: "autoprime",
      plan: "premium",
      subscription_status: "active",
      marketplace_opt_in: true,
      name: "AutoPrime Seminovos",
      custom_domain: "autoprime.exemplo.com.br",
      whatsapp_number: "5511999990000",
      instagram_url: "https://instagram.com/autoprime",
      business_hours: "Seg–Sáb: 9h às 19h",
      city: "São Paulo, SP",
      primary_color: "#0C4A6E",
      accent_color: "#F97316",
      accent_dark_color: "#EA580C",
      hero_title: "O seminovo certo, sem complicação",
      hero_subtitle:
        "Showroom completo, garantia real e financiamento aprovado na hora. Escolha seu próximo carro com total confiança.",
      layout_config: {
        heroStyle: "image",
        heroImageUrl:
          "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
        cardStyle: "overlay",
        cardsPerRow: 4,
      },
    },
    admin: { name: "Equipe AutoPrime", email: "admin@autoprime.com", password: "demo123" },
    data: DEALERSHIPS.autoprime,
  });

  // ---------------------------------------------------------------------------
  // 2) Garagem 082 — Maceió, AL — Pro tier (revenda local com cara profissional)
  // ---------------------------------------------------------------------------
  const garagem082Id = await seedDealership({
    tenant: {
      slug: "garagem082",
      plan: "pro",
      subscription_status: "active",
      marketplace_opt_in: true,
      name: "Garagem 082",
      custom_domain: "garagem082.com.br",
      whatsapp_number: "5582991234567",
      instagram_url: "https://instagram.com/garagem082",
      business_hours: "Seg–Sex: 8h às 18h · Sáb: 8h às 13h",
      city: "Maceió, AL",
      // Verde-petróleo + dourado: paleta de revenda local "premiada".
      primary_color: "#0F3D3E",
      accent_color: "#E0A458",
      accent_dark_color: "#B8843F",
      hero_title: "Seminovos com a cara de Maceió",
      hero_subtitle:
        "Carros revisados, documentação em dia e atendimento humano. Há 12 anos no Tabuleiro do Martins — agora também com financiamento online.",
      layout_config: {
        heroStyle: "solid",
        heroImageUrl: null,
        cardStyle: "elevated",
        cardsPerRow: 3,
      },
    },
    admin: { name: "Equipe Garagem 082", email: "admin@garagem082.com.br", password: "garagem123" },
    data: DEALERSHIPS.garagem082,
  });

  // ---------------------------------------------------------------------------
  // 3) Premium Motors — Belo Horizonte, MG — Premium tier (boutique high-end)
  // ---------------------------------------------------------------------------
  const premiumMotorsId = await seedDealership({
    tenant: {
      slug: "premiummotors",
      plan: "premium",
      subscription_status: "active",
      marketplace_opt_in: false, // boutique não expõe estoque no marketplace
      name: "Premium Motors",
      custom_domain: "premiummotors.com.br",
      whatsapp_number: "5531998765432",
      instagram_url: "https://instagram.com/premiummotorsbh",
      business_hours: "Seg–Sáb: 9h às 19h · com hora marcada",
      city: "Belo Horizonte, MG",
      // Preto profundo + dourado champagne: paleta luxury.
      primary_color: "#111827",
      accent_color: "#C9A961",
      accent_dark_color: "#A8893F",
      hero_title: "Importados e esportivos selecionados",
      hero_subtitle:
        "Cada veículo do nosso estoque é avaliado, documentado e entregue sem surpresas. Atendimento exclusivo com hora marcada na Savassi.",
      layout_config: {
        heroStyle: "gradient",
        heroImageUrl: null,
        cardStyle: "elevated",
        cardsPerRow: 3,
      },
    },
    admin: { name: "Equipe Premium Motors", email: "admin@premiummotors.com.br", password: "premium123" },
    data: DEALERSHIPS.premiummotors,
  });

  await seedDemand([autoprimeId, garagem082Id, premiumMotorsId]);

  console.log("\n✅ Seed concluído!");
  console.log("\nAcessos de demo:");
  console.log("  Super admin       super@plataforma.com / super123          → localhost:3000/superadmin");
  console.log("  AutoPrime (Prem)  admin@autoprime.com / demo123             → autoprime.localhost:3000");
  console.log("  Garagem 082 (Pro) admin@garagem082.com.br / garagem123      → garagem082.localhost:3000");
  console.log("  Premium Motors    admin@premiummotors.com.br / premium123   → premiummotors.localhost:3000");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
