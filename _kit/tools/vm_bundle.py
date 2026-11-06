"""Pack only the files one builder round needs into a zip for the VM.

The builder runs in a VM, so each round's files are copied there. The zip
keeps the task folder layout (TASK/author/..., TASK/package/...), so it can be
extracted next to (or over) an earlier copy, and the extension's plan runner
finds the files at the paths the plan names.

usage: python -I vm_bundle.py TASKDIR OUTZIP [--plan author/builder-plan.json]
                              [--steps author/vm-steps.txt] [--ext] [FILE ...]
  --plan   add the plan and every file or folder it names ("from", "folder", "files")
  --steps  add a step list, also copied to the zip's top as STEPS.txt
  --ext    add the DOP Builder Helper extension as dop-builder-helper/
  FILE     extra files or folders, relative to TASKDIR
"""
import json
import os
import sys
import zipfile

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    task, out = os.path.abspath(args[0]), args[1]
    rest = args[2:]
    plan = steps = None
    ext = False
    extra = []
    while rest:
        a = rest.pop(0)
        if a == "--plan":
            plan = rest.pop(0)
        elif a == "--steps":
            steps = rest.pop(0)
        elif a == "--ext":
            ext = True
        else:
            extra.append(a)
    want = list(extra)
    if steps:
        want.append(steps)
    if plan:
        want.append(plan)
        with open(os.path.join(task, plan), encoding="utf-8") as f:
            p = json.load(f)
        for s in p["steps"]:
            for k in ("from", "folder"):
                if s.get(k):
                    want.append(s[k])
            for f2 in s.get("files", []):
                want.append(f2["from"])
    name = os.path.basename(task)
    files = []
    for rel in dict.fromkeys(want):
        src = os.path.join(task, rel)
        if os.path.isdir(src):
            for dp, _, fs in os.walk(src):
                for fn in fs:
                    if "__pycache__" not in dp:
                        full = os.path.join(dp, fn)
                        files.append((full, os.path.relpath(full, task)))
        elif os.path.isfile(src):
            files.append((src, rel))
        else:
            sys.exit("missing: " + rel)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for full, rel in files:
            z.write(full, "%s/%s" % (name, rel.replace(os.sep, "/")))
        if steps:
            z.write(os.path.join(task, steps), "STEPS.txt")
        if ext:
            hdir = os.path.join(KIT, "dop-builder-helper")
            for dp, _, fs in os.walk(hdir):
                if os.sep + "test" in dp[len(hdir):]:
                    continue
                for fn in fs:
                    full = os.path.join(dp, fn)
                    z.write(full, "dop-builder-helper/" + os.path.relpath(full, hdir).replace(os.sep, "/"))
    with zipfile.ZipFile(out) as z:
        for i in z.infolist():
            print("%9d  %s" % (i.file_size, i.filename))
        print("%d files, %d bytes zipped -> %s" % (len(z.infolist()), os.path.getsize(out), out))


if __name__ == "__main__":
    main()
