import { describe, expect, it } from "vitest";
import { allPseoPages, buildPseoPage, PROFESSIONS, STATES, slugify } from "../apps/invoicing/src/content/pseo";
import { validateGstin } from "@sreorg/tax-india";

describe("programmatic SEO surface", () => {
  it("generates a page for every profession and state", () => {
    expect(allPseoPages()).toHaveLength(PROFESSIONS.length * STATES.length);
  });

  it("produces unique slugs", () => {
    const slugs = allPseoPages().map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("returns null for an unknown profession or state", () => {
    expect(buildPseoPage("astronaut", "karnataka")).toBeNull();
    expect(buildPseoPage("freelance-designer", "atlantis")).toBeNull();
  });

  it("carries the state code through to the page", () => {
    const page = buildPseoPage("software-developer", "karnataka")!;
    expect(page.state.code).toBe("29");
    expect(page.title).toContain("Karnataka");
  });

  it("slugifies names with ampersands and spaces", () => {
    expect(slugify("Jammu & Kashmir")).toBe("jammu-and-kashmir");
    expect(slugify("Tamil Nadu")).toBe("tamil-nadu");
  });

  it("uses a SAC code, not an HSN code, for every profession", () => {
    // Services sit in SAC chapter 99; goods HSN codes never start with 99.
    for (const p of PROFESSIONS) {
      expect(p.sac).toMatch(/^99\d{4}$/);
    }
  });

  it("keeps every state code recognised by the GSTIN validator", () => {
    for (const state of STATES) {
      const probe = validateGstin(`${state.code}AAGCB7383J1ZN`);
      // The checksum digit will usually be wrong for this synthetic GSTIN, but
      // the state code must never be the reason it is rejected.
      expect(probe.reason ?? "").not.toMatch(/Unknown state code/);
    }
  });
});
