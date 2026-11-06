# DOP Builder Helper (Chrome extension)

Three jobs on the Hashlist DOP builder: saving a page as text, filling the 5.4 scored-steps table, and running a plan of builder actions in one go.

## Saving a page

- **Save page.** Writes the live page (text, field values, on/off states) to a `.txt` file with no dialog.
  - The file goes to the chosen folder or, if none is chosen, to Chrome's Downloads folder.
  - The name gives the open section and the time to the second, for example `5.4-scored-steps-20261030-140512.txt`.
  - The `open:` line in the file names the open tabs or panels. On a page where opening one tab closes the others, save once per tab.
  - On 5.4 the file starts with a table of the scored steps. Fields and texts are quoted there, so stray tabs and spaces show.
- **Choose folder.** Opens a small window with a folder picker. Pick the task folder, the one that holds `author/` and `package/`; pages then go into its `author/` folder. (Picking `author` itself still works for saving, but plans need the task folder.)
  - Choose again when you switch tasks.
  - "use Downloads" forgets the chosen folder.
- **Permission.** Chrome decides how long the extension may write to the folder. When it needs to ask again, Save opens the small window with an "Allow" button and saves the page once you allow. If Chrome offers "Allow on every visit", choose it.

## Filling 5.4 Scored steps

Press "Fill 5.4 steps" to open the area. Paste the steps file, press Preview, then Fill.

- Fill sets every row in order, adding rows with "Add a step" when the page has too few.
- It never removes a row and never presses "Generate checks".
- Only "a value between" is supported.

The steps file is `author/scored-steps.json` in the task folder:

```json
{"steps": [
  {"text": "...", "field": "clock_ok", "low": 1, "high": 1, "worth": 1, "wrong": ["naive_a"]}
]}
```

`wrong` lists the common mistakes that should fail that step. Every other mistake chip on the row is switched off.

## Running a plan

"Run a plan" opens a window that reads `author/builder-plan.json` (or another path you type) from the task folder, checks it, and carries it out in the builder tab.

1. Open the task in the builder, in one tab only.
2. Press **Preview**. It checks the plan, every file it names, the builder tab and the task title, and lists the steps. Nothing on the page changes.
3. Press **Run**, and keep the window open. **Stop** halts after the current action.
4. Every saved page, and a log `plan-log-<time>.txt`, go into `author/`. If a step fails, the plan stops there and also saves the page as it was.

A plan is JSON:

```json
{
  "builder": "<uuid from the builder address>",
  "title": "<task title, checked on the page>",
  "steps": [
    { "do": "open", "section": "2.4" },
    { "do": "fill", "label": "Commands to run in the box", "from": "author/probes/x.txt" },
    { "do": "click", "text": "Try again", "wait": { "pattern": "Try the box \w+ · [0-9:]+ [AP]M", "busy": "running", "timeout_s": 900 } },
    { "do": "delete", "path": "/app/data/docs/old.md" },
    { "do": "upload", "folder": "author/upload/docs" },
    { "do": "fill_steps", "from": "author/scored-steps.json" },
    { "do": "save" },
    { "do": "save_all" },
    { "do": "pause", "message": "Check the tree, then press Continue" }
  ]
}
```

- `fill` puts text from a file (or `"text"`) into the box with that label, then waits for "Saved".
- `click` presses the one element with exactly that text. With `wait`, it waits until the pattern shows a new match and `busy` no longer matches.
- `delete` opens the file from the tree and presses its Delete button.
- `upload` with `folder` sends the folder as "Upload a folder" does: paths start with the folder's own name, so `author/upload/docs` lands in `/app/data/docs/`.
- `save_all` opens every section from 1 to 6 and saves each sub-section.
- It never opens section 7 and never clicks Run, Submit, "Replace and copy" or "Generate checks". Both the plan check and the page code refuse them.

## Install and update

1. Open `chrome://extensions` and switch on Developer mode.
2. Load unpacked, and choose this folder.
3. Pin the extension from the puzzle-piece menu.

After these files change, press the reload arrow on the extension's card.

## Evidence

Tested in headless Chrome 155 (`driver_peripheral`, 2026-10-30):

- **page.js:** 28 checks on the saved 5.4 page, with a stand-in for the builder's scripts. A capture of the 4.4 MB results page took 0.2 s.
- **popup.js and folder.js:** 27 checks with stand-ins for Chrome's extension functions and the folder picker. File writes went to a real browser-managed folder.

Plan runner (2026-11-05, `realtime_budget`): `node test/run.js` serves a stand-in builder (`test/mock.js`, built from saved pages) and runs `test/test.js` in headless Chrome 155. 28 checks pass:

- a full plan: Try the box, deleting two files, uploading two folders with no duplicates, filling 5.1, Verify, and saving 17 pages;
- every refusal: Run, section 7, "Generate checks", another builder's plan.

Not tested:

- `runner.js` itself (Chrome's scripting, tabs and folder APIs), and every plan action on the live builder. The stand-in only copies what the saved pages show; run the first plan while watching.

- the real folder picker;
- Chrome's permission prompt, and how long it keeps the permission for an extension;
- downloads, and the live builder.
