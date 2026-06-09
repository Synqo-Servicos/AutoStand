import { describe, expect, it } from "vitest";
import { isCouponValid } from "@/lib/db/coupons";
import type { CouponRow } from "@/lib/schema";

/**
 * Tests for getCouponByCode filtering logic via the extracted pure helper
 * isCouponValid — same pattern as sellers.test.ts (pure functions, no DB).
 */

// Helper: build a minimal valid CouponRow
function makeCoupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: 1,
    code: "TEST10",
    description: null,
    discount_type: "percentage",
    discount_value: 10,
    max_uses: 100,
    used_count: 0,
    expires_at: null,
    created_by: 1,
    partner_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isCouponValid", () => {
  it("retorna false quando used_count >= max_uses (esgotado)", () => {
    const coupon = makeCoupon({ used_count: 100, max_uses: 100 });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(false);
  });

  it("retorna false quando used_count excede max_uses", () => {
    const coupon = makeCoupon({ used_count: 101, max_uses: 100 });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(false);
  });

  it("retorna false quando expires_at está no passado", () => {
    const coupon = makeCoupon({ expires_at: "2025-01-01", used_count: 0, max_uses: 100 });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(false);
  });

  it("retorna true quando válido (usos restantes, sem expiração)", () => {
    const coupon = makeCoupon({ used_count: 5, max_uses: 100, expires_at: null });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(true);
  });

  it("retorna true quando válido com expires_at no futuro", () => {
    const coupon = makeCoupon({ used_count: 0, max_uses: 10, expires_at: "2099-12-31" });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(true);
  });

  it("retorna true quando expires_at é exatamente hoje (mesmo dia ainda vale)", () => {
    const coupon = makeCoupon({ used_count: 0, max_uses: 10, expires_at: "2026-06-09" });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(true);
  });

  it("retorna false para o dia seguinte ao expires_at", () => {
    const coupon = makeCoupon({ used_count: 0, max_uses: 10, expires_at: "2026-06-08" });
    expect(isCouponValid(coupon, "2026-06-09")).toBe(false);
  });
});
