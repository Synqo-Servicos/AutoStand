import { describe, it, expect } from "vitest";
import { payables, payable_attachments, sent_notifications, transactions } from "@/lib/schema";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("tabela payables", () => {
  const cols = getTableColumns(payables);

  it("tem todas as colunas do spec", () => {
    expect(Object.keys(cols).sort()).toEqual([
      "active", "amount_cents", "category", "created_at", "description",
      "first_due_date", "frequency", "id", "installments", "notes",
      "payment_method", "supplier", "tenant_id", "type",
    ].sort());
  });

  it("exige tenant_id, type, frequency e first_due_date", () => {
    expect(cols.tenant_id.notNull).toBe(true);
    expect(cols.type.notNull).toBe(true);
    expect(cols.frequency.notNull).toBe(true);
    expect(cols.first_due_date.notNull).toBe(true);
  });

  it("nasce ativa", () => {
    expect(cols.active.default).toBe(true);
  });

  it("NÃO tem end_date — installments é a única forma de encerrar a série", () => {
    expect(cols).not.toHaveProperty("end_date");
  });
});

describe("colunas novas em transactions", () => {
  const cols = getTableColumns(transactions);

  it("liga a transação ao vencimento que ela quita", () => {
    expect(cols).toHaveProperty("payable_id");
    expect(cols).toHaveProperty("due_date");
  });

  it("guarda a forma de pagamento usada", () => {
    expect(cols).toHaveProperty("payment_method");
  });

  it("payable_id é opcional — despesa avulsa continua válida", () => {
    expect(cols.payable_id.notNull).toBe(false);
  });

  it("apagar a payable SET NULL em transactions.payable_id — nunca cascade", () => {
    // Regra de negócio (spec): apagar uma conta a pagar não pode apagar o
    // histórico de transações já quitadas por ela. Se isto virasse
    // `onDelete: "cascade"`, o comprovante de um aluguel já pago
    // desapareceria do livro-caixa junto com a regra. Verificado contra o
    // SQL gerado (drizzle/0005_quiet_talkback.sql):
    //   ALTER TABLE "transactions" ADD CONSTRAINT
    //   "transactions_payable_id_payables_id_fk" FOREIGN KEY ("payable_id")
    //   REFERENCES "public"."payables"("id") ON DELETE set null ...
    const fk = getTableConfig(transactions).foreignKeys.find(
      (f) => f.reference().columns.some((c) => c.name === "payable_id")
        && f.reference().foreignTable === payables,
    );
    expect(fk).toBeDefined();
    expect(fk!.onDelete).toBe("set null");
  });
});

describe("sent_notifications", () => {
  const cols = getTableColumns(sent_notifications);

  it("tem a chave de dedupe", () => {
    expect(cols).toHaveProperty("kind");
    expect(cols).toHaveProperty("ref_key");
    expect(cols.kind.notNull).toBe(true);
    expect(cols.ref_key.notNull).toBe(true);
  });
});

describe("payable_attachments", () => {
  const cols = getTableColumns(payable_attachments);

  it("separa boleto da conta (transaction_id nulo) de comprovante do pagamento", () => {
    expect(cols.payable_id.notNull).toBe(true);
    expect(cols.transaction_id.notNull).toBe(false);
  });
});
