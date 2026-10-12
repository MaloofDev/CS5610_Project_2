import {
  api,
  confirmDelete,
  dateElement,
  goalLabel,
  inputLabel,
  reportUrl,
  summaryBadges,
} from "./reportUtils.js";

const filters = document.getElementById("report-filters");
const statusMessage = document.getElementById("reports-status");
const errorMessage = document.getElementById("reports-error");
const tableWrap = document.getElementById("reports-table");
const tbody = document.getElementById("reports-body");
const noMatches = document.getElementById("no-matches");
const emptyState = document.getElementById("empty-state");
const loginNotice = document.getElementById("login-notice");

let reports = [];
let editingId = null;

function visibleReports() {
  const { ecosystem, goal, hasConflicts } = filters.elements;
  return reports.filter(
    (report) =>
      (!ecosystem.value || report.ecosystem === ecosystem.value) &&
      (!goal.value || report.goal.type === goal.value) &&
      (!hasConflicts.checked || report.summary.red > 0)
  );
}

function render() {
  const rows = visibleReports();
  emptyState.hidden = reports.length > 0;
  filters.hidden = reports.length === 0;
  tableWrap.hidden = rows.length === 0;
  noMatches.hidden = rows.length > 0 || reports.length === 0;
  tbody.replaceChildren(...rows.map(renderRow));
}

function renderRow(report) {
  const row = document.createElement("tr");
  row.dataset.id = report._id;
  for (const content of [
    report._id === editingId ? renameForm(report) : link(report),
    dateElement(report.updatedAt),
    inputLabel(report),
    goalLabel(report.goal),
    summaryBadges(report.summary),
    actions(report),
  ]) {
    const cell = document.createElement("td");
    cell.append(content);
    row.append(cell);
  }
  return row;
}

function link(report, text = report.name) {
  const a = document.createElement("a");
  a.href = reportUrl(report._id);
  a.textContent = text;
  return a;
}

function renameForm(report) {
  const form = document.createElement("form");
  form.className = "inline-form";
  const input = document.createElement("input");
  input.name = "name";
  input.value = report.name;
  input.maxLength = 100;
  input.required = true;
  input.setAttribute("aria-label", "Report name");
  const save = button("Save", "button button-small button-primary");
  save.type = "submit";
  form.append(input, save, button("Cancel", "button button-small", "cancel"));
  return form;
}

function actions(report) {
  const wrap = document.createElement("span");
  wrap.className = "report-actions";
  const open = link(report, "Open");
  open.setAttribute("aria-label", `Open ${report.name}`);
  wrap.append(
    open,
    button("Rename", "link-button", "rename", report.name),
    button("Re-run", "link-button", "rerun", report.name),
    button("Delete", "link-button link-button-danger", "delete", report.name)
  );
  return wrap;
}

// The report name goes in aria-label so each row's buttons are distinct.
function button(label, className, action, reportName) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  if (action) element.dataset.action = action;
  if (reportName) element.setAttribute("aria-label", `${label} ${reportName}`);
  return element;
}

// Re-rendering replaces the row, so focus moves back to its Rename button.
function stopRenaming() {
  const id = editingId;
  editingId = null;
  render();
  tbody.querySelector(`tr[data-id="${id}"] [data-action="rename"]`)?.focus();
}

const handlers = {
  rename(report) {
    editingId = report._id;
    render();
    tbody.querySelector(`tr[data-id="${report._id}"] input`).select();
  },
  cancel: stopRenaming,
  async rerun(report, target) {
    target.disabled = true;
    target.textContent = "Re-running...";
    await api(`/api/reports/${report._id}/rerun`, { method: "POST" });
    location.href = reportUrl(report._id);
  },
  async delete(report) {
    if (!(await confirmDelete(report.name))) return;
    await api(`/api/reports/${report._id}`, { method: "DELETE" });
    reports = reports.filter((r) => r !== report);
    render();
    statusMessage.textContent = "Report deleted.";
  },
};

tbody.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) return;
  const report = reports.find((r) => r._id === target.closest("tr").dataset.id);
  errorMessage.textContent = "";
  try {
    await handlers[target.dataset.action](report, target);
  } catch (err) {
    errorMessage.textContent = err.message;
    render();
  }
});

tbody.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  const report = reports.find((r) => r._id === editingId);
  try {
    const updated = await api(`/api/reports/${report._id}`, {
      method: "PATCH",
      body: { name: event.target.elements.name.value },
    });
    report.name = updated.name;
    report.updatedAt = updated.updatedAt;
    stopRenaming();
  } catch (err) {
    errorMessage.textContent = err.message;
  }
});

tbody.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editingId) stopRenaming();
});

filters.addEventListener("change", render);
document.getElementById("clear-filters").addEventListener("click", () => {
  filters.reset();
  render();
});

try {
  reports = await api("/api/reports");
  const ecosystems = [...new Set(reports.map((report) => report.ecosystem))];
  for (const ecosystem of ecosystems.sort((a, b) => a.localeCompare(b))) {
    filters.elements.ecosystem.append(new Option(ecosystem, ecosystem));
  }
  render();
} catch (err) {
  if (loginNotice.hidden) errorMessage.textContent = err.message;
}
statusMessage.textContent = "";
