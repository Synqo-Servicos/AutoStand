import { desc, eq, sql } from "drizzle-orm";
import { partners, tenants } from "@/lib/schema";
import type { NewPartner, PartnerRow, TenantRow } from "@/lib/schema";
import { db, type Tx } from "./client";

/**
 * CAMPO MORTO — `partners.discount_type` / `partners.discount_value`.
 *
 * Estes dois campos NÃO afetam cobrança e nunca afetaram. Eles são resquício do
 * desenho original (era Stripe: o parceiro apontava para um `stripe_coupon_id`,
 * coluna hoje também sem uso). Quando o billing migrou para o Mercado Pago, o
 * desconto passou a ser concedido pela tabela `coupons` — que tem `partner_id`
 * justamente para amarrar o cupom ao parceiro.
 *
 * Modelo comercial vigente, conforme a documentação do produto:
 * - `docs/Modelo de Dados.md` (§ `partners`): "o desconto é aplicado via cupom
 *   no checkout do Mercado Pago — ver tabela `coupons`";
 * - `docs/Decisões.md`: "Cada parceiro tem um cupom de desconto e um link
 *   `?parceiro=`";
 * - `docs/produto/01-Fundamentos.md` e `docs/Planos e Preços.md`: links de
 *   parceiro "aplicam cupons de desconto e creditam a indicação".
 *
 * Ou seja: o link `?parceiro=` faz ATRIBUIÇÃO (`tenants.referred_by`,
 * `partners.signup_count`, limites `max_uses`/`expires_at`). Quem dá desconto é
 * o CUPOM que o parceiro entrega ao lojista.
 *
 * Não ligue estes campos no cálculo de preço sem decisão comercial explícita —
 * isso criaria um segundo mecanismo de desconto concorrendo com os cupons
 * (regra de acúmulo, desconto recorrente permanente, etc.).
 *
 * DESATIVADO NA UI EM 2026-08-15, por decisão de produto: `/superadmin/parceiros`
 * não coleta nem exibe mais o desconto (era ali que o parceiro se convencia de
 * que ele era real, vendo o super-admin cadastrar um "15%"). As COLUNAS ficam:
 * sem migration e sem apagar dado, porque a decisão pode ser revista. As rotas
 * de `/api/superadmin/parceiros` seguem aceitando os campos — hoje ninguém os
 * envia. Remover as colunas de vez exige migration.
 */

export async function listPartners(): Promise<PartnerRow[]> {
  return db.select().from(partners).orderBy(desc(partners.created_at));
}

export async function getPartnerById(id: number): Promise<PartnerRow | null> {
  const [row] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return row ?? null;
}

/** Parceiro pelo código, cru — para checagem de unicidade no admin. */
export async function getPartnerByCodeRaw(code: string): Promise<PartnerRow | null> {
  const [row] = await db.select().from(partners).where(eq(partners.code, code)).limit(1);
  return row ?? null;
}

/**
 * Parceiro **utilizável** num cadastro `?parceiro=`: precisa estar ativo,
 * dentro do limite de usos e da validade. Caso contrário → null.
 */
export async function getPartnerByCode(code: string): Promise<PartnerRow | null> {
  const partner = await getPartnerByCodeRaw(code);
  if (!partner || partner.status !== "active") return null;
  if (partner.max_uses != null && partner.signup_count >= partner.max_uses) return null;
  if (partner.expires_at && partner.expires_at < new Date().toISOString().slice(0, 10)) {
    return null;
  }
  return partner;
}

export async function createPartner(input: NewPartner): Promise<PartnerRow> {
  const [row] = await db.insert(partners).values(input).returning();
  return row;
}

export async function updatePartner(
  id: number,
  input: Partial<NewPartner>,
): Promise<PartnerRow | null> {
  // signup_count nunca é editado à mão — só por incrementPartnerSignup.
  const { id: _id, created_at: _ca, signup_count: _sc, ...safe } = input;
  void _id;
  void _ca;
  void _sc;
  if (Object.keys(safe).length > 0) {
    await db.update(partners).set(safe).where(eq(partners.id, id));
  }
  return getPartnerById(id);
}

export async function deletePartner(id: number): Promise<void> {
  await db.delete(partners).where(eq(partners.id, id));
}

/** Concessionárias atribuídas a um parceiro (relatório de atribuição). */
export async function getTenantsReferredBy(partnerId: number): Promise<TenantRow[]> {
  return db
    .select()
    .from(tenants)
    .where(eq(tenants.referred_by, partnerId))
    .orderBy(desc(tenants.created_at));
}

/** Soma 1 ao contador de cadastros atribuídos a um parceiro. */
export async function incrementPartnerSignup(id: number, tx?: Tx): Promise<void> {
  const orm = tx ?? db;
  await orm
    .update(partners)
    .set({ signup_count: sql`${partners.signup_count} + 1` })
    .where(eq(partners.id, id));
}
