const id = new URLSearchParams(location.search).get("id");

async function setUp() {
  const pkg = await loadPackage();
  const user = await checkLogin();

  const packageOwnerId = pkg?.ownerId;
  const userId = user?.userId;

  if (userId !== packageOwnerId) {
    document.querySelector("#delete").disabled = true;
    document.querySelector("#edit").disabled = true;
  }
}

async function checkLogin() {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  return res.json();
}

async function loadPackage() {
  const res = await fetch(`/api/packages/${id}`);
  if (!res.ok) {
    return;
  }

  const packageDetails = await res.json();
  document.querySelector("#packageName").textContent = packageDetails.name;
  document.querySelector("#packageDescription").textContent =
    packageDetails.description;
  document.querySelector("#packageEcosystem").textContent =
    packageDetails.ecosystem;
  // document.querySelector("#packageRepository").href = packageDetails.repository;
  // document.querySelector("#packageHomePage").href = packageDetails.homepage;
  document.querySelector("#packageLicense").textContent =
    packageDetails.license;
  document.querySelector("#packageLicenseType").textContent =
    packageDetails.licenseType;
  document.querySelector("#packageTags").textContent = packageDetails.tags;
  document.querySelector("#packageVersion").textContent =
    packageDetails.version;
  return packageDetails;
}

setUp();
