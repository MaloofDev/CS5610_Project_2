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
  function redraw(listings) {
    packagesElement.innerHTML = "";
    // for (let i = 0; i < listings.length; i++) {
    //   listingsElement.innerHTML += getListingCode(listings[i]);
    // }

    // for (let listing of listings) {
    //   console.log("listing", listing );
    //   listingsElement.innerHTML += getListingCode(listing);
    // }

    packagesElement.innerHTML = listings.map(getPackages).join("\n");
  }

  async function loadData() {
    const res = await fetch("/api/packages");
    const packages = await res.json();

    me.redraw(packages.items);
  }

  me.redraw = redraw;
  me.loadData = loadData;

  return me;
}

const main = MainModule();

main.loadData();
