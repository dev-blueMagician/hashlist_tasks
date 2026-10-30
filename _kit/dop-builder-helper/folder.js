// Helper window. The folder picker and Chrome's permission prompt need a page
// that stays open, and the popup closes as soon as either takes focus.
// ?mode=choose picks the folder; ?mode=allow asks for write access again and
// saves the page popup.js left in session storage.
const status = document.getElementById("status");
const go = document.getElementById("go");
const mode = new URLSearchParams(location.search).get("mode");
const say = (text) => { status.textContent = text; };
const done = (text) => {
  say(text);
  go.hidden = true;
  setTimeout(() => window.close(), 1500);
};

async function savePending(dir) {
  const { page } = await chrome.storage.session.get("page");
  if (!page) return "";
  await writeText(dir, page.name, page.text);
  await chrome.storage.session.remove("page");
  return ` Saved ${page.name}.`;
}

(async () => {
  const dir = await folderStore.get();
  if (mode === "allow" && dir) {
    say(`Chrome needs your permission to save into "${dir.name}". If it offers "Allow on every visit", choose that.`);
    go.textContent = "Allow";
    go.onclick = async () => {
      if (!(await folderStore.allowed(dir, true))) {
        say("Not allowed. Close this window, or choose the folder again.");
        return;
      }
      try {
        done(`Allowed.${await savePending(dir)}`);
      } catch (e) {
        say(`Not saved: ${e.message}`);
      }
    };
  } else {
    await chrome.storage.session.remove("page");
    say(dir
      ? `Pages are saved in "${dir.name}". Choose another folder, usually the task's author folder.`
      : "Choose the folder for saved pages, usually the task's author folder.");
    go.textContent = "Choose folder";
    go.onclick = async () => {
      let picked;
      try {
        picked = await window.showDirectoryPicker({ id: "dop-pages", mode: "readwrite" });
      } catch (e) {
        say(e.name === "AbortError" ? "No folder chosen." : `Could not choose: ${e.message}`);
        return;
      }
      await folderStore.set(picked);
      done(`Pages will be saved in "${picked.name}".`);
    };
  }
  go.hidden = false;
})();
