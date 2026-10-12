const LINKS = [
  { href: "/index.html", label: "Browse Packages" },
  { href: "/package-form.html", label: "Add Package" },
  { href: "/audit.html", label: "New Audit" },
  { href: "/reports.html", label: "My Reports" },
];

const AUTH_PAGES = ["/login.html", "/signup.html"];

let currentUser;

/**
 * Fetches the logged-in user once per page load.
 * @returns {Promise<{ userId: string, username: string } | null>}
 */
export function getCurrentUser() {
  currentUser ??= fetch("/api/auth/me")
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  return currentUser;
}

/**
 * Builds a login or signup link that returns to the current page afterward.
 * @param {string} [page]
 * @returns {string}
 */
export function loginUrl(page = "/login.html") {
  const next = AUTH_PAGES.includes(location.pathname)
    ? new URLSearchParams(location.search).get("next") || "/"
    : location.pathname + location.search;
  return `${page}?next=${encodeURIComponent(next)}`;
}

function element(tag, className, ...children) {
  const el = document.createElement(tag);
  el.className = className;
  el.append(...children);
  return el;
}

function link(href, label, isCurrent, className = "nav-link") {
  const a = element("a", className, label);
  a.href = href;
  if (isCurrent) {
    a.classList.add("active");
    a.setAttribute("aria-current", "page");
  }
  return a;
}

async function logOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  location.href = "/";
}

// Bootstrap's collapse plugin opens #nav-menu from this button on small screens.
function menuToggle() {
  const button = element(
    "button",
    "navbar-toggler",
    element("span", "navbar-toggler-icon")
  );
  button.type = "button";
  button.dataset.bsToggle = "collapse";
  button.dataset.bsTarget = "#nav-menu";
  button.setAttribute("aria-controls", "nav-menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Toggle navigation");
  return button;
}

async function renderNav() {
  const header = document.getElementById("site-nav");
  if (!header) return;

  const path = location.pathname === "/" ? "/index.html" : location.pathname;

  const links = element(
    "ul",
    "navbar-nav me-auto",
    ...LINKS.map(({ href, label }) =>
      element("li", "nav-item", link(href, label, path === href))
    )
  );
  const account = element("div", "navbar-nav align-items-lg-center");

  const menu = element("div", "collapse navbar-collapse", links, account);
  menu.id = "nav-menu";

  const nav = element(
    "nav",
    "navbar navbar-expand-lg bg-body border-bottom",
    element(
      "div",
      "container",
      link("/", "LicenseLens", false, "navbar-brand fw-bold"),
      menuToggle(),
      menu
    )
  );
  nav.setAttribute("aria-label", "Main");
  header.replaceChildren(nav);

  const user = await getCurrentUser();
  if (user) {
    const button = element("button", "nav-link", "Log out");
    button.type = "button";
    button.addEventListener("click", logOut);

    account.append(
      element("span", "navbar-text fw-semibold", user.username),
      separator(),
      button
    );
  } else {
    account.append(
      link(loginUrl("/login.html"), "Log in", path === "/login.html"),
      separator(),
      link(loginUrl("/signup.html"), "Sign up", path === "/signup.html")
    );
  }
}

// Only shown when the links sit in a row, not in the collapsed menu.
function separator() {
  const span = element(
    "span",
    "navbar-text text-body-tertiary d-none d-lg-inline px-2",
    "|"
  );
  span.setAttribute("aria-hidden", "true");
  return span;
}

renderNav();
