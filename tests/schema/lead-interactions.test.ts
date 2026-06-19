import { describe, it, expect } from "vitest";
import { lead_interactions } from "@/lib/schema";
import { getTableColumns } from "drizzle-orm";
import { LEAD_INTERACTION_MANUAL_TYPES, LEAD_INTERACTION_TYPES } from "@/lib/constants";

describe("lead_interactions schema", () => {
  it("has the timeline columns (tenant-scoped, with actor + metadata)", () => {
    const columns = getTableColumns(lead_interactions);
    for (const key of ["tenant_id", "lead_id", "user_id", "type", "body", "metadata", "created_at"]) {
      expect(columns).toHaveProperty(key);
    }
  });
});

describe("lead interaction types", () => {
  it("manual types are a subset of all types and exclude the system-only one", () => {
    for (const t of LEAD_INTERACTION_MANUAL_TYPES) {
      expect(LEAD_INTERACTION_TYPES).toContain(t);
    }
    expect(LEAD_INTERACTION_MANUAL_TYPES).not.toContain("mudanca_status");
    expect(LEAD_INTERACTION_TYPES).toContain("mudanca_status");
  });
});
