"""Extract text from a PDF, one '=== page N ===' header per page."""
import sys

import pypdf

src, dst = sys.argv[1], sys.argv[2]
reader = pypdf.PdfReader(src)
with open(dst, "w", encoding="utf-8") as out:
    for i, page in enumerate(reader.pages, 1):
        out.write(f"=== page {i} ===\n")
        out.write((page.extract_text() or "") + "\n")
print(len(reader.pages), "pages")
