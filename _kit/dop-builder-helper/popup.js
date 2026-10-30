const out = document.getElementById("out");
const spec = document.getElementById("spec");
const show = (text) => { out.textContent = text; };

// Runs func in the active tab after loading page.js there (activeTab grants access on click).
async function inTab(func, args = []) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["page.js"] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return res.result;
}

chrome.storage.local.get("spec").then((v) => { if (v.spec) spec.value = v.spec; });
spec.addEventListener("input", () => chrome.storage.local.set({ spec: spec.value }));

// The popup closes when the save dialog takes focus, so save.html does the saving.
document.getElementById("save").onclick = async () => {
  try {
    show("Reading the page...");
    const page = await inTab(() => globalThis.dopHelper.capture());
    await chrome.storage.session.set({ page });
    await chrome.windows.create({ url: "save.html", type: "popup", width: 480, height: 200 });
  } catch (e) {
    show(`Could not read this page: ${e.message}`);
  }
};

function render(r) {
  if (r.error && !r.before) return r.error;
  const lines = [];
  const list = (title, rows) => {
    lines.push(title);
    rows.forEach((d, i) => lines.push(`  row ${i + 1}: ${d.length ? d.join("; ") : "OK"}`));
  };
  if (r.after) list("After filling (OK = matches the steps file):", r.after);
  else list("What Fill would change (OK = already right):", r.before);
  if (r.extra.length) {
    lines.push("", "Rows beyond the steps file. Remove them with their x if they are left over:");
    for (const x of r.extra) lines.push(`  ${x}`);
  }
  if (r.error) lines.push("", r.error);
  if (r.after && !r.error) {
    lines.push("", r.after.every((d) => !d.length)
      ? "All rows match. Check that the page says Saved, then save the page as text."
      : "Some rows still differ. Fix them by hand or press Fill again.");
  }
  return lines.join("\n");
}

async function runFill(apply) {
  let parsed;
  try {
    parsed = JSON.parse(spec.value);
  } catch (e) {
    show(`The steps file is not valid JSON: ${e.message}`);
    return;
  }
  show(apply ? "Filling..." : "Comparing...");
  try {
    show(render(await inTab((s, a) => globalThis.dopHelper.fill(s, a), [parsed, apply])));
  } catch (e) {
    show(`Could not run on this page: ${e.message}`);
  }
}

document.getElementById("preview").onclick = () => runFill(false);
document.getElementById("fill").onclick = () => runFill(true);
