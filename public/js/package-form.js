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
setUp();

// async function loadPackage() {
//   const res = await fetch(`/api/packages/${id}`);
//   if (!res.ok) {
//     return;
//   }
