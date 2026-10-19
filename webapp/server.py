#!/usr/bin/env python3
"""Local Scrollback web app: reads a knowledge base folder and serves it as JSON (GET /api/kb) next to the static UI in webapp/static/.
POST /api/links appends new post links to links.tsv; processing the posts stays in the Claude Code skill.
Binds to 127.0.0.1 only. Needs nothing but Python 3.10+.
Usage: uv run webapp/server.py <kb-folder> [--port 8720]    or    uv run webapp/server.py --demo [--port 8720]
"""
import argparse
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "skills" / "scrollback" / "scripts"))
from fetch import POST, fetched, item_id, read_links  # noqa: E402

STATIC = HERE / "static"
DEMO = HERE / "demo"
LOCAL_HOSTS = {"localhost", "127.0.0.1"}
POST_HOSTS = ("instagram.com", "tiktok.com")
MAX_BODY = 64 * 1024
MARKERS = {"✅": "installed", "🆕": "new", "⚠": "caution", "⏭": "skip"}
ICONS = "◈⌘↗✳◇○△□"
MIME = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json"}


# ---------- markdown helpers ----------

def clean(s):
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    return re.sub(r"[*`]", "", s).strip()


def sections(text, level="## ", lower=True):
    """{heading (lowercase unless lower=False): body} for the headings at this level."""
    out, name = {}, None
    for line in text.splitlines():
        if line.startswith(level):
            name = line[len(level):].strip()
            name = name.lower() if lower else name
            out[name] = []
        elif name is not None:
            out[name].append(line)
    return {k: "\n".join(v).strip() for k, v in out.items()}


def bullets(body):
    return [clean(l.strip()[2:]) for l in body.splitlines() if l.strip().startswith(("- ", "* "))]


def rows(body):
    """Table rows as lists of raw cells, without header and separator."""
    out = []
    for l in body.splitlines():
        l = l.strip()
        if l.startswith("|") and not re.match(r"^\|[\s:|-]+\|?$", l):
            out.append([c.strip() for c in l.strip("|").split("|")])
    return out[1:]


def note_ids(cell):
    return re.findall(r"items/([^)\s#]+)\.md", cell)


def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n?", text, re.S)
    meta = {}
    for l in (m.group(1) if m else "").splitlines():
        k, _, v = l.partition(":")
        meta[k.strip()] = v.strip()
    return meta, text[m.end():] if m else text


def evidence(s):
    s = s.strip().lower()
    return "on screen" if "on screen" in s else s


# ---------- parsing the knowledge base ----------

def read(path, warnings):
    try:
        return Path(path).read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        warnings.append(f"{Path(path).name} is missing or unreadable")
        return ""


def parse_note(path, warnings):
    meta, body = frontmatter(read(path, warnings))
    sec = sections(body)
    title = re.search(r"^# (.+)$", body, re.M)
    tools = []
    for b in bullets(sec.get("tools, repos and links mentioned", "")):
        if b.lower().startswith("none"):
            continue
        name, _, rest = b.partition(": ")
        ev = re.search(r"\(([^)]*(?:on screen|heard)[^)]*)\)", rest)
        tools.append({"name": name, "description": re.sub(r"\s*\([^)]*(?:on screen|heard)[^)]*\)", "", rest).strip(" ."),
                      "evidence": evidence(ev.group(1)) if ev else ""})
    design = None
    if "design" in sec:
        d = {}
        for b in bullets(sec["design"]):
            k, _, v = b.partition(": ")
            d[k.strip().lower()] = v
        libs = [] if d.get("libraries", "").lower().startswith("none") else [
            {"name": n.strip(), "evidence": evidence(e)} for n, e in re.findall(r"([^,;()]+?)\s*\((on screen|guessed[^)]*)\)", d.get("libraries", ""))]
        design = {"colours": d.get("colours", ""), "type": d.get("type", ""), "layout": d.get("layout", ""),
                  "effects": d.get("effects", ""), "looksLike": d.get("looks like", ""), "libraries": libs}
    return {
        "id": meta.get("id") or Path(path).stem, "url": meta.get("url", ""), "title": clean(title.group(1)) if title else Path(path).stem,
        "maker": meta.get("maker", ""), "collection": meta.get("collection", ""), "domain": None,
        "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()], "verdict": None,
        "type": meta.get("type", ""), "summary": "", "explained": bullets(sec.get("what is explained", "")), "tools": tools,
        "design": design, "claim": clean(sec.get("core claim", "")), "usefulness": clean(sec.get("usefulness", "")),
        "verdictReason": "", "project": None,
    }


def parse_domain(path, index, warnings):
    text = read(path, warnings)
    stem = re.sub(r"^\d+-", "", Path(path).stem)
    title = re.search(r"^# (.+)$", text, re.M)
    para = next((clean(l) for l in text.splitlines() if l.strip() and not l.startswith(("#", "[←", "|", "-", "✅"))), "")
    advice = bullets(sections(text).get("advice", ""))
    dom = {"id": stem, "name": clean(title.group(1)) if title else stem, "description": para,
           "action": advice[0] if advice else "", "icon": ICONS[index % len(ICONS)]}
    verdicts = {}
    for cells in rows(text):
        if len(cells) < 3 or not note_ids(cells[0]):
            continue
        m = re.search("|".join(MARKERS), cells[2])
        if m:
            verdicts[note_ids(cells[0])[0]] = (MARKERS[m.group()], clean(re.sub("️", "", cells[2][m.end():])), clean(cells[1]))
    return dom, verdicts


def parse_overview(text):
    sec = sections(text)
    actions = [{"title": clean(c[1]), "why": clean(c[2]), "project": clean(c[3]), "postId": (note_ids(c[4]) or [None])[0]}
               for c in rows(sec.get("do these first", "")) if len(c) >= 5]
    ideas = [{"title": clean(c[0]), "description": clean(c[1]), "postIds": note_ids(c[2]), "serves": clean(c[3])}
             for c in rows(sec.get("skill ideas", "")) if len(c) >= 4]
    done = re.search(r"\*\*What was not done\.\*\*\s*(.+)", text)
    date = re.search(r"Processed (\d{4}-\d{2}-\d{2})", text)
    return actions, ideas, bullets(sec.get("what stood out", "")), date.group(1) if date else "", clean(done.group(1)) if done else ""


def parse_style(text, posts):
    sec = sections(text)
    count = re.search(r"(\d+) posts? show", text)
    recurring = []
    for b in bullets(sec.get("recurring style", "")):
        label, _, rest = b.partition(": ")
        n = re.search(r"\((\d+) posts?\)\s*$", rest)
        recurring.append({"label": label, "text": re.sub(r"\s*\(\d+ posts?\)\s*$", "", rest), "count": int(n.group(1)) if n else 0, "postIds": []})
    groups = []
    for name, body in sections(sec.get("style groups", ""), "### ", lower=False).items():
        lines = [l for l in body.splitlines() if l.strip()]
        posts_line = next((l for l in lines if "**Posts:**" in l), "")
        take = next((clean(l.split(":**", 1)[1]) for l in lines if "**Take from it:**" in l), "")
        desc = " ".join(clean(l) for l in lines if not l.strip().startswith("-"))
        gname = re.sub(r"\s*\(\d+ posts?\)", "", name)
        groups.append({"id": re.sub(r"[^a-z0-9]+", "-", gname).strip("-"), "name": gname,
                       "description": desc, "take": take, "postIds": note_ids(posts_line)})
    best = [{"postId": (note_ids(c[0]) or [None])[0], "why": clean(c[1])} for c in rows(sec.get("best examples", "")) if len(c) >= 2]
    libs = {}
    for p in posts:
        for l in (p["design"] or {}).get("libraries", []):
            e = libs.setdefault(l["name"], {"name": l["name"], "onScreen": [], "guessed": []})
            e["onScreen" if l["evidence"] == "on screen" else "guessed"].append(p["id"])
    return {"designCount": int(count.group(1)) if count else 0, "recurring": recurring, "groups": groups,
            "libraries": sorted(libs.values(), key=lambda e: -(len(e["onScreen"]) + len(e["guessed"]))), "best": best}


def parse_profile(text, name, collections):
    sec = sections(text)
    inst = []
    for l in sec.get("installed", "").splitlines():
        inst += [x.strip() for x in l.partition(":")[2].split(",") if x.strip() and x.strip().lower() != "none"]
    return {"name": name, "description": clean(sec.get("focus", "")), "projects": [clean(c[0]) for c in rows(sec.get("projects", ""))],
            "installed": inst, "collectionNames": collections}


def build_kb(kb, demo=False):
    kb, warnings = Path(kb), []
    for need in ("profile.md", "links.tsv", "OVERVIEW.md"):
        if not (kb / need).is_file():
            warnings.append(f"{need} is missing")
    links = read_links(kb / "links.tsv") if (kb / "links.tsv").is_file() else []
    counts = {}
    for coll, _ in links:
        counts[coll] = counts.get(coll, 0) + 1
    ids = [item_id(u) for _, u in links]

    posts = {}
    for f in sorted((kb / "items").glob("*.md")):
        try:
            p = parse_note(f, warnings)
            posts[p["id"]] = p
        except Exception as e:  # a broken note must not take the whole page down
            warnings.append(f"{f.name}: {e}")
    domains = []
    for i, f in enumerate(sorted((kb / "domains").glob("*.md"), key=lambda f: (int(m.group()) if (m := re.match(r"\d+", f.name)) else 999, f.name))):
        dom, verdicts = parse_domain(f, i, warnings)
        domains.append(dom)
        for pid, (v, reason, what) in verdicts.items():
            if pid in posts:
                posts[pid].update(domain=dom["id"], verdict=v, verdictReason=reason, summary=what)
    if not domains:
        warnings.append("no domain files")

    ov = (kb / "OVERVIEW.md")
    actions, ideas, standout, processed, provenance = parse_overview(read(ov, []) if ov.is_file() else "")
    for a in actions:
        if a["postId"] in posts and a["project"] not in ("", "—"):
            posts[a["postId"]]["project"] = a["project"]
    for p in posts.values():
        if p["verdict"] is None:
            warnings.append(f"{p['id']}: not in any domain file")
            p.update(verdict="new", summary=p["title"])
    plist = list(posts.values())
    style = parse_style(read(kb / "STYLE.md", []) if (kb / "STYLE.md").is_file() else "", plist)
    if not style["designCount"]:
        style["designCount"] = sum(1 for p in plist if p["design"])

    colls = [{"id": c, "name": c, "count": n} for c, n in counts.items()]
    name = "Demo" if demo else kb.name
    profile = parse_profile(read(kb / "profile.md", []) if (kb / "profile.md").is_file() else "", name, list(counts))
    fetched_n = sum(1 for i in ids if (kb / "raw" / i).is_dir())  # a failed download keeps its folder and gets no note
    if demo:  # the demo ships notes only, no downloads
        fetched_n = len(ids)
    notes_n = sum(1 for i in ids if (kb / "items" / f"{i}.md").is_file())
    newest = max([f.stat().st_mtime for f in (kb / "items").glob("*.md")] or [0])
    synth = ov.is_file() and ov.stat().st_mtime >= newest
    phases = [
        {"name": "Links", "done": bool(links), "detail": f"{len(links)} links"},
        {"name": "Fetch", "done": bool(links) and fetched_n == len(ids), "detail": f"{fetched_n} of {len(links)} fetched"},
        {"name": "Notes", "done": bool(links) and notes_n >= fetched_n and notes_n > 0, "detail": f"{notes_n} notes"},
        {"name": "Profile", "done": (kb / "profile.md").is_file(), "detail": "profile.md" if (kb / "profile.md").is_file() else "missing"},
        {"name": "Synthesis", "done": synth, "detail": "up to date" if synth else "needs a run"},
    ]
    return {"demo": demo, "kb": {"name": name}, "processed": processed, "provenance": provenance, "profile": profile, "collections": colls,
            "domains": domains, "posts": plist, "actions": actions, "skillIdeas": ideas, "standout": standout, "style": style,
            "status": {"links": len(links), "fetched": fetched_n, "notes": notes_n, "phases": phases}, "warnings": warnings}


# ---------- adding links ----------

def clean_link(raw):
    """Canonical URL of a single post, or None."""
    u = urlsplit(raw.strip().rstrip(".,;)"))
    host = (u.hostname or "").lower()
    if u.scheme not in ("http", "https") or not any(host == h or host.endswith("." + h) for h in POST_HOSTS):
        return None
    url = f"https://{host}{u.path}"
    ig = re.search(r"/(reels?|p|tv)/([\w-]+)", u.path)
    if host.endswith("instagram.com") and ig:
        return f"https://www.instagram.com/{ig.group(1)}/{ig.group(2)}/"
    return url if POST.search(url) else None


def add_links(kb, collection, text, demo):
    known = {item_id(u) for _, u in read_links(Path(kb) / "links.tsv")} if (Path(kb) / "links.tsv").is_file() else set()
    fresh, skipped = [], []
    for raw in re.findall(r"https?://\S+", text):
        url = clean_link(raw)
        if not url:
            skipped.append({"url": raw.split("?")[0], "reason": "not a link to a single post"})
        elif item_id(url) in known:
            skipped.append({"url": url, "reason": "already in the knowledge base"})
        else:
            known.add(item_id(url))
            fresh.append(url)
    if fresh and not demo:
        path = Path(kb) / "links.tsv"
        old = path.read_text(encoding="utf-8") if path.is_file() else ""
        lead = "" if not old or old.endswith("\n") else "\n"
        with path.open("a", encoding="utf-8", newline="\n") as f:
            f.write(lead + "".join(f"{collection}\t{u}\n" for u in fresh))
    out = {"added": len(fresh), "skipped": skipped}
    return {**out, "demo": True} if demo else out


# ---------- server ----------

def make_handler(kb, demo):
    class Handler(BaseHTTPRequestHandler):
        def send(self, code, body, ctype="application/json"):
            if not isinstance(body, bytes):
                body = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def local(self, value, url=False):
            host = urlsplit(value).hostname if url else urlsplit("//" + value).hostname
            return host in LOCAL_HOSTS

        def guard(self):
            """DNS rebinding and cross-site requests: only localhost may talk to us."""
            if not self.local(self.headers.get("Host", "")):
                self.send(403, {"error": "forbidden host"})
                return False
            origin = self.headers.get("Origin")
            if origin and not self.local(origin, url=True):
                self.send(403, {"error": "forbidden origin"})
                return False
            return True

        def do_GET(self):
            if not self.guard():
                return
            path = unquote(urlsplit(self.path).path)
            if path == "/api/kb":
                try:
                    return self.send(200, build_kb(kb, demo))
                except Exception as e:  # unreadable knowledge base: answer in JSON, the UI shows it
                    return self.send(500, {"error": f"could not read the knowledge base ({type(e).__name__})"})
            try:
                f = (STATIC / ("index.html" if path == "/" else path.lstrip("/"))).resolve()
                ok = f.is_relative_to(STATIC.resolve()) and f.is_file()
            except ValueError:  # NUL byte in the path
                ok = False
            if not ok:
                return self.send(404, {"error": "not found"})
            self.send(200, f.read_bytes(), MIME.get(f.suffix, "application/octet-stream"))

        def do_POST(self):
            if not self.guard():
                return
            if urlsplit(self.path).path != "/api/links":
                return self.send(404, {"error": "not found"})
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                return self.send(415, {"error": "send application/json"})
            try:
                n = int(self.headers.get("Content-Length", ""))
            except ValueError:
                return self.send(411, {"error": "length required"})
            if not 0 <= n <= MAX_BODY:
                return self.send(413, {"error": "body too large"})
            try:
                data = json.loads(self.rfile.read(n))
                text, coll = data["text"], data.get("collection") or "unsorted"
                assert isinstance(text, str) and isinstance(coll, str) and re.fullmatch(r"[\w.-]{1,40}", coll)
            except (ValueError, KeyError, TypeError, AssertionError):
                return self.send(400, {"error": "expected JSON {collection, text}; collection is a short slug"})
            self.send(200, add_links(kb, coll, text, demo))

        def log_message(self, *args):
            pass

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("kb", nargs="?", help="knowledge base folder")
    ap.add_argument("--demo", action="store_true", help="serve the fictional demo knowledge base; nothing is written")
    ap.add_argument("--port", type=int, default=8720)
    a = ap.parse_args()
    if a.demo == bool(a.kb):
        ap.error("give a knowledge base folder, or --demo")
    kb = DEMO if a.demo else Path(a.kb).expanduser()
    if not kb.is_dir():
        ap.error(f"not a folder: {kb}")
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(kb, a.demo))
    print(f"Scrollback on http://localhost:{a.port}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
