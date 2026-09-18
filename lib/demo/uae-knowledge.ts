/**
 * Single source of truth for the UAE/Dubai production demo.
 *
 * Source: Google Drive — "03 - Stallion AI Assistant - Edition Configuration - UAE Test"
 * https://docs.google.com/document/d/15DQivImAUT1TdbRBOdiSSW8ahkfADD5Vgkyvngkibdw/edit
 *
 * This module deliberately contains NO India data. Unknown current-edition
 * facts remain null / unconfirmed rather than being inferred from old website
 * dates or another event.
 */
import config from "@/content/editions/UAE-GMM-2026-TEST/config.json";

export const UAE_EVENT = {
  slug: "UAE-GMM-2026-TEST",
  name: "The 4th Edition of The Great Marketing & Business Minds UAE 2026",
  country: "AE",
  year: 2026,
  editionNumber: 4,
  status: "draft",
  eventDate: null,
  venue: null,
  eligibilityPeriod: null,
  nominationOpen: null,
  nominationDeadline: null,
  fees: null,
  taxes: null,
  contact: {
    team: "Digital Stallions Forum UAE",
    email: "paurush.sonkar@icloud.com",
    phone: null,
    whatsapp: null,
    website: "https://thegreatmarketingminds.ae/",
  },
  sponsors: null,
  announcements: null,
} as const;

export type UaeCategory = {
  name: string;
  officialName: string | null;
  description: string | null;
  eligibilityRules: {
    summary?: string;
    requirements?: string[];
    deterministic?: Record<string, string | number | boolean>;
  } | null;
  clientApprovalRequired: boolean;
};

export const UAE_CATEGORIES: UaeCategory[] = config.categories.map((c) => ({
  name: c.name,
  officialName: c.official_name ?? null,
  description: c.description ?? null,
  eligibilityRules: c.eligibility_rules ?? null,
  clientApprovalRequired: c.client_approval_required ?? false,
}));

export const UAE_PUBLIC_JURY = config.jury.map((j) => ({
  name: j.name,
  details: j.details ?? null,
}));

const CATEGORY_CATALOGUE = UAE_CATEGORIES.map((c) => `- ${c.name}`).join("\n");
const JURY_CATALOGUE = UAE_PUBLIC_JURY.map(
  (j) => `- ${j.name}${j.details ? ` — ${j.details}` : ""}`,
).join("\n");

export const UAE_KNOWLEDGE_SECTIONS = [
  {
    id: "uae-overview",
    title: "UAE event overview",
    keywords: ["event", "about", "purpose", "uae", "dubai", "marketing", "business", "who"],
    content: `The active demo is The 4th Edition of The Great Marketing & Business Minds UAE 2026, an initiative of Digital Stallions Forum UAE. Its stated purpose is to recognise and celebrate marketers, digital marketers, business leaders, their teams and agency partners, and marketing, digital marketing and business achievement across the UAE.

The public organiser contact captured for this UAE event is Paurush Sonkar, Founder, Digital Stallions Forum UAE. Email: paurush.sonkar@icloud.com.

The next/current event date and venue are NOT confirmed in the approved demo information. Do not infer them.`,
  },
  {
    id: "uae-participation-process",
    title: "UAE participation and nomination process",
    keywords: ["nominate", "nomination", "participate", "entry", "entries", "form", "register", "registration", "fee", "cost", "deadline", "date", "venue", "winner"],
    content: `Historical website information for the 2026 edition says interested participants emailed the categories they wanted to enter; forms were then emailed to them; entrants completed the forms and returned them by email. The website asked entrants to complete forms carefully and concisely and, where possible, provide links to websites, social media pages, videos and other relevant material for jury review.

The historical website stated that award nominations were free. It also stated that winners had to pay a fee per winning award entry to attend the event, networking session and collect the trophy, but the amount of that winner fee was NOT stated and is unconfirmed.

Historical dates only: campaign eligibility shown was 1 January 2025 to 31 December 2025, and the last award-entry submission date shown was 19 January 2026. These are historical facts for the old edition and MUST NOT be presented as the deadline or eligibility period for the next event.

There is currently no approved nomination form URL in this demo knowledge. If a visitor wants to participate, collect their interest/contact details with permission or offer the organiser/team route rather than inventing a form URL.`,
  },
  {
    id: "uae-current-facts",
    title: "UAE current-edition confirmation rules",
    keywords: ["current", "next", "when", "where", "deadline", "venue", "price", "fee", "fees", "cost", "vat", "date", "open", "eligibility"],
    content: `For the current/next UAE event, the event date, venue, new submission deadline, current eligibility period, current fee/winner charge amount, taxes, and nomination form URL are not confirmed in the approved demo information.

If asked for one of those current facts, say: "I don't have confirmed information about that in the current event information. I can help pass the question to the team."

Never convert the old 2025 category years or historical 2026 deadline into a current date or year automatically. Never invent a fee, discount, extension, exception or winner prediction.`,
  },
  {
    id: "uae-categories",
    title: "UAE category templates captured from the website",
    keywords: ["category", "categories", "campaign", "agency", "brand", "individual", "cmo", "ceo", "seo", "sem", "social", "content", "mobile", "app", "lead", "b2b", "b2c", "fintech", "insurance", "loyalty", "crm", "analytics", "automation", "pr", "marketing"],
    content: `The following are UAE award CATEGORY TEMPLATES captured from the previous website. The website labelled them 2025 while referring elsewhere to the 4th Edition 2026. They may be used for advisory category matching in this demo, but their exact current-edition wording and availability must be confirmed by the organiser. Never guarantee eligibility.

${CATEGORY_CATALOGUE}`,
  },
  {
    id: "uae-jury",
    title: "Public jury panel shown for the 4th Edition 2026",
    keywords: ["jury", "judge", "judges", "panel", "judging"],
    content: `The website publicly listed the following jury panel for the 4th Edition 2026. This is public historical/current-website information and should be reconfirmed before a future edition. Do not provide scores, votes, private comments or deliberations.

${JURY_CATALOGUE}

The website displayed Vidisha Debsarkar twice with a title variation. Do not reconcile that variation by guessing.`,
  },
  {
    id: "uae-sponsorship",
    title: "UAE sponsorship and partnership",
    keywords: ["sponsor", "sponsorship", "partner", "partnership", "commercial", "package", "discount"],
    content: `The UAE website invites sponsorship enquiries and directs them to Paurush Sonkar at paurush.sonkar@icloud.com. No sponsorship pricing or custom package price is confirmed in the approved demo information. Any pricing, discount, custom package or commercial negotiation must be escalated to the organiser/team.`,
  },
] as const;

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Lightweight deterministic category ranking for the demo. It ranks only the
 * approved UAE category names; it never creates a new category.
 */
export function rankUaeCategories(description: string, limit = 5): UaeCategory[] {
  const query = new Set(words(description));
  const scored = UAE_CATEGORIES.map((category, index) => {
    const nameWords = words(category.name);
    let score = nameWords.reduce((n, w) => n + (query.has(w) ? 4 : 0), 0);

    const q = description.toLowerCase();
    const n = category.name.toLowerCase();
    const hints: Array<[RegExp, string[]]> = [
      [/social|instagram|facebook|linkedin|youtube|influencer/, ["social", "instagram", "facebook", "linkedin", "youtube", "influencer"]],
      [/seo|organic search/, ["seo", "search engine optimization"]],
      [/sem|paid search|google ads|adwords/, ["sem", "search engine marketing", "adwords"]],
      [/content|article|video|podcast/, ["content", "youtube", "marketing communications"]],
      [/mobile|app/, ["mobile", "app"]],
      [/lead|acquisition|performance/, ["lead", "roi", "digital marketing campaign"]],
      [/brand|branding|rebrand|launch/, ["brand", "branding", "re-branding", "new brand launch"]],
      [/automation|crm|lifecycle/, ["automation", "crm", "clcm", "lifecycle"]],
      [/analytics|data|insight/, ["analytics", "data", "consumer insights"]],
      [/agency/, ["agency"]],
      [/pr|public relations|communication/, ["pr", "communication"]],
      [/fintech|payment|wallet|bnpl|loan|lending/, ["fintech", "payment", "wallet", "bnpl", "loan", "lending"]],
      [/insurance|insurtech|claims/, ["insurance", "insurtech", "claims"]],
      [/loyalty|retention/, ["loyalty", "customer engagement"]],
      [/b2b/, ["b2b"]],
      [/b2c|consumer/, ["b2c", "consumer"]],
      [/ui|ux|website|design/, ["ui", "ux", "website design"]],
    ];
    for (const [pattern, needles] of hints) {
      if (pattern.test(q) && needles.some((needle) => n.includes(needle))) score += 7;
    }
    return { category, score, index };
  });

  const ranked = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.category);

  // No lexical match: return a small varied subset rather than pretend certainty.
  return ranked.length ? ranked : UAE_CATEGORIES.slice(0, Math.min(limit, UAE_CATEGORIES.length));
}
