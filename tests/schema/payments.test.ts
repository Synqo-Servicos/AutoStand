import { describe, it, expect } from "vitest";
import { payments } from "@/lib/schema";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("tabela payments", () => {
  const cols = getTableColumns(payments);

  it("tem as colunas do spec", () => {
    expect(Object.keys(cols).sort()).toEqual([
      "coupon_id", "created_at", "fee_cents", "gross_cents", "id", "incomplete",
      "mp_payment_id", "mp_preapproval_id", "net_cents", "nfse_issued_at",
      "nfse_issued_by", "nfse_number", "paid_at", "plan", "status",
      "tenant_document", "tenant_id", "tenant_name",
    ].sort());
  });

  it("congela o pagador na linha — a nota diz quem pagou naquele dia", () => {
    expect(cols.tenant_name.notNull).toBe(true);
    expect(cols).toHaveProperty("tenant_document");
  });

  it("exige o essencial do dinheiro", () => {
    expect(cols.gross_cents.notNull).toBe(true);
    expect(cols.paid_at.notNull).toBe(true);
    expect(cols.status.notNull).toBe(true);
    expect(cols.mp_payment_id.notNull).toBe(true);
  });

  it("nasce sem nota emitida", () => {
    expect(cols.nfse_issued_at.notNull).toBe(false);
    expect(cols.nfse_number.notNull).toBe(false);
  });

  it("tenant_id é SET NULL — registro fiscal não morre com o cliente", () => {
    const fk = getTableConfig(payments).foreignKeys
      .find((f) => f.reference().foreignTable === undefined
        ? false
        : f.reference().columns.some((c) => c.name === "tenant_id"));
    expect(fk?.onDelete).toBe("set null");
  });
});
