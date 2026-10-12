import { getCurrentUser } from "./nav.js";
import { api, reportUrl, showLoginNotice } from "./reportUtils.js";

const form = document.getElementById("audit-form");
const errorMessage = document.getElementById("audit-error");
const submitButton = form.querySelector('button[type="submit"]');
const ecosystemField = document.getElementById("ecosystem-field");
const inputHint = document.getElementById("input-hint");
const loginNotice = document.getElementById("login-notice");
const { inputType, ecosystem, input, goal, goalLicense } = form.elements;

const INPUT_HELP = {
  "package.json": {
    placeholder:
      '{\n  "dependencies": {\n    "chart.js": "^4.4.1",\n    "express": "^5.1.0"\n  }\n}',
    hint: "Paste the whole file. devDependencies are skipped because they don't ship with your app.",
  },
  "requirements.txt": {
    placeholder:
      "requests==2.32.3\nflask==3.0.3\nmysql-connector-python==9.0.0",
    hint: "One requirement per line. Comments and pip options are skipped.",
  },
  "plain-list": {
    placeholder: "tokio 1.40.0\nserde 1.0\nrand",
    hint: "One package per line or separated by commas, with an optional version.",
  },
};

function syncForm() {
  const isPlainList = inputType.value === "plain-list";
  ecosystemField.hidden = !isPlainList;
  ecosystem.required = isPlainList;
  input.placeholder = INPUT_HELP[inputType.value].placeholder;
  inputHint.textContent = INPUT_HELP[inputType.value].hint;
  goalLicense.disabled = goal.value !== "open-source";
}

async function loadGoalLicenses() {
  const licenses = await api("/api/licenses").catch(() => []);
  const options = licenses
    .filter((license) => license.type !== "unknown")
    .map((license) => new Option(license.id, license.id));
  if (options.length === 0) return;
  goalLicense.replaceChildren(...options);
  goalLicense.value = "GPL-3.0-only";
}

form.addEventListener("change", syncForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "Checking...";

  try {
    const { _id } = await api("/api/reports", {
      method: "POST",
      body: {
        name: form.elements.name.value,
        inputType: inputType.value,
        ecosystem: ecosystem.value,
        goal: { type: goal.value, license: goalLicense.value },
        input: input.value,
      },
    });
    location.href = reportUrl(_id);
  } catch (err) {
    errorMessage.textContent = err.message;
    submitButton.disabled = !loginNotice.hidden;
    submitButton.textContent = "Run Check";
  }
});

syncForm();
loadGoalLicenses();
if (!(await getCurrentUser())) {
  showLoginNotice();
  submitButton.disabled = true;
}
