import { readFileSync } from "node:fs";

const LICENSES = JSON.parse(
  readFileSync(new URL("./licenses.json", import.meta.url), "utf8")
);
const byId = new Map(
  LICENSES.map((license) => [license.id.toLowerCase(), license])
);
const unknownLicense = byId.get("unknown");

export const LICENSE_TYPES = [
  "permissive",
  "weak-copyleft",
  "strong-copyleft",
  "unknown",
];

// Lower is more permissive.
const TYPE_RANK = Object.fromEntries(
  LICENSE_TYPES.map((type, index) => [type, index])
);

// Deprecated SPDX IDs that registries still use.
const ALIASES = {
  "gpl-2.0": "GPL-2.0-only",
  "gpl-2.0+": "GPL-2.0-or-later",
  "gpl-3.0": "GPL-3.0-only",
  "gpl-3.0+": "GPL-3.0-or-later",
  "lgpl-2.0": "LGPL-2.0-only",
  "lgpl-2.0+": "LGPL-2.0-or-later",
  "lgpl-2.1": "LGPL-2.1-only",
  "lgpl-2.1+": "LGPL-2.1-or-later",
  "lgpl-3.0": "LGPL-3.0-only",
  "lgpl-3.0+": "LGPL-3.0-or-later",
  "agpl-3.0": "AGPL-3.0-only",
  "agpl-3.0+": "AGPL-3.0-or-later",
  python: "Python-2.0",
  "python license": "Python-2.0",
};

/** @returns {{ id: string, name: string, type: string, explanation: string }[]} */
export function listLicenses() {
  return LICENSES.map(({ id, name, type, explanation }) => ({
    id,
    name,
    type,
    explanation,
  }));
}

/**
 * Looks up a license by ID, accepting loose spellings like "Apache 2.0".
 * @param {string} id
 * @returns {{ id: string, name: string, type: string, explanation: string }} type is "unknown" if unrecognized
 */
export function getLicenseInfo(id) {
  const license = byId.get(normalizeLicenseId(id)?.toLowerCase());
  if (license) {
    const { name, type, explanation } = license;
    return { id: license.id, name, type, explanation };
  }
  const label =
    typeof id === "string" && id.trim() ? id.trim() : unknownLicense.id;
  return {
    id: label,
    name: label,
    type: "unknown",
    explanation: unknownLicense.explanation,
  };
}

/**
 * Maps registry license text (SPDX ID or expression, PyPI classifier, or full text) to a supported ID.
 * @param {string} raw
 * @returns {string | null} null when the license can't be identified
 */
export function normalizeLicenseId(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const text = raw.trim();

  const alternatives = splitAlternatives(text);
  if (!alternatives) return normalizeTerm(text);

  // AND: the strictest part applies. OR: the user may pick the most permissive option.
  const choices = alternatives.map((option) => {
    const parts = option.split(/\s+AND\s+/).map(normalizeTerm);
    if (parts.includes(null)) return null;
    return parts.reduce((strictest, id) =>
      rank(id) > rank(strictest) ? id : strictest
    );
  });
  const known = choices.filter(Boolean);
  if (known.length === 0) return null;
  return known.reduce((loosest, id) =>
    rank(id) < rank(loosest) ? id : loosest
  );
}

// SPDX operators are uppercase, so prose like "v2 or later" isn't split.
function splitAlternatives(text) {
  if (text.length > 120) return null;
  if (/ (OR|AND) /.test(text))
    return text.replace(/[()]/g, " ").split(/\s+OR\s+/);
  if (text.includes("/") && !text.includes("://")) return text.split("/");
  return null;
}

function rank(id) {
  return TYPE_RANK[byId.get(id.toLowerCase())?.type ?? "unknown"];
}

function normalizeTerm(term) {
  const text = term
    .trim()
    .replace(/^\(+|\)+$/g, "")
    .replace(/\s+WITH\s+.*$/, "")
    .trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  if (byId.has(lower)) return byId.get(lower).id;
  if (ALIASES[lower]) return ALIASES[lower];
  if (/^(licenseref-|see license)/.test(lower)) return null;
  return guessFromText(lower);
}

// Copyleft checks run first so a GPL text that mentions other licenses stays GPL.
function guessFromText(text) {
  // The Python license text calls itself "GPL-compatible".
  const s = text.replace(/gpl[- ]compatible/g, "");
  const orLater = /or[ -]later|any later version|\d\+|gpl\+/.test(s);
  const suffix = orLater ? "-or-later" : "-only";
  const version = s.match(
    /(?:gpl|license|licence|version|\bv)[\s-]*v?([123])(?:\.(\d))?/
  );
  const major = version?.[1];
  const minor = version?.[2];

  if (/python software foundation|\bpsf\b/.test(s)) return "PSF-2.0";
  if (/affero|\bagpl/.test(s)) return `AGPL-3.0${suffix}`;
  if (/server side public|\bsspl/.test(s)) return "SSPL-1.0";
  if (/lesser general public|library general public|\blgpl/.test(s)) {
    // No version number means any version may be used.
    if (!major) return "LGPL-2.1-or-later";
    if (major === "3") return `LGPL-3.0${suffix}`;
    return minor === "1" ? `LGPL-2.1${suffix}` : `LGPL-2.0${suffix}`;
  }
  if (/general public license|\bgpl/.test(s)) {
    if (major === "3") return `GPL-3.0${suffix}`;
    if (major === "2") return `GPL-2.0${suffix}`;
    return "GPL-2.0-or-later";
  }
  if (/mozilla public|\bmpl\b/.test(s))
    return /1\.1/.test(s) ? "MPL-1.1" : "MPL-2.0";
  if (/eclipse public|\bepl\b/.test(s))
    return /1\.0/.test(s) ? "EPL-1.0" : "EPL-2.0";
  if (/common development and distribution|\bcddl\b/.test(s)) {
    return /1\.1/.test(s) ? "CDDL-1.1" : "CDDL-1.0";
  }
  if (/artistic/.test(s)) return "Artistic-2.0";
  if (/apache/.test(s)) return "Apache-2.0";
  if (/boost software|\bbsl\b/.test(s)) return "BSL-1.0";
  if (/\bisc\b|\biscl\b/.test(s)) return "ISC";
  if (/\b0bsd\b|zero.clause bsd/.test(s)) return "0BSD";
  if (/bsd|redistribution and use in source and binary forms/.test(s)) {
    if (/2.clause|simplified|freebsd/.test(s)) return "BSD-2-Clause";
    if (s.length > 200 && !/neither the name/.test(s)) return "BSD-2-Clause";
    return "BSD-3-Clause";
  }
  if (/mit no attribution|\bmit-0\b/.test(s)) return "MIT-0";
  if (/\bmit\b|\bexpat\b|permission is hereby granted, free of charge/.test(s))
    return "MIT";
  if (/\bunlicense\b/.test(s)) return "Unlicense";
  if (/\bcc0\b|creative commons zero/.test(s)) return "CC0-1.0";
  if (/public domain/.test(s)) return "Public-Domain";
  if (/\bzlib\b/.test(s)) return "Zlib";
  if (/historical permission notice|\bhpnd\b/.test(s)) return "HPND";
  if (/blue ?oak/.test(s)) return "BlueOak-1.0.0";
  if (/wtfpl|do what the f/.test(s)) return "WTFPL";
  if (/postgresql/.test(s)) return "PostgreSQL";
  if (/creative commons attribution|\bcc-by\b/.test(s)) {
    if (/share.?alike|non.?commercial|no.?deriv|-sa\b|-nc\b|-nd\b/.test(s))
      return null;
    return /3\.0/.test(s) ? "CC-BY-3.0" : "CC-BY-4.0";
  }
  return null;
}
