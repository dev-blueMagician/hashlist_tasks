const out = document.getElementById("out");
const spec = document.getElementById("spec");
const dest = document.getElementById("dest");
const reset = document.getElementById("reset");
const toggle = document.getElementById("toggle");
const steps = document.getElementById("steps");
const show = (text) => { out.textContent = text; };
const helper = (mode) => chrome.windows.create({ url: `folder.html?mode=${mode}`, type: "popup", width: 460, height: 200 });

// Runs func in the active tab after loading page.js there (activeTab grants access on click).
async function inTab(func, args = []) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["page.js"] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return res.result;
}

// ------------------------------------------------------------------ saving

async function showDest() {
  const dir = await folderStore.get();
  dest.textContent = dir ? dir.name : "Downloads";
  reset.hidden = !dir;
}

// No dialog: the file goes straight to Chrome's download folder.
async function saveToDownloads(page) {
  const url = URL.createObjectURL(new Blob([page.text], { type: "text/plain;charset=utf-8" }));
  try {
    const id = await chrome.downloads.download({ url, filename: page.name, saveAs: false, conflictAction: "uniquify" });
    for (let i = 0; i < 100; i++) {
      const [d] = await chrome.downloads.search({ id });
      if (d && d.state === "complete") return `Saved ${d.filename.split(/[\\/]/).pop()} in Downloads.`;
      if (d && d.state === "interrupted") return `Not saved: ${d.error}.`;
      await new Promise((r) => setTimeout(r, 100));
    }
    return "Still saving. Check Chrome's downloads list.";
  } finally {
    URL.revokeObjectURL(url);
  }
}

document.getElementById("save").onclick = async () => {
  try {
    show("Reading the page...");
    const page = await inTab(() => globalThis.dopHelper.capture());
    const dir = await folderStore.get();
    if (!dir) {
      show(await saveToDownloads(page));
    } else if (await folderStore.allowed(dir, false)) {
      const to = await pageDir(dir);
      await writeText(to, page.name, page.text);
      show(`Saved ${page.name} in ${to === dir ? dir.name : `${dir.name}/author`}.`);
    } else {
      await chrome.storage.session.set({ page });
      await helper("allow");
    }
  } catch (e) {
    show(`Not saved: ${e.message}`);
  }
};

document.getElementById("choose").onclick = () => helper("choose");
document.getElementById("plan").onclick = () => chrome.windows.create({ url: "runner.html", type: "popup", width: 640, height: 740 });

reset.onclick = async () => {
  await folderStore.clear();
  await showDest();
  show("Pages will be saved in Downloads.");
};

showDest();

// ---------------------------------------------------------- 5.4 steps area

toggle.onclick = () => {
  const open = steps.hidden;
  steps.hidden = !open;
  document.body.classList.toggle("wide", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Fill 5.4 steps ▾" : "Fill 5.4 steps ▸";
};

chrome.storage.local.get("spec").then((v) => { if (v.spec) spec.value = v.spec; });
spec.addEventListener("input", () => chrome.storage.local.set({ spec: spec.value }));

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
