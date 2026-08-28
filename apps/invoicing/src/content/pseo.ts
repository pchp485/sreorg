import { STATE_CODES } from "@sreorg/tax-india";
import { slugify, stateSlugs } from "@sreorg/growth";

/**
 * Programmatic SEO surface. Every page here is a real answer to a real query
 * ("gst invoice format for freelance designers in karnataka") attached to a
 * working free tool — thin doorway pages get deindexed, useful ones don't.
 *
 * States x professions gives ~1,000 long-tail pages from two small lists,
 * which is the entire acquisition channel at zero marginal cost.
 */

export interface Profession {
  slug: string;
  label: string;
  /** Plural, used in headings: "freelance designers" */
  plural: string;
  sac: string;
  gstRate: 5 | 12 | 18;
  tdsSection: "194J" | "194C_individual" | "194H";
  typicalServices: string[];
}

export const PROFESSIONS: Profession[] = [
  { slug: "freelance-designer", label: "Freelance Designer", plural: "freelance designers", sac: "998391", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Brand identity design", "UI/UX design retainer", "Social media creatives"] },
  { slug: "software-developer", label: "Software Developer", plural: "software developers", sac: "998314", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Web application development", "API integration", "Monthly maintenance retainer"] },
  { slug: "digital-marketer", label: "Digital Marketing Consultant", plural: "digital marketers", sac: "998365", gstRate: 18, tdsSection: "194J",
    typicalServices: ["SEO retainer", "Performance marketing management", "Content strategy"] },
  { slug: "content-writer", label: "Content Writer", plural: "content writers", sac: "998393", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Blog articles", "Website copy", "Technical documentation"] },
  { slug: "chartered-accountant", label: "Chartered Accountant", plural: "chartered accountants", sac: "998222", gstRate: 18, tdsSection: "194J",
    typicalServices: ["GST return filing", "Income tax filing", "Statutory audit"] },
  { slug: "photographer", label: "Photographer", plural: "photographers", sac: "998383", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Event photography", "Product shoot", "Photo editing"] },
  { slug: "video-editor", label: "Video Editor", plural: "video editors", sac: "998387", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Short-form editing retainer", "Colour grading", "Motion graphics"] },
  { slug: "management-consultant", label: "Management Consultant", plural: "management consultants", sac: "998311", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Strategy engagement", "Process audit", "Advisory retainer"] },
  { slug: "interior-designer", label: "Interior Designer", plural: "interior designers", sac: "998392", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Design concept and drawings", "Site supervision", "Turnkey execution"] },
  { slug: "tutor", label: "Private Tutor", plural: "private tutors", sac: "999293", gstRate: 18, tdsSection: "194J",
    typicalServices: ["Monthly coaching fee", "Exam crash course", "One-to-one sessions"] },
  { slug: "event-manager", label: "Event Manager", plural: "event managers", sac: "998596", gstRate: 18, tdsSection: "194C_individual",
    typicalServices: ["Event production", "Vendor coordination", "On-ground execution"] },
  { slug: "recruitment-consultant", label: "Recruitment Consultant", plural: "recruitment consultants", sac: "998511", gstRate: 18, tdsSection: "194H",
    typicalServices: ["Placement fee", "Contract staffing", "Executive search"] },
];

export interface StateInfo { code: string; name: string; slug: string; }

export const STATES: StateInfo[] = stateSlugs(STATE_CODES);

export { slugify };

export interface PseoPage {
  slug: string;
  title: string;
  description: string;
  profession: Profession;
  state: StateInfo;
}

/** slug shape: /invoice/<profession>/<state> */
export function buildPseoPage(professionSlug: string, stateSlug: string): PseoPage | null {
  const profession = PROFESSIONS.find((p) => p.slug === professionSlug);
  const state = STATES.find((s) => s.slug === stateSlug);
  if (!profession || !state) return null;

  return {
    slug: `${professionSlug}/${stateSlug}`,
    title: `GST Invoice Format for ${profession.plural} in ${state.name} (${new Date().getFullYear()})`,
    description: `Free GST-compliant invoice format for ${profession.plural} registered in ${state.name}. Correct SAC code ${profession.sac}, ${profession.gstRate}% GST, CGST/SGST vs IGST handled automatically, plus the TDS your client will deduct.`,
    profession,
    state,
  };
}

export function allPseoPages(): PseoPage[] {
  const pages: PseoPage[] = [];
  for (const p of PROFESSIONS) {
    for (const s of STATES) {
      const page = buildPseoPage(p.slug, s.slug);
      if (page) pages.push(page);
    }
  }
  return pages;
}
