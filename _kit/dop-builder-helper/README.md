# DOP Builder Helper (Chrome extension)

Two jobs on the Hashlist DOP builder: saving a page as text, and filling the 5.4 scored-steps table.

## Saving a page

- **Save page.** Writes the live page (text, field values, on/off states) to a `.txt` file with no dialog.
  - The file goes to the chosen folder or, if none is chosen, to Chrome's Downloads folder.
  - The name gives the open section and the time to the second, for example `5.4-scored-steps-20261030-140512.txt`.
  - The `open:` line in the file names the open tabs or panels. On a page where opening one tab closes the others, save once per tab.
  - On 5.4 the file starts with a table of the scored steps. Fields and texts are quoted there, so stray tabs and spaces show.
- **Choose folder.** Opens a small window with a folder picker. Pick the task's `author` folder.
  - The popup then shows "Saves to: author". Every task's folder has that same name, so choose again when you switch tasks.
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

## Install and update

1. Open `chrome://extensions` and switch on Developer mode.
2. Load unpacked, and choose this folder.
3. Pin the extension from the puzzle-piece menu.

After these files change, press the reload arrow on the extension's card.

## Evidence

Tested in headless Chrome 155 (`driver_peripheral`, 2026-10-30):

- **page.js:** 28 checks on the saved 5.4 page, with a stand-in for the builder's scripts. A capture of the 4.4 MB results page took 0.2 s.
- **popup.js and folder.js:** 27 checks with stand-ins for Chrome's extension functions and the folder picker. File writes went to a real browser-managed folder.

Not tested:

- the real folder picker;
- Chrome's permission prompt, and how long it keeps the permission for an extension;
- downloads, and the live builder.
