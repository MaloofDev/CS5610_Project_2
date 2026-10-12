// Shared by New Audit, My Reports, and Report Detail.
import { loginUrl } from "./nav.js";

const SUMMARY_BADGES = {
  green: "badge-ok",
  yellow: "badge-review",
  red: "badge-conflict",
};

/**
 * Sends a JSON request. Throws an Error with a user-facing message on failure,
 * and shows the login notice on 401.
 * @param {string} url
 * @param {{ method?: string, body?: object }} [options]
 */
export async function api(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body && { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  if (response.status === 401) {
    showLoginNotice();
    throw new Error("Your session ended. Log in again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Something went wrong. Try again.");
  }
  return response.status === 204 ? null : response.json();
}

/** Shows the page's #login-notice with links that return here after login. */
export function showLoginNotice() {
  document.getElementById("login-link").href = loginUrl("/login.html");
  document.getElementById("signup-link").href = loginUrl("/signup.html");
  document.getElementById("login-notice").hidden = false;
}

/**
 * Opens the page's #delete-dialog for a report.
 * @param {string} name
 * @returns {Promise<boolean>} true if the user confirmed
 */
export function confirmDelete(name) {
  const dialog = document.getElementById("delete-dialog");
  document.getElementById("delete-name").textContent = name;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "delete"),
      { once: true }
    );
  });
}

export function reportUrl(id) {
  return `/report.html?id=${encodeURIComponent(id)}`;
}

/** @returns {HTMLTimeElement} like "Oct 12, 2026" */
export function dateElement(iso) {
  const time = document.createElement("time");
  time.dateTime = iso;
  time.textContent = new Date(iso).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
  return time;
}

/** @returns {string} like "requirements.txt" or "Plain list, Cargo" */
export function inputLabel(report) {
  return report.inputType === "plain-list"
    ? `Plain list, ${report.ecosystem}`
    : report.inputType;
}

export function goalLabel(goal) {
  return goal.type === "closed-source" ? "Closed-source" : goal.license;
}

/** @returns {HTMLSpanElement} "3 green", "2 yellow", "1 red" badges */
export function summaryBadges(summary) {
  const row = document.createElement("span");
  row.className = "badge-row";
  for (const [color, badge] of Object.entries(SUMMARY_BADGES)) {
    const span = document.createElement("span");
    span.className = `badge ${badge}`;
    span.textContent = `${summary[color]} ${color}`;
    row.append(span);
  }
  return row;
}
