import { describe, it, expect } from "vitest";
import { tenants } from "@/lib/schema";
import { getTableColumns } from "drizzle-orm";

describe("tenants schema", () => {
  it("has mp_subscription_id column", () => {
    const columns = getTableColumns(tenants);
    expect(columns).toHaveProperty("mp_subscription_id");
  });
});
