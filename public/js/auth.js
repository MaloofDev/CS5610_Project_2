import { loginUrl } from "./nav.js";

const form = document.getElementById("auth-form");
const errorMessage = document.getElementById("auth-error");
const submitButton = form.querySelector('button[type="submit"]');
const isSignup = form.dataset.mode === "signup";

// Same-site paths only, so ?next= can't redirect to another website.
function nextPage() {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !/^\/[/\\]/.test(next) ? next : "/";
}

async function postJSON(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  submitButton.disabled = true;

  const credentials = {
    username: form.elements.username.value,
    password: form.elements.password.value,
  };

  try {
    if (isSignup) await postJSON("/api/auth/signup", credentials);
    await postJSON("/api/auth/login", credentials);
    location.href = nextPage();
  } catch (err) {
    errorMessage.textContent = err.message;
    submitButton.disabled = false;
  }
});

// Keep ?next= when switching between the login and signup pages.
document.getElementById("switch-mode").href = loginUrl(
  isSignup ? "/login.html" : "/signup.html"
);
