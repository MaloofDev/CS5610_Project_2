async function checkLogin() {
  const res = await fetch("/api/auth/me");
  return res.ok;
}

async function setUp() {
  const loggedIn = await checkLogin();
  if (!loggedIn) {
    document.querySelector("#loginNotice").hidden = false;
    document.querySelector("#loginForm").hidden = true;
  }
}

async function createPackage(data) {
  const res = await fetch(`/api/packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res;
}

// Create Variables and event listeners and validate data

const form = document.querySelector("#packageForm");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const packageName = form.elements.packageName.value;
  const ecosystem = form.elements.ecosystem.value;
  const license = form.elements.license.value;
  const licenseType = form.elements.licenseType.value;
  const version = form.elements.version.value;
  const homepage = form.elements.homepage.value;
  const repository = form.elements.repository.value;
  const description = form.elements.description.value;
  const tags = form.elements.tags.value;
  const packageCapture = {};

  packageCapture.ecosystem = ecosystem;
  packageCapture.name = packageName;
  packageCapture.description = description;
  packageCapture.homepage = homepage;
  packageCapture.license = license;
  packageCapture.licenseType = licenseType;
  packageCapture.repository = repository;
  packageCapture.tags = tags;
  packageCapture.version = version;
  const res = await createPackage(packageCapture);
  if (!res.ok) {
    const err = await res.json();
    document.querySelector("#formError").textContent = err.error;
    document.querySelector("#formError").hidden = false;
    return;
  }
  const success = await res.json();
  location.href = `/package.html?id=${success._id}`;
});

setUp();
