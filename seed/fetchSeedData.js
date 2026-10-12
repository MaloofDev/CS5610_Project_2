// Rebuilds seed/packages.json from the live npm, PyPI, and Packagist registries.
import { writeFile } from "node:fs/promises";
import { getLicenseInfo, normalizeLicenseId } from "../lib/licenses.js";

const OUTPUT_FILE = new URL("./packages.json", import.meta.url);
const NPM_TARGET = 1000;
const PYPI_TARGET = 1500;
const PACKAGIST_TARGET = 500;
const MAX_TAGS = 6;
const CONCURRENCY = 8;
const SEARCH_DELAY_MS = 2000; // npm's search API rate-limits bursts

// npm has no "top packages" list, so we take the most-downloaded results per keyword.
const NPM_KEYWORDS = [
  "chart",
  "react",
  "vue",
  "angular",
  "svelte",
  "css",
  "testing",
  "cli",
  "http",
  "server",
  "framework",
  "database",
  "orm",
  "mongodb",
  "authentication",
  "validation",
  "date",
  "logging",
  "parser",
  "markdown",
  "bundler",
  "lint",
  "typescript",
  "utility",
  "promise",
  "stream",
  "crypto",
  "image",
  "websocket",
  "graphql",
  "state-management",
  "animation",
  "ui",
  "icons",
  "i18n",
  "cache",
  "queue",
  "email",
  "pdf",
  "compression",
  "color",
  "config",
  "security",
  "editor",
  "video",
  "map",
  "sql",
  "redis",
  "aws",
  "webpack",
];

// Copyleft and unusual licenses, so audits have something to flag.
const NPM_EXTRAS = [
  "pm2",
  "tinymce",
  "ckeditor5",
  "ffmpeg-static",
  "@ffmpeg/core",
  "mupdf",
  "mariadb",
  "openpgp",
  "axe-core",
  "web-ext",
  "highcharts",
  "jszip",
  "node-forge",
  "dompurify",
  "chart.js",
  "d3",
  "recharts",
  "plotly.js",
];

const PYPI_TOP_LIST =
  "https://hugovk.dev/top-pypi-packages/top-pypi-packages.min.json";
const PYPI_EXTRAS = [
  "PyMySQL",
  "mysql-connector-python",
  "mysqlclient",
  "matplotlib",
  "plotly",
  "seaborn",
  "bokeh",
  "altair",
  "pygal",
  "PyQt5",
  "PyQt6",
  "PySide6",
  "pyinstaller",
  "PyMuPDF",
  "ansible",
  "psycopg2",
  "paramiko",
  "chardet",
  "pylint",
  "reportlab",
];

const PACKAGIST_POPULAR = "https://packagist.org/explore/popular.json";
const PACKAGIST_EXTRAS = [
  "phpmailer/phpmailer",
  "tecnickcom/tcpdf",
  "mpdf/mpdf",
  "dompdf/dompdf",
  "smarty/smarty",
  "ezyang/htmlpurifier",
  "drupal/core",
  "laravel/framework",
  "phpoffice/phpspreadsheet",
  "guzzlehttp/guzzle",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches JSON, retrying rate limits and server errors. Resolves null on 404.
 * @param {string} url
 */
async function getJSON(url, attempts = 6) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    if (attempt >= attempts) throw new Error(`${response.status} from ${url}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? retryAfter * 1000 : attempt * 5000);
  }
}

/**
 * Maps items through an async fn with at most `limit` in flight. Failed items become null.
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<(R | null)[]>} results in input order
 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]);
      } catch (err) {
        console.warn(`  skipped ${items[index]}: ${err.message}`);
        results[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function cleanTags(values) {
  const tags = values
    .map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, "-"))
    .filter((tag) => /^[a-z0-9][a-z0-9.+#-]{1,23}$/.test(tag));
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

// Converts git+https://, git://, git@host:, and github:user/repo forms to https URLs.
function cleanUrl(value) {
  let url = typeof value === "object" && value ? value.url : value;
  if (typeof url !== "string") return "";
  url = url
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  return /^https?:\/\//.test(url) ? url : "";
}

/**
 * Returns the first candidate that maps to a supported license ID.
 * Otherwise keeps a short unrecognized label as-is, or falls back to UNKNOWN.
 * @param {(string | null | undefined)[]} candidates
 * @returns {string}
 */
function resolveLicense(candidates) {
  for (const candidate of candidates) {
    const id = normalizeLicenseId(candidate);
    if (id) return id;
  }
  const label = candidates.find(
    (candidate) =>
      typeof candidate === "string" &&
      candidate.trim() &&
      candidate.length <= 40
  );
  return label && !/\n|:\/\//.test(label) ? label.trim() : "UNKNOWN";
}

function toPackage({
  name,
  ecosystem,
  version,
  license,
  description,
  homepage,
  repository,
  tags,
}) {
  return {
    name,
    ecosystem,
    version: version || "",
    license,
    licenseType: getLicenseInfo(license).type,
    description: (description || "").trim().slice(0, 500),
    homepage: homepage || "",
    repository: repository || "",
    tags,
    ownerId: null,
  };
}

function fromNpm(pkg, extraTags = []) {
  const license =
    typeof pkg.license === "object" ? pkg.license?.type : pkg.license;
  const repository = cleanUrl(pkg.links?.repository ?? pkg.repository);
  return toPackage({
    name: pkg.name,
    ecosystem: "npm",
    version: pkg.version,
    license: resolveLicense([license]),
    description: pkg.description,
    homepage: cleanUrl(pkg.links?.homepage ?? pkg.homepage) || repository,
    repository,
    tags: cleanTags([...extraTags, ...(pkg.keywords ?? [])]),
  });
}

async function fetchNpm() {
  console.log("Fetching npm packages...");
  const selected = new Map();

  const extras = await mapLimit(NPM_EXTRAS, CONCURRENCY, (name) =>
    getJSON(`https://registry.npmjs.org/${name.replace("/", "%2F")}/latest`)
  );
  for (const pkg of extras) {
    if (pkg) selected.set(pkg.name, fromNpm(pkg));
  }

  const rankedByKeyword = [];
  for (const keyword of NPM_KEYWORDS) {
    const data = await getJSON(
      `https://registry.npmjs.org/-/v1/search?text=keywords:${encodeURIComponent(keyword)}&size=100`
    );
    const results = (data?.objects ?? [])
      .filter((result) => !result.flags?.insecure && result.package.version)
      .sort(
        (a, b) => (b.downloads?.monthly ?? 0) - (a.downloads?.monthly ?? 0)
      );
    rankedByKeyword.push({ keyword, results });
    console.log(`  keywords:${keyword} -> ${results.length} results`);
    await sleep(SEARCH_DELAY_MS);
  }

  const keywordsByName = new Map();
  for (const { keyword, results } of rankedByKeyword) {
    for (const { package: pkg } of results) {
      keywordsByName.set(pkg.name, [
        ...(keywordsByName.get(pkg.name) ?? []),
        keyword,
      ]);
    }
  }

  // Round-robin through the keyword rankings so each keyword gets a fair share.
  const longest = Math.max(
    ...rankedByKeyword.map(({ results }) => results.length)
  );
  for (
    let position = 0;
    position < longest && selected.size < NPM_TARGET;
    position++
  ) {
    for (const { results } of rankedByKeyword) {
      const pkg = results[position]?.package;
      if (!pkg || selected.has(pkg.name)) continue;
      selected.set(pkg.name, fromNpm(pkg, keywordsByName.get(pkg.name)));
      if (selected.size >= NPM_TARGET) break;
    }
  }

  console.log(`  ${selected.size} npm packages`);
  return [...selected.values()];
}

function pypiUrl(urls, pattern) {
  const entry = Object.entries(urls ?? {}).find(([label]) =>
    pattern.test(label)
  );
  return entry ? cleanUrl(entry[1]) : "";
}

function fromPyPI(info) {
  const licenseClassifiers = info.classifiers
    .filter((classifier) => classifier.startsWith("License ::"))
    .map((classifier) => classifier.split("::").pop().trim());
  // Several license classifiers mean a choice, like an OR expression.
  const classifierLicense = licenseClassifiers.length
    ? licenseClassifiers.join(" OR ")
    : null;
  const shortLicense =
    info.license && info.license.length <= 100 ? info.license : null;

  const keywords = info.keywords ?? "";
  const keywordList = keywords.includes(",")
    ? keywords.split(",")
    : keywords.split(/\s+/);
  const topics = info.classifiers
    .filter((classifier) => classifier.startsWith("Topic ::"))
    .map((classifier) => classifier.split("::").pop().trim())
    .filter((topic) => !/libraries|python modules|utilities/i.test(topic));

  const homepage =
    cleanUrl(info.home_page) ||
    pypiUrl(info.project_urls, /^(home|homepage|documentation|docs)$/i);
  const repository =
    pypiUrl(info.project_urls, /source|repository|^code$|github|gitlab/i) ||
    (/github\.com|gitlab\.com/.test(homepage) ? homepage : "");

  return toPackage({
    name: info.name,
    ecosystem: "PyPI",
    version: info.version,
    license: resolveLicense([
      info.license_expression,
      shortLicense,
      classifierLicense,
      info.license,
    ]),
    description: info.summary,
    homepage: homepage || repository,
    repository,
    tags: cleanTags([...keywordList, ...topics]),
  });
}

async function fetchPyPI() {
  console.log("Fetching PyPI packages...");
  const top = await getJSON(PYPI_TOP_LIST);
  const seen = new Set();
  const names = [...PYPI_EXTRAS, ...top.rows.map((row) => row.project)].filter(
    (name) => {
      const key = name.toLowerCase().replace(/[-_.]+/g, "-");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }
  );

  // Extras cover projects that are missing or fail to fetch.
  const candidates = names.slice(0, PYPI_TARGET + 50);
  let done = 0;
  const results = await mapLimit(candidates, CONCURRENCY, async (name) => {
    const data = await getJSON(
      `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
    );
    if (++done % 100 === 0) console.log(`  ${done}/${candidates.length}`);
    return data ? fromPyPI(data.info) : null;
  });

  const packages = results.filter(Boolean).slice(0, PYPI_TARGET);
  console.log(`  ${packages.length} PyPI packages`);
  return packages;
}

/**
 * Returns the newest stable release from Packagist's minified version list.
 * Each entry only lists fields that changed from the previous one, so they're merged in order.
 * @param {object[]} versions newest first
 * @returns {object | null}
 */
function latestStableRelease(versions) {
  let release = null;
  for (const entry of versions) {
    release = { ...release, ...entry };
    for (const [key, value] of Object.entries(release)) {
      if (value === "__unset") delete release[key];
    }
    if (!/-(dev|alpha|beta|rc)/i.test(release.version_normalized ?? "")) {
      return release;
    }
  }
  return release;
}

function fromPackagist(release) {
  const repository = cleanUrl(release.source?.url);
  return toPackage({
    name: release.name,
    ecosystem: "Packagist",
    version: release.version.replace(/^v(?=\d)/, ""),
    // Composer lists dual licenses as an array.
    license: resolveLicense([(release.license ?? []).join(" OR ")]),
    description: release.description,
    homepage: cleanUrl(release.homepage) || repository,
    repository,
    tags: cleanTags(release.keywords ?? []),
  });
}

async function fetchPackagist() {
  console.log("Fetching Packagist packages...");
  const names = new Set(PACKAGIST_EXTRAS);
  for (let page = 1; names.size < PACKAGIST_TARGET + 50; page++) {
    const data = await getJSON(
      `${PACKAGIST_POPULAR}?per_page=100&page=${page}`
    );
    if (!data?.packages.length) break;
    for (const { name } of data.packages) names.add(name);
    await sleep(500);
  }

  const candidates = [...names].slice(0, PACKAGIST_TARGET + 50);
  const results = await mapLimit(candidates, CONCURRENCY, async (name) => {
    const data = await getJSON(`https://repo.packagist.org/p2/${name}.json`);
    const release = latestStableRelease(data?.packages[name] ?? []);
    return release ? fromPackagist(release) : null;
  });

  const packages = results.filter(Boolean).slice(0, PACKAGIST_TARGET);
  console.log(`  ${packages.length} Packagist packages`);
  return packages;
}

const packages = [
  ...(await fetchNpm()),
  ...(await fetchPyPI()),
  ...(await fetchPackagist()),
];
await writeFile(OUTPUT_FILE, `${JSON.stringify(packages, null, 2)}\n`);

const byType = Object.groupBy(packages, (pkg) => pkg.licenseType);
const summary = Object.entries(byType)
  .map(([type, list]) => `${type}: ${list.length}`)
  .join(", ");
console.log(
  `Wrote ${packages.length} packages to seed/packages.json (${summary})`
);
