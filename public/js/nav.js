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

function link(href, label, isCurrent) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  if (isCurrent) a.setAttribute("aria-current", "page");
  return a;
}

async function logOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  location.href = "/";
}

async function renderNav() {
  const header = document.getElementById("site-nav");
  if (!header) return;

  const path = location.pathname === "/" ? "/index.html" : location.pathname;

  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.setAttribute("aria-label", "Main");

  const brand = link("/", "LicenseLens", false);
  brand.className = "nav-brand";

  const links = document.createElement("div");
  links.className = "nav-links";
  for (const { href, label } of LINKS)
    links.append(link(href, label, path === href));

  const account = document.createElement("div");
  account.className = "nav-account";

  nav.append(brand, links, account);
  header.replaceChildren(nav);

  const user = await getCurrentUser();
  if (user) {
    const name = document.createElement("span");
    name.className = "nav-username";
    name.textContent = user.username;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "link-button";
    button.textContent = "Log out";
    button.addEventListener("click", logOut);

    account.append(name, separator(), button);
  } else {
    account.append(
      link(loginUrl("/login.html"), "Log in", path === "/login.html"),
      separator(),
      link(loginUrl("/signup.html"), "Sign up", path === "/signup.html")
    );
  }
}

function separator() {
  const span = document.createElement("span");
  span.className = "nav-separator";
  span.setAttribute("aria-hidden", "true");
  span.textContent = "|";
  return span;
}

renderNav();
