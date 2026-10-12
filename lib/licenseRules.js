import { getLicenseInfo } from "./licenses.js";

export const GOAL_TYPES = ["closed-source", "open-source"];

/** Each audit status and the summary color it counts toward. */
export const STATUS_COLORS = {
  ok: "green",
  conditions: "yellow",
  review: "yellow",
  conflict: "red",
};

// The GPL-family licenses a dependency's code can be combined into.
// Permissive licenses that aren't listed fit all three.
const ANY_GPL = ["GPL-2.0", "GPL-3.0", "AGPL-3.0"];
const GPL3_AND_UP = ["GPL-3.0", "AGPL-3.0"];
const GPL_COMBINABLE = {
  "Apache-2.0": GPL3_AND_UP,
  "GPL-2.0-only": ["GPL-2.0"],
  "GPL-2.0-or-later": ANY_GPL,
  "GPL-3.0-only": GPL3_AND_UP,
  "GPL-3.0-or-later": GPL3_AND_UP,
  "AGPL-3.0-only": ["AGPL-3.0"],
  "AGPL-3.0-or-later": ["AGPL-3.0"],
  "LGPL-2.0-only": ANY_GPL,
  "LGPL-2.0-or-later": ANY_GPL,
  "LGPL-2.1-only": ANY_GPL,
  "LGPL-2.1-or-later": ANY_GPL,
  "LGPL-3.0-only": GPL3_AND_UP,
  "LGPL-3.0-or-later": GPL3_AND_UP,
  "MPL-2.0": ANY_GPL,
  "Artistic-2.0": ANY_GPL,
};

// The GPL versions a project under each goal license can ship as.
const PROJECT_GPL = {
  "GPL-2.0-only": ["GPL-2.0"],
  "GPL-2.0-or-later": ["GPL-2.0", "GPL-3.0"],
  "GPL-3.0-only": ["GPL-3.0"],
  "GPL-3.0-or-later": ["GPL-3.0"],
  "AGPL-3.0-only": ["AGPL-3.0"],
  "AGPL-3.0-or-later": ["AGPL-3.0"],
};

/**
 * Decides whether a dependency's license fits the project's goal.
 * @param {string} license the dependency's license ID or registry text
 * @param {{ type: string, license?: string }} goal
 * @returns {{ status: "ok" | "conditions" | "review" | "conflict", reason: string }}
 */
export function evaluateLicense(license, goal) {
  const dep = getLicenseInfo(license);
  if (dep.type === "unknown") {
    return result(
      "review",
      dep.id === "UNLICENSED"
        ? "Marked UNLICENSED, so all rights are reserved. Ask the authors before using it."
        : `LicenseLens can't read its license ("${dep.id}"). Check it by hand.`
    );
  }

  if (goal.type === "closed-source") {
    if (dep.type === "permissive") return result("ok", "Permissive.");
    if (dep.type === "weak-copyleft") {
      return result(
        "conditions",
        "Weak copyleft. Your code can stay closed, but changes to this package must be shared."
      );
    }
    return result(
      "conflict",
      "Strong copyleft. Shipping it would require releasing your source."
    );
  }

  const project = getLicenseInfo(goal.license);
  if (dep.id === project.id)
    return result("ok", "Same license as your project.");
  if (PROJECT_GPL[project.id]) return checkGplProject(dep, project);

  if (dep.type === "permissive") return result("ok", "Permissive.");
  if (dep.type === "weak-copyleft") {
    return result(
      "conditions",
      `Weak copyleft. Its own files stay under ${dep.id}, and changes to them must be shared.`
    );
  }
  return result(
    "conflict",
    `Strong copyleft. The whole project would have to ship under ${dep.id}, not ${project.id}.`
  );
}

function checkGplProject(dep, project) {
  const targets = PROJECT_GPL[project.id];
  const combinable =
    GPL_COMBINABLE[dep.id] ?? (dep.type === "permissive" ? ANY_GPL : []);
  const shared = targets.filter((version) => combinable.includes(version));

  if (shared.length === targets.length) {
    return result("ok", `Compatible with ${project.id}.`);
  }
  if (shared.length > 0) {
    return result(
      "conditions",
      `Only compatible with ${shared[0]}, so the project must ship under that version.`
    );
  }
  // GPL-3.0 section 13 allows combining with AGPL-3.0 code.
  if (dep.id.startsWith("AGPL") && targets.includes("GPL-3.0")) {
    return result(
      "conditions",
      "Allowed with GPL-3.0, but the AGPL network rule then covers the combined program."
    );
  }
  return result("conflict", `${dep.id} can't be combined with ${project.id}.`);
}

function result(status, reason) {
  return { status, reason };
}
