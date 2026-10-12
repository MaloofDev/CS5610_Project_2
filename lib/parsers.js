export const INPUT_TYPES = ["package.json", "requirements.txt", "plain-list"];

const MAX_DEPENDENCIES = 500;
// devDependencies are skipped because they don't ship with the app.
const PACKAGE_JSON_FIELDS = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
];
const REQUIREMENT = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[[^\]]*\])?\s*(.*)$/;
// pip options, local paths, and URLs don't name a registry package.
const PIP_SKIPPED = /^(-|\.|\/|[a-z][a-z0-9+]*:)/i;
// "name", "name 1.2", "name@1.2", "@scope/name@1.2", "name==1.2", "name>=1.2"
const PLAIN_ENTRY = /^(@?[\w.\-/]+?)(?:[\s=@:]+(\S.*)|([<>~!^].*))?$/;

const PARSERS = {
  "package.json": parsePackageJson,
  "requirements.txt": parseRequirements,
  "plain-list": parsePlainList,
};

/**
 * Turns pasted dependency text into rows, deduplicated by name.
 * Throws an Error with a user-facing message when the text can't be read.
 * @param {string} inputType one of INPUT_TYPES
 * @param {string} text
 * @returns {{ name: string, version: string }[]}
 */
export function parseDependencies(inputType, text) {
  const unique = new Map();
  for (const row of PARSERS[inputType](text)) {
    const key = row.name.toLowerCase();
    if (!unique.has(key)) unique.set(key, row);
  }

  if (unique.size === 0) throw new Error("No dependencies found.");
  if (unique.size > MAX_DEPENDENCIES) {
    throw new Error(`An audit can check up to ${MAX_DEPENDENCIES} packages.`);
  }
  return [...unique.values()];
}

function parsePackageJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That isn't valid JSON. Paste the whole package.json.");
  }

  return PACKAGE_JSON_FIELDS.flatMap((field) =>
    Object.entries(data?.[field] ?? {}).map(([name, version]) => ({
      name: name.trim(),
      version: typeof version === "string" ? version.trim() : "",
    }))
  ).filter((row) => row.name);
}

function parseRequirements(text) {
  // Joins "\" line continuations so their --hash options get dropped below.
  const lines = text.replace(/\\\r?\n/g, " ").split(/\r?\n/);

  return lines.flatMap((rawLine, index) => {
    // Drops comments, inline options like --hash, and environment markers.
    const line = rawLine
      .replace(/(^|\s)#.*$/, "")
      .split(/\s+-/)[0]
      .split(";")[0]
      .trim();
    if (!line || PIP_SKIPPED.test(line)) return [];

    const match = line.match(REQUIREMENT);
    if (!match) throw lineError(index, rawLine);
    // "==1.2" becomes "1.2", ranges stay as written, and "@ url" has no version.
    const spec = match[2].replace(/\s+/g, "");
    const version = spec.startsWith("@")
      ? ""
      : spec.replace(/^===?(?!.*,)/, "");
    return [{ name: match[1], version }];
  });
}

function parsePlainList(text) {
  return text.split(/\r?\n/).flatMap((rawLine, index) => {
    const line = rawLine.replace(/(^|\s)(#|\/\/).*$/, "").trim();
    if (!line) return [];

    // Splits "a, b, c" but not version ranges like "a>=1,<2".
    return line.split(/,\s*(?=[@A-Za-z])/).map((entry) => {
      const match = entry.trim().match(PLAIN_ENTRY);
      if (!match) throw lineError(index, rawLine);
      const version = (match[2] ?? match[3] ?? "").replace(/["']/g, "");
      return { name: match[1], version };
    });
  });
}

function lineError(index, line) {
  return new Error(
    `Line ${index + 1} doesn't look like a package: "${line.trim().slice(0, 60)}"`
  );
}
