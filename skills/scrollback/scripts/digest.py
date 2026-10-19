#!/usr/bin/env python3
"""One line per note: id | maker | title | tools | first line of Usefulness. Keeps a big synthesis small.

Usage: python digest.py <kb-folder>
"""
import re
import sys
from pathlib import Path


def section(text, name):
    m = re.search(rf"^## {re.escape(name)}\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    return m.group(1).strip() if m else ""


def digest(path):
    text = Path(path).read_text(encoding="utf-8")
    maker = (re.search(r"^maker: (.*)$", text, re.M) or [0, ""])[1]
    title = (re.search(r"^# (.*)$", text, re.M) or [0, ""])[1]
    tools = [l[2:].split(":")[0].strip() for l in section(text, "Tools, repos and links mentioned").splitlines() if l.startswith("- ")]
    tools = [t for t in tools if t.rstrip(".").lower() != "none"]
    use = section(text, "Usefulness").split("\n")[0]
    return " | ".join([Path(path).stem, maker, title, ", ".join(tools), use])


if __name__ == "__main__":
    print("\n".join(digest(f) for f in sorted((Path(sys.argv[1]) / "items").glob("*.md"))))
