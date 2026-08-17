import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PaymentRow } from "@/lib/schema";

/**
 * `vi.hoisted` não é preferência de estilo: um `const fn = vi.fn()` lido por um
 * `vi.mock` içado cai em TDZ e trava o vitest em silêncio.
 */
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { FilaFiscal } from "@/components/superadmin/FilaFiscal";

/**
 * ============================================================================
 * A FILA FISCAL LÊ A COMPETÊNCIA PELA REGRA ÚNICA
 * ============================================================================
 *
 * Esta é a linha que o contador lê para decidir em que mês emitir a NFS-e —
 * uma ação irreversível fora do sistema. Ela empilhava DOIS fusos: o `paid_at`
 * voltava do Postgres como texto, `new Date()` interpretava esse texto como
 * hora LOCAL do navegador, e o código relia o resultado com `getUTCMonth()`.
 * Num navegador em São Paulo, o pagamento das 22h de 31/08 aparecia como
 * "Competência 09/2026" enquanto `sumCaixa`, na mesma tela, contava ele em
 * agosto.
 */
function pagamento(paidAt: string): PaymentRow {
  return {
    id: 1,
    tenant_id: 7,
    tenant_name: "Auto Brasil",
    tenant_document: "12345678000199",
    plan: "pro",
    mp_payment_id: "mp-1",
    mp_preapproval_id: null,
    gross_cents: 24990,
    fee_cents: 1200,
    net_cents: 23790,
    status: "approved",
    paid_at: paidAt,
    coupon_id: null,
    nfse_issued_at: null,
    nfse_number: null,
    nfse_issued_by: null,
    incomplete: false,
    created_at: "2026-08-31T22:00:00.000-03:00",
  } as PaymentRow;
}

function render(paidAt: string): string {
  return renderToStaticMarkup(
    createElement(FilaFiscal, { payments: [pagamento(paidAt)] }),
  );
}

describe("FilaFiscal — competência exibida", () => {
  it("as 22h de 31/08 em São Paulo são exibidas como 08/2026", () => {
    const html = render("2026-08-31T22:00:00.000-03:00");
    expect(html).toContain("Competência 08/2026");
    // A leitura antiga (relógio local + getUTCMonth) dizia setembro.
    expect(html).not.toContain("09/2026");
  });

  it("o mesmo instante no formato que o Postgres devolve dá o mesmo mês", () => {
    // `timestamptz` renderizado pelo driver em UTC — mesmo instante do caso
    // acima. Se a tela lesse o mês do texto cru, diria setembro.
    const html = render("2026-09-01 01:00:00+00");
    expect(html).toContain("Competência 08/2026");
    expect(html).not.toContain("09/2026");
  });

  it("a virada de setembro em São Paulo já é 09/2026", () => {
    expect(render("2026-09-01T03:00:00.000Z")).toContain("Competência 09/2026");
  });

  it("concorda com o classificador que o Caixa e o DAS usam", async () => {
    const { competenciaDeInstante } = await import("@/lib/competencia");
    for (const carimbo of [
      "2026-08-31T22:00:00.000-03:00",
      "2026-09-01 01:00:00+00",
      "2026-09-01T03:00:00.000Z",
      "2026-12-31T23:00:00.000-03:00",
    ]) {
      const [ano, mes] = competenciaDeInstante(carimbo)!.split("-");
      expect(render(carimbo), carimbo).toContain(`Competência ${mes}/${ano}`);
    }
  });

  /**
   * Carimbo sem offset não designa instante nenhum. A tela declara a ausência
   * em vez de exibir um mês chutado — porque o chute vira NFS-e emitida.
   */
  it("carimbo sem fuso vira 'Competência indisponível', não um mês inventado", () => {
    const html = render("2026-08-31 22:00:00");
    expect(html).toContain("Competência indisponível");
    expect(html).not.toContain("08/2026");
    expect(html).not.toContain("09/2026");
  });

  it("mantém o valor em centavos exatos na linha", () => {
    expect(render("2026-08-31T22:00:00.000-03:00")).toContain("249,90");
  });
});
