#!/usr/bin/env bash
# Verifica as três pendências de banco da correção de fuso do módulo financeiro.
#
# Pré-requisito: OrbStack (ou Docker) rodando. Nada mais — sobe um Postgres
# descartável, aplica as migrations, e derruba tudo no fim.
#
# Uso:  bash verificar-fuso.sh
#
# O que ele responde, nesta ordem:
#   1. a coluna paid_at nasce como `timestamp with time zone`?
#   2. o offset é honrado na escrita? (22:00 de 31/08 em SP = 01:00 de 01/09 em UTC)
#   3. o texto que o driver entrega vem COM offset?
#
# A 3 é a que ninguém conseguiu observar sem banco: o drizzle em mode:"string"
# remonta a data usando o offset da MÁQUINA, o que acerta por coincidência num
# host UTC como a Vercel e erra por 3h num Mac em BRT. Se ela falhar, o parser
# identidade do OID 1184 em lib/db/date-parsers.ts não está pegando.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

CONTAINER=autostand-verifica-fuso
PORT=55433
export DATABASE_URL="postgres://postgres:postgres@localhost:${PORT}/autostand"

limpar() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap limpar EXIT

echo "==> subindo Postgres descartável na porta ${PORT}"
limpar
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=autostand \
  -p "${PORT}:5432" postgres:16-alpine >/dev/null

echo "==> esperando aceitar conexão"
for _ in $(seq 1 40); do
  if docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null; then break; fi
  sleep 0.5
done

echo "==> aplicando migrations"
npm run db:migrate

echo
echo "==> 1) tipo da coluna paid_at"
docker exec "$CONTAINER" psql -U postgres -d autostand -tAc \
  "select data_type from information_schema.columns
    where table_name='payments' and column_name='paid_at';" \
  | tee /dev/stderr | grep -q 'timestamp with time zone' \
  && echo "   OK — timestamptz" \
  || { echo "   FALHOU — a coluna não é timestamptz"; exit 1; }

echo
echo "==> 2) o offset é honrado na escrita?"
docker exec "$CONTAINER" psql -U postgres -d autostand -tAc \
  "insert into payments (mp_payment_id, gross_cents, status, paid_at)
   values ('verifica-fuso', 24990, 'approved', '2026-08-31 22:00:00-03:00');
   select to_char(paid_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from payments
    where mp_payment_id='verifica-fuso';" \
  | tee /dev/stderr | grep -q '2026-09-01 01:00' \
  && echo "   OK — 22:00 de 31/08 em SP virou 01:00 de 01/09 em UTC" \
  || { echo "   FALHOU — o offset foi descartado na escrita"; exit 1; }

echo
echo "==> 3) o texto que o driver entrega vem com offset?"
npx tsx -e '
import { db } from "./lib/db/client";
import { sql } from "drizzle-orm";
const r: any = await db.execute(
  sql`select paid_at from payments where mp_payment_id = ${"verifica-fuso"}`,
);
const bruto = (r.rows ?? r)[0]?.paid_at;
console.log("   driver devolveu:", JSON.stringify(bruto));
const temOffset = typeof bruto === "string" && /[+-]\d{2}(:?\d{2})?$|Z$/.test(bruto);
if (!temOffset) {
  console.error("   FALHOU — sem offset no texto. O parser do OID 1184 não pegou,");
  console.error("   e a competência vai deslizar conforme o fuso da máquina.");
  process.exit(1);
}
console.log("   OK — offset presente, a competência não depende da máquina");
process.exit(0);
'

echo
echo "==> tudo verde. Derrubando o Postgres descartável."
