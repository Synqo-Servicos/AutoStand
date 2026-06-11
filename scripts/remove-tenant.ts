import { client, deleteTenant, getTenantBySlug } from "@/lib/db";

/**
 * Remove uma concessionária e todos os seus dados.
 * Uso: tsx scripts/remove-tenant.ts <slug>
 */
async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: tsx scripts/remove-tenant.ts <slug>");
    process.exit(1);
  }
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    console.log(`Concessionária "${slug}" não encontrada — nada a fazer.`);
    client.end();
    return;
  }
  await deleteTenant(tenant.id);
  console.log(`✓ Concessionária "${tenant.name}" (${slug}) e seus dados foram removidos.`);
  client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
