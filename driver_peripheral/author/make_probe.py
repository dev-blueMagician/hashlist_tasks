"""Write a Try-the-box command list that unpacks author files into /tmp/t inline.

The files travel gzip+base64-encoded inside the commands, one command per
file, so nothing private is added to the environment and no line is huge.
usage: python -I author/make_probe.py OUT LINESFILE
LINESFILE holds the remaining commands, one per line.
"""
import base64
import gzip
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "package")
FILES = {
    "starter.c": "environment/data/starter/firmware.c",
    "gold.c": "references/gold.c",
    "naive_a.c": "references/naive_a.c",
    "drive.py": "verifier/drive.py",
    "run-sd.sh": "environment/data/run-sd.sh",
}

out, rest = sys.argv[1], sys.argv[2]
with open(rest) as f:
    lines = [ln.rstrip("\n") for ln in f if ln.strip()]
CHUNK = 7000
LIMIT = 20                      # Try the box runs 1 to 20 commands
cmds = ["rm -rf /tmp/t && mkdir -p /tmp/t && echo probe-dir-ready"]
for name, rel in FILES.items():
    with open(os.path.join(ROOT, rel), "rb") as f:
        blob = base64.b64encode(gzip.compress(f.read(), mtime=0)).decode()
    parts = [blob[i:i + CHUNK] for i in range(0, len(blob), CHUNK)]
    for part in parts[:-1]:
        cmds.append("echo %s >> /tmp/t/%s.b64" % (part, name))
    cmds.append("echo %s >> /tmp/t/%s.b64 && base64 -d /tmp/t/%s.b64 | gunzip > /tmp/t/%s"
                " && rm /tmp/t/%s.b64 && sha256sum /tmp/t/%s" % (parts[-1], name, name, name, name, name))
cmds += lines
if len(cmds) > LIMIT:
    sys.exit("%d commands, over the limit of %d" % (len(cmds), LIMIT))
with open(out, "w", newline="\n") as f:
    f.write("\n".join(cmds) + "\n")
print("%s: %d commands, longest %d chars" % (out, len(cmds), max(len(c) for c in cmds)))
