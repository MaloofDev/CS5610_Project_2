function MainModule(packagesID = "#packages") {
  const me = {};

  const packagesElement = document.querySelector(packagesID);
  function getPackages(packages) {
    return `<div class="col">
    <div class="package card h-100">
      <div class="card-body">
        <h2 class="name">${packages.name}</h2>
        <p class="ecosystem">${packages.ecosystem}</p>
        <p class="description">${packages.description}</p>
        <p class="tags">${packages.tags}</p>
      </div>
    </div>
  </div>`;
  }

  const nextButton = document.querySelector("#next");
  const previousButton = document.querySelector("#previous");
  const clearButton = document.querySelector("#clear");
  const searchForm = document.querySelector("#searchForm");
  const searchInput = document.querySelector("#searchInput");
  const ecosystemSelector = document.querySelector("#ecosystem");
  const tagSelector = document.querySelector("#tag");
  const licenseTypeSelector = document.querySelector("#licenseType");
  let pageCount = document.querySelector("#pageCount");

  let pkgs = {
    search: "",
    ecosystem: "",
    tag: "",
    licenseType: "",
    page: 1,
  };

  function redraw(packages) {
    packagesElement.innerHTML = "";
    packagesElement.innerHTML = packages.items.map(getPackages).join("\n");
    pageCount.textContent = `Page ${packages.page} of ${packages.totalPages}`;
    previousButton.disabled = packages.page <= 1;
    nextButton.disabled = packages.page >= pkgs.totalPages;
  }

  async function loadData() {
    const res = await fetch(`/api/packages?${new URLSearchParams(pkgs)}`);
    const packages = await res.json();
    me.redraw(packages);
  }

  searchForm.addEventListener("submit", (button) => {
    button.preventDefault();
    pkgs.search = searchInput.value;
    pkgs.page = 1;
    loadData();
  });

  ecosystemSelector.addEventListener("change", () => {
    pkgs.ecosystem = ecosystemSelector.value;
    pkgs.page = 1;
    loadData();
  });

  tagSelector.addEventListener("change", () => {
    pkgs.tag = tagSelector.value;
    pkgs.page = 1;
    loadData();
  });

  licenseTypeSelector.addEventListener("change", () => {
    pkgs.licenseType = licenseTypeSelector.value;
    pkgs.page = 1;
    loadData();
  });

  clearButton.addEventListener("click", () => {
    pkgs = { search: "", ecosystem: "", tag: "", licenseType: "", page: 1 };
    loadData();
  });

  nextButton.addEventListener("click", (e) => {
    e.preventDefault();
    pkgs.page++;
    loadData();
  });

  previousButton.addEventListener("click", (e) => {
    e.preventDefault();
    pkgs.page--;
    loadData();
  });

  me.redraw = redraw;
  me.loadData = loadData;

  return me;
}

const main = MainModule();
main.loadData();
