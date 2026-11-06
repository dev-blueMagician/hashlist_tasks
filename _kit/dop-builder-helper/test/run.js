// Serves the stand-in builder on 127.0.0.1 and runs test.js in headless Chrome.
// usage: node test/run.js [path-to-chrome]
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const chrome = process.argv[2] || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const page = `<!doctype html><html><head><meta charset="utf-8"><title>Hashlist Data Operations Platform</title></head><body>
${fs.readFileSync(path.join(__dirname, "mock.html"), "utf8").replace(/^[\s\S]*<body>|<script[\s\S]*$/g, "")}
<pre id="out">pending</pre>
<script src="/test/mock.js"></script><script src="/page.js"></script><script src="/plan.js"></script><script src="/test/test.js"></script>
</body></html>`;

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/app/build/")) { res.writeHead(200, { "content-type": "text/html" }); res.end(page); return; }
  const file = path.join(root, url);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": "text/javascript" });
  res.end(fs.readFileSync(file));
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dop-helper-test-"));
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`,
    "--virtual-time-budget=900000", "--dump-dom", `http://127.0.0.1:${port}/app/build/aa703c22-37b5-4f2f-a2fd-58b91e767638/toolchain`];
  execFile(chrome, args, { timeout: 180000, maxBuffer: 1 << 26 }, (err, stdout) => {
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
    const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(stdout || "");
    const text = m ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"') : `no result${err ? ": " + err.message : ""}`;
    console.log(text);
    process.exit(/ALL PASSED/.test(text) ? 0 : 1);
  });
});
