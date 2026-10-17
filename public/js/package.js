const id = new URLSearchParams(location.search).get("id");

async function setUp() {
  const pkg = await loadPackage();
  const user = await checkLogin();

  const packageOwnerId = pkg?.ownerId;
  const userId = user?.userId;

  if (userId !== packageOwnerId) {
    document.querySelector("#deleteButton").disabled = true;
    document.querySelector("#editButton").disabled = true;
  }
}

async function checkLogin() {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  return res.json();
}

async function deletePackage(id) {
  const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
  return res;
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

// Delete Package
const deleteButton = document.querySelector("#deleteButton");
deleteButton.addEventListener("click", async () => {
  // Run a call to delete function
  const res = await deletePackage(id);
  if (!res.ok) {
    const err = await res.json();
    document.querySelector("#formError").textContent = err.error;
    document.querySelector("#formError").hidden = false;
    return;
  }
  location.href = `/index.html?id`;
});

setUp();
