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
import { MOCK_TRANSACTIONS, MOCK_VEHICLES } from "@/lib/mock-data";
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
      ["Toyota", 3], ["Honda", 3], ["Jeep", 2], [null, 6],
    ]);
  const body = (): string | null =>
    pick<string | null>([["hatch", 6], ["suv", 5], ["sedan", 3], ["picape", 1], [null, 8]]);
  const city = (): string | null =>
    pick<string | null>([
      ["Maceió, AL", 4], ["São Paulo, SP", 3], ["Recife, PE", 2], [null, 7],
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

  addSearches(null, 140);
  addViews(null, 90);
  for (const id of tenantIds) {
    addSearches(id, 45);
    addViews(id, 35);
  }

  for (let i = 0; i < events.length; i += 200) {
    await db.insert(demand_events).values(events.slice(i, i + 200));
  }
  console.log(`  ✓ ${events.length} eventos de demanda`);
}

/**
 * Seeds the whitelabel platform:
 *  - one super_admin (platform owner)
 *  - the "Pedro Ivo Veículos" tenant (a real client)
 *  - the "AutoPrime Seminovos" tenant (a demo/showcase used in sales pitches)
 * Each dealership gets its own admin user, inventory, transactions and leads.
 */

async function seedDealership(opts: {
  tenant: NewTenant;
  admin: { name: string; email: string; password: string };
}) {
  let tenant = await getTenantBySlug(opts.tenant.slug);
  if (!tenant) {
    tenant = await createTenant(opts.tenant);
    console.log(`✓ Concessionária: ${tenant.name} (${tenant.slug}.localhost:3000)`);
  } else {
    console.log(`· Concessionária ${tenant.name} já existe`);
  }
  // Sincroniza plano e layout das concessionárias demo a cada seed.
  const patch: Partial<NewTenant> = {};
  if (opts.tenant.plan && tenant.plan !== opts.tenant.plan) patch.plan = opts.tenant.plan;
  if (opts.tenant.layout_config !== undefined) patch.layout_config = opts.tenant.layout_config;
  if (opts.tenant.marketplace_opt_in !== undefined) {
    patch.marketplace_opt_in = opts.tenant.marketplace_opt_in;
  }
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
  for (const v of MOCK_VEHICLES) {
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

  for (const tx of MOCK_TRANSACTIONS) {
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

  await db.insert(leads).values([
    {
      tenant_id: tenantId,
      name: "Carla Mendes",
      phone: "82991112233",
      email: "carla.mendes@email.com",
      vehicle_id: vehicleIds[0],
      message: "Tenho interesse neste carro, ele aceita troca?",
      source: "site",
      status: "novo",
    },
    {
      tenant_id: tenantId,
      name: "João Pereira",
      phone: "82994445566",
      vehicle_id: vehicleIds[2],
      message: "Qual o valor da entrada?",
      source: "site",
      status: "contatado",
    },
  ]);

  console.log(
    `  ✓ ${MOCK_VEHICLES.length} veículos · ${MOCK_TRANSACTIONS.length} transações · 2 leads`,
  );
}

async function main() {
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

  // --- Real client: Pedro Ivo Veículos ---
  await seedDealership({
    tenant: {
      slug: "pedro-ivo",
      plan: "premium",
      marketplace_opt_in: true,
      name: "Pedro Ivo Veículos",
      custom_domain: "pedroivoveiculos.com.br",
      whatsapp_number: "5582998287879",
      instagram_url: "https://www.instagram.com/pedroivo_veiculos/",
      business_hours: "Seg–Sex: 8h às 18h",
      city: "Maceió, AL",
      primary_color: "#1E293B",
      accent_color: "#DC2626",
      accent_dark_color: "#B91C1C",
      hero_title: "Seminovos com procedência",
      hero_subtitle:
        "Carros revisados, documentação em dia e financiamento facilitado. Encontre o carro certo para você.",
    },
    admin: {
      name: "Pedro Ivo",
      email: (process.env.ADMIN_EMAIL ?? "admin@pedro-ivo.com.br").trim(),
      password: (process.env.ADMIN_PASSWORD ?? "pedro123").trim(),
    },
  });

  // --- Showcase / demo dealership (used to present the platform to prospects) ---
  await seedDealership({
    tenant: {
      slug: "demo",
      plan: "premium",
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
      // Layout distinto — mostra a Fase 4 lado a lado com o storefront padrão.
      layout_config: {
        heroStyle: "image",
        heroImageUrl:
          "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
        cardStyle: "overlay",
        cardsPerRow: 4,
      },
    },
    admin: {
      name: "Equipe AutoPrime",
      email: "admin@autoprime.com",
      password: "demo123",
    },
  });

  const demoTenants = await Promise.all([
    getTenantBySlug("pedro-ivo"),
    getTenantBySlug("demo"),
  ]);
  await seedDemand(demoTenants.filter((t) => t !== null).map((t) => t!.id));

  console.log("\n✅ Seed concluído!");
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
