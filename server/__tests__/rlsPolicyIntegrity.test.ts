import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("PostgreSQL Row-Level Security (RLS) Policy Integrity Suite (T017)", () => {
  const migrationFile = path.resolve(
    __dirname,
    "../../database/migrations/001_rls_policies.sql"
  );

  it("001_rls_policies.sql file must exist and be non-empty", () => {
    expect(fs.existsSync(migrationFile)).toBe(true);
    const content = fs.readFileSync(migrationFile, "utf-8");
    expect(content.length).toBeGreaterThan(100);
  });

  it("must enforce both ENABLE and FORCE ROW LEVEL SECURITY on all sensitive tables", () => {
    const content = fs.readFileSync(migrationFile, "utf-8");
    const requiredTables = ["projects", "project_collaborators", "chapters", "glossary"];

    for (const table of requiredTables) {
      const enableRegex = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i");
      const forceRegex = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i");

      expect(enableRegex.test(content), `Table ${table} must ENABLE ROW LEVEL SECURITY`).toBe(true);
      expect(forceRegex.test(content), `Table ${table} must FORCE ROW LEVEL SECURITY to prevent table owner bypass`).toBe(true);
    }
  });

  it("must include WITH CHECK clause for mutation policies to prevent cross-tenant record injection", () => {
    const content = fs.readFileSync(migrationFile, "utf-8");

    // Must have WITH CHECK for Chapters mutation/update
    const chaptersUpdateRegex = /CREATE\s+POLICY\s+["']Chapters:\s*Editor\s+update\s+access["'][\s\S]*?WITH\s+CHECK/i;
    expect(chaptersUpdateRegex.test(content)).toBe(true);

    // Must have WITH CHECK for Chapters owner full control
    const chaptersOwnerRegex = /CREATE\s+POLICY\s+["']Chapters:\s*Owner\s+full\s+control["'][\s\S]*?WITH\s+CHECK/i;
    expect(chaptersOwnerRegex.test(content)).toBe(true);

    // Must have WITH CHECK for Projects owner full control
    const projectsOwnerRegex = /CREATE\s+POLICY\s+["']Projects:\s*Owner\s+full\s+control["'][\s\S]*?WITH\s+CHECK/i;
    expect(projectsOwnerRegex.test(content)).toBe(true);
  });

  it("must not have permissive USING (true) on write or update operations", () => {
    const content = fs.readFileSync(migrationFile, "utf-8");
    const lines = content.split("\n");

    let currentPolicyAction = "";
    for (const line of lines) {
      if (/FOR\s+(ALL|INSERT|UPDATE|DELETE)/i.test(line)) {
        currentPolicyAction = line.trim();
      }
      if (/USING\s*\(\s*true\s*\)/i.test(line) && currentPolicyAction) {
        throw new Error(`Permissive USING (true) detected on mutation policy: ${currentPolicyAction}`);
      }
      if (line.includes(";")) {
        currentPolicyAction = "";
      }
    }
  });
});
