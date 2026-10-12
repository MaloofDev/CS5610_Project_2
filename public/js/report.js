import {
  api,
  confirmDelete,
  dateElement,
  goalLabel,
  inputLabel,
  summaryBadges,
} from "./reportUtils.js";

// A missing id becomes "null", which the server answers with 404.
const apiUrl = `/api/reports/${encodeURIComponent(
  new URLSearchParams(location.search).get("id")
)}`;

const article = document.getElementById("report");
const nameHeading = document.getElementById("report-name");
const renameButton = document.getElementById("rename-button");
const renameForm = document.getElementById("rename-form");
const rerunButton = document.getElementById("rerun-button");
const filters = document.getElementById("result-filters");
const tableWrap = document.getElementById("results-table");
const tbody = document.getElementById("results-body");
const noResults = document.getElementById("no-results");
const statusMessage = document.getElementById("report-status");
const errorMessage = document.getElementById("report-error");
const loginNotice = document.getElementById("login-notice");

// Listed in the default sort order: conflicts first.
const STATUSES = {
  conflict: { label: "Conflict", badge: "badge-conflict" },
  conditions: { label: "Conditions", badge: "badge-review" },
  review: { label: "Review needed", badge: "badge-review" },
  ok: { label: "OK", badge: "badge-ok" },
};
const STATUS_ORDER = Object.keys(STATUSES);

let report;

// Packages that aren't in the database have no license.
const licenseLabel = (row) => row.license ?? "Unknown";

function renderReport() {
  document.title = `${report.name} · LicenseLens`;
  nameHeading.textContent = report.name;
  document
    .getElementById("report-meta")
    .replaceChildren(
      "Updated ",
      dateElement(report.updatedAt),
      `. Goal: ${goalLabel(report.goal)}. Input: ${inputLabel(report)}.`
    );
  document
    .getElementById("report-summary")
    .replaceChildren(summaryBadges(report.summary));

  // Re-runs can change which licenses appear.
  const select = filters.elements.license;
  const current = select.value;
  const licenses = [...new Set(report.results.map(licenseLabel))].sort();
  select.replaceChildren(
    new Option("All", ""),
    ...licenses.map((license) => new Option(license, license))
  );
  select.value = licenses.includes(current) ? current : "";

  renderResults();
  article.hidden = false;
}

function renderResults() {
  const { status, license } = filters.elements;
  const rows = report.results
    .filter(
      (row) =>
        (!status.value || row.status === status.value) &&
        (!license.value || licenseLabel(row) === license.value)
    )
    .sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    );
  tbody.replaceChildren(...rows.map(renderRow));
  tableWrap.hidden = rows.length === 0;
  noResults.hidden = rows.length > 0;
}

function renderRow(row) {
  const tr = document.createElement("tr");
  for (const content of [
    row.packageId ? packageLink(row.packageId, row.name) : row.name,
    row.version || "—",
    badge(licenseLabel(row)),
    badge(STATUSES[row.status].label, STATUSES[row.status].badge),
    reason(row),
    alternatives(row),
  ]) {
    const cell = document.createElement("td");
    cell.append(content);
    tr.append(cell);
  }
  return tr;
}

function badge(text, className = "") {
  const span = document.createElement("span");
  span.className = `badge ${className}`;
  span.textContent = text;
  return span;
}

function packageLink(id, text) {
  const a = document.createElement("a");
  a.href = `/package.html?id=${encodeURIComponent(id)}`;
  a.textContent = text;
  return a;
}

function reason(row) {
  if (row.packageId) return row.reason;

  // Add Package can prefill its form from these parameters.
  const params = new URLSearchParams({
    name: row.name,
    ecosystem: report.ecosystem,
    version: row.version,
  });
  const add = document.createElement("a");
  add.href = `/package-form.html?${params}`;
  add.textContent = "Add this package";
  const wrap = document.createElement("span");
  wrap.append(`${row.reason} `, add);
  return wrap;
}

function alternatives(row) {
  if (row.alternatives.length === 0) {
    return row.status === "conflict" ? "No permissive match found." : "";
  }
  const list = document.createElement("ul");
  list.className = "alternative-list";
  for (const alternative of row.alternatives) {
    const item = document.createElement("li");
    item.append(
      packageLink(alternative.packageId, alternative.name),
      ` (${alternative.license})`
    );
    list.append(item);
  }
  return list;
}

function setRenaming(isRenaming) {
  nameHeading.hidden = isRenaming;
  renameButton.hidden = isRenaming;
  renameForm.hidden = !isRenaming;
  if (isRenaming) {
    renameForm.elements.name.value = report.name;
    renameForm.elements.name.select();
  } else {
    renameButton.focus();
  }
}

async function update(message, request) {
  errorMessage.textContent = "";
  statusMessage.textContent = "";
  try {
    report = await request();
    renderReport();
    statusMessage.textContent = message;
    return true;
  } catch (err) {
    errorMessage.textContent = err.message;
    return false;
  }
}

renameButton.addEventListener("click", () => setRenaming(true));
document
  .getElementById("rename-cancel")
  .addEventListener("click", () => setRenaming(false));
renameForm.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setRenaming(false);
});

renameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const renamed = await update("Report renamed.", () =>
    api(apiUrl, {
      method: "PATCH",
      body: { name: renameForm.elements.name.value },
    })
  );
  if (renamed) setRenaming(false);
});

rerunButton.addEventListener("click", async () => {
  rerunButton.disabled = true;
  rerunButton.textContent = "Re-running...";
  await update("Re-checked against the current package database.", () =>
    api(`${apiUrl}/rerun`, { method: "POST" })
  );
  rerunButton.disabled = false;
  rerunButton.textContent = "Re-run";
});

document.getElementById("delete-button").addEventListener("click", async () => {
  if (!(await confirmDelete(report.name))) return;
  try {
    await api(apiUrl, { method: "DELETE" });
    location.href = "/reports.html";
  } catch (err) {
    errorMessage.textContent = err.message;
  }
});

filters.addEventListener("change", renderResults);
document.getElementById("clear-filters").addEventListener("click", () => {
  filters.reset();
  renderResults();
});

try {
  report = await api(apiUrl);
  renderReport();
} catch (err) {
  if (loginNotice.hidden) errorMessage.textContent = err.message;
}
statusMessage.textContent = "";
