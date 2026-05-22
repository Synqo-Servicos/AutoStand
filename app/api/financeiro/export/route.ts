import { NextRequest, NextResponse } from "next/server";
import { getApiTenantId } from "@/lib/auth";
import {
  getFinanceiroPorVeiculo,
  getFinanceiroResumo,
  getOperationalExpenses,
  type FinanceiroFilters,
} from "@/lib/db";
import { TRANSACTION_LABELS, type TransactionType } from "@/lib/constants";
import { centsToCsv, CSV_BOM, joinCsv } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const tenantId = await getApiTenantId();
  if (tenantId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const month = sp.get("month");
  const year = sp.get("year");
  const filters: FinanceiroFilters = {};
  if (month) filters.month = month;
  else if (year) filters.year = year;

  const [resumo, porVeiculo, operacionais] = await Promise.all([
    getFinanceiroResumo(tenantId, filters),
    getFinanceiroPorVeiculo(tenantId, filters),
    getOperationalExpenses(tenantId, filters),
  ]);

  const margemPct = resumo.receita > 0 ? (resumo.lucroLiquido / resumo.receita) * 100 : 0;
  const period = month ?? year ?? "todo o histórico";

  const rows: (string | string[])[] = [
    ["AutoStand — Relatório financeiro"],
    ["Período", period],
    [],
    ["RESUMO"],
    ["Receita de vendas",           centsToCsv(resumo.receita)],
    ["Custo dos veículos vendidos", centsToCsv(resumo.custos)],
    ["Lucro bruto",                 centsToCsv(resumo.lucroBruto)],
    ["Despesas diretas",            centsToCsv(resumo.despesasDir)],
    ["Despesas operacionais",       centsToCsv(resumo.despesasOp)],
    ["Lucro líquido",               centsToCsv(resumo.lucroLiquido)],
    ["Margem líquida (%)",          margemPct.toFixed(2)],
    ["Veículos vendidos",           String(resumo.vendasUnits)],
    [],
    ["VENDAS DO PERÍODO"],
    ["Data", "Veículo", "Receita", "Custo", "Despesas diretas", "Margem real", "Margem %"],
  ];

  for (const v of porVeiculo) {
    const pct = v.receita > 0 ? (v.margem_real / v.receita) * 100 : 0;
    rows.push([
      v.sale_date,
      `${v.brand} ${v.model} ${v.year}`,
      centsToCsv(v.receita),
      centsToCsv(v.custo),
      centsToCsv(v.despesas_diretas),
      centsToCsv(v.margem_real),
      pct.toFixed(2),
    ]);
  }

  rows.push([]);
  rows.push(["DESPESAS OPERACIONAIS"]);
  rows.push(["Data", "Tipo", "Categoria", "Valor", "Observações"]);

  for (const o of operacionais) {
    rows.push([
      o.date,
      TRANSACTION_LABELS[o.type as TransactionType] ?? o.type,
      o.category ?? "",
      centsToCsv(o.amount),
      o.notes ?? "",
    ]);
  }

  const csv = CSV_BOM + joinCsv(rows);
  const filename = `financeiro_${period}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
