// The chosen save folder, kept in IndexedDB so popup.js and folder.js share it.
const folderStore = (() => {
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open("dop-builder-helper", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async (mode, act) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("kv", mode);
      const req = act(tx.objectStore("kv"));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    get: () => run("readonly", (s) => s.get("folder")).then((h) => h || null),
    set: (handle) => run("readwrite", (s) => s.put(handle, "folder")),
    clear: () => run("readwrite", (s) => s.delete("folder")),
    // True when this page may write into dir. ask=true shows Chrome's prompt
    // if needed, which only works in a page that stays open (folder.html).
    async allowed(dir, ask) {
      const opts = { mode: "readwrite" };
      if ((await dir.queryPermission(opts)) === "granted") return true;
      if (!ask) return false;
      try {
        return (await dir.requestPermission(opts)) === "granted";
      } catch {
        return false;
      }
    },
  };
})();

async function writeText(dir, name, text) {
  const file = await dir.getFileHandle(name, { create: true });
  const w = await file.createWritable();
  await w.write(text);
  await w.close();
}
