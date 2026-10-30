// Saves the text popup.js left in session storage. This window stays open while
// the save dialog is up, so the file's blob URL stays valid until Chrome writes it.
const status = document.getElementById("status");

(async () => {
  const { page } = await chrome.storage.session.get("page");
  if (!page) {
    status.textContent = "Nothing to save. Press the extension's Save button again.";
    return;
  }
  const url = URL.createObjectURL(new Blob([page.text], { type: "text/plain;charset=utf-8" }));
  status.textContent = `Saving ${page.name}. Choose the task's author folder.`;
  let id = null;
  chrome.downloads.onChanged.addListener((d) => {
    if (d.id !== id || !d.state) return;
    if (d.state.current === "complete") {
      chrome.storage.session.remove("page");
      window.close();
    } else if (d.state.current === "interrupted") {
      status.textContent = "Not saved (cancelled or failed). Close this window and try again.";
    }
  });
  try {
    id = await chrome.downloads.download({ url, filename: page.name, saveAs: true });
  } catch (e) {
    status.textContent = `Not saved: ${e.message}. Close this window and try again.`;
  }
})();
