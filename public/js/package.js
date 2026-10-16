const id = new URLSearchParams(location.search).get("id");

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
}

loadPackage();
