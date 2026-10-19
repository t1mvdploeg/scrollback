import json
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "webapp"))
import server

NOTE = """---
id: {id}
url: https://www.instagram.com/reel/{id}/
collection: ai
maker: Maker {id}
type: video
tags: css, layout
---
# Title {id}

## What is explained
- Step one.
- Step two.

## Tools, repos and links mentioned
- Foo: a tool (on screen). github.com/a/b
- Bar: another (heard, spelling uncertain)

{design}## Core claim
A claim.

## Usefulness
Useful enough.
"""
DESIGN = """## Design
- Colours: warm paper #F5F1E9.
- Type: serif.
- Layout: grid.
- Effects: none.
- Looks like: Nothing specific.
- Libraries: GSAP (on screen), CSS Grid (guessed from the look)

"""
DOMAIN = """# Interface design

[← Overview](../OVERVIEW.md)

✅ already installed · 🆕 new and worth it · ⚠️ caution · ⏭️ skip

Covers layout, 3 posts.

## Layout

| Post | What | Verdict |
| --- | --- | --- |
| [A: one](../items/AAA111.md) | A grid study | 🆕 Concrete layout |
| [B: two](../items/BBB222.md) | Starter kit | ⚠️ Price not checked |
| [C: three](../items/CCC333.md) | Bait | ⏭️ Hides the method |

## Advice

- Try the **grid** study first.
"""
OVERVIEW = """# Overview: saved posts

3 posts from ai. Processed 2026-10-10.

**What was not done.** Tools were not installed.

## Do these first

| # | What | Why for you | Project | Source |
| --- | --- | --- | --- | --- |
| 1 | Try the grid | Fits the journal | Journal | [A](items/AAA111.md) |

## Skill ideas

| Skill | What it would do | Based on | Serves |
| --- | --- | --- | --- |
| Page review | Reviews pages | [A](items/AAA111.md), [B](items/BBB222.md) | Journal |

## What stood out

- Bait is common.
- Grids win.

**Style.** Quiet. See [STYLE.md](STYLE.md).
"""
STYLE = """# Style: the designs you saved

[← Overview](OVERVIEW.md)

2 posts show a website, app or interface.

## Recurring style

- **Colours:** warm paper (2 posts)
- **Type:** serif (2 posts)

## Style groups

### Quiet editorial (2 posts)

Warm paper and serif.

- **Posts:** [A](items/AAA111.md), [B](items/BBB222.md)
- **Take from it:** the whitespace.

## Best examples

| Post | Why |
| --- | --- |
| [A: one](items/AAA111.md) | Clear grid |
"""
PROFILE = """# Profile

## Focus
Builds journals.

## Projects
| Project | Folder | What | Stack | Last |
| --- | --- | --- | --- | --- |
| Journal | j | x | y | 2026-10-01 |

## Installed
Skills: alpha, beta
Plugins: gamma@market
"""


def make_kb(tmp, extra_files=True):
    ids = ("AAA111", "BBB222", "CCC333")
    (tmp / "links.tsv").write_text("".join(f"ai\thttps://www.instagram.com/reel/{i}/\n" for i in ids), encoding="utf-8")
    (tmp / "items").mkdir()
    for i in ids:
        (tmp / "items" / f"{i}.md").write_text(NOTE.format(id=i, design=DESIGN if i != "CCC333" else ""), encoding="utf-8")
    (tmp / "domains").mkdir()
    (tmp / "domains" / "1-interface-design.md").write_text(DOMAIN, encoding="utf-8")
    if extra_files:
        (tmp / "OVERVIEW.md").write_text(OVERVIEW, encoding="utf-8")
        (tmp / "STYLE.md").write_text(STYLE, encoding="utf-8")
        (tmp / "profile.md").write_text(PROFILE, encoding="utf-8")
    return tmp


def test_parser(tmp_path):
    kb = server.build_kb(make_kb(tmp_path))
    assert kb["warnings"] == [] and kb["demo"] is False and kb["kb"] == {"name": tmp_path.name}
    p = {x["id"]: x for x in kb["posts"]}
    assert [p[i]["verdict"] for i in ("AAA111", "BBB222", "CCC333")] == ["new", "caution", "skip"]
    a = p["AAA111"]
    assert (a["summary"], a["verdictReason"], a["domain"], a["project"]) == ("A grid study", "Concrete layout", "interface-design", "Journal")
    assert a["tags"] == ["css", "layout"] and a["explained"] == ["Step one.", "Step two."] and a["claim"] == "A claim."
    assert a["tools"][0] == {"name": "Foo", "description": "a tool. github.com/a/b", "evidence": "on screen"}
    assert a["tools"][1]["evidence"] == "heard, spelling uncertain"
    assert a["design"]["colours"].startswith("warm paper") and a["design"]["looksLike"] == "Nothing specific."
    assert a["design"]["libraries"] == [{"name": "GSAP", "evidence": "on screen"}, {"name": "CSS Grid", "evidence": "guessed from the look"}]
    assert p["CCC333"]["design"] is None


def test_overview_style_profile(tmp_path):
    kb = server.build_kb(make_kb(tmp_path))
    assert kb["domains"][0]["name"] == "Interface design" and kb["domains"][0]["action"] == "Try the grid study first."
    assert kb["actions"] == [{"title": "Try the grid", "why": "Fits the journal", "project": "Journal", "postId": "AAA111"}]
    assert kb["skillIdeas"][0]["postIds"] == ["AAA111", "BBB222"]
    assert kb["standout"] == ["Bait is common.", "Grids win."] and kb["processed"] == "2026-10-10"
    s = kb["style"]
    assert s["designCount"] == 2 and s["recurring"][0]["count"] == 2
    assert s["groups"][0]["name"] == "Quiet editorial" and s["groups"][0]["postIds"] == ["AAA111", "BBB222"]
    assert s["libraries"][0]["name"] == "GSAP" and s["best"] == [{"postId": "AAA111", "why": "Clear grid"}]
    assert kb["profile"]["installed"] == ["alpha", "beta", "gamma@market"] and kb["profile"]["projects"] == ["Journal"]
    assert kb["collections"] == [{"id": "ai", "name": "ai", "count": 3}]
    assert [x["name"] for x in kb["status"]["phases"] if x["done"]] == ["Links", "Notes", "Profile", "Synthesis"]


def test_missing_files_are_warnings(tmp_path):
    (tmp_path / "links.tsv").write_text("ai\thttps://www.instagram.com/reel/AAA111/\n", encoding="utf-8")
    kb = server.build_kb(tmp_path)
    assert kb["posts"] == [] and kb["style"]["designCount"] == 0
    assert any("OVERVIEW.md" in w for w in kb["warnings"]) and any("profile.md" in w for w in kb["warnings"])
    json.dumps(kb)


def start(kb, demo=False):
    srv = ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(kb, demo))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def call(port, path, body=None, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=None if body is None else json.dumps(body).encode(), headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def test_add_links(tmp_path):
    kb = make_kb(tmp_path)
    srv, port = start(kb)
    text = ("https://www.instagram.com/someone/reel/NEW111/?igsh=abc https://vm.tiktok.com/ZMabc/ "
            "https://www.instagram.com/reel/AAA111/ https://www.instagram.com/someone/ https://evil.example/reel/X1/ https://www.instagram.com/p/NEW111/")
    code, body = call(port, "/api/links", {"collection": "tt", "text": text})
    srv.shutdown()
    out = json.loads(body)
    assert code == 200 and out["added"] == 2
    reasons = {s["url"]: s["reason"] for s in out["skipped"]}
    assert reasons["https://www.instagram.com/reel/AAA111/"] == "already in the knowledge base"
    assert len(out["skipped"]) == 4  # known, profile page, other host, duplicate id in this batch
    lines = (kb / "links.tsv").read_text().splitlines()
    assert lines[-2:] == ["tt\thttps://www.instagram.com/reel/NEW111/", "tt\thttps://vm.tiktok.com/ZMabc/"]
    assert "igsh" not in (kb / "links.tsv").read_text()


def test_add_links_default_collection_and_bad_input(tmp_path):
    kb = make_kb(tmp_path)
    srv, port = start(kb)
    code, body = call(port, "/api/links", {"text": "https://www.instagram.com/reel/ZZZ999/"})
    assert code == 200 and (kb / "links.tsv").read_text().endswith("unsorted\thttps://www.instagram.com/reel/ZZZ999/\n")
    assert call(port, "/api/links", {"collection": "a\tb", "text": "x"})[0] == 400
    assert call(port, "/api/links", {"text": 5})[0] == 400
    assert call(port, "/api/links", {"text": "x" * 70000})[0] == 413
    srv.shutdown()


def test_demo_writes_nothing(tmp_path):
    kb = make_kb(tmp_path)
    before = (kb / "links.tsv").read_text()
    srv, port = start(kb, demo=True)
    code, body = call(port, "/api/links", {"text": "https://www.instagram.com/reel/NEW111/"})
    srv.shutdown()
    assert json.loads(body) == {"added": 1, "skipped": [], "demo": True} and (kb / "links.tsv").read_text() == before


def test_static_and_traversal(tmp_path):
    srv, port = start(make_kb(tmp_path))
    assert call(port, "/api/kb")[0] == 200
    for p in ("/../server.py", "/%2e%2e/server.py", "/..%2fserver.py", "/%2e%2e%2f%2e%2e%2fpytest.ini"):
        assert call(port, p)[0] == 404, p
    srv.shutdown()


def test_host_and_origin_checks(tmp_path):
    srv, port = start(make_kb(tmp_path))
    assert call(port, "/api/kb", headers={"Host": "evil.example"})[0] == 403
    assert call(port, "/api/kb", headers={"Host": f"localhost:{port}"})[0] == 200
    assert call(port, "/api/links", {"text": "x"}, headers={"Origin": "https://evil.example"})[0] == 403
    assert call(port, "/api/links", {"text": "x"}, headers={"Origin": f"http://localhost:{port}"})[0] == 200
    assert call(port, "/api/links", {"text": "x"}, headers={"Content-Type": "text/plain"})[0] == 415
    srv.shutdown()


def test_demo_library_names_are_clean():
    kb = server.build_kb(Path(server.__file__).parent / "demo", demo=True)
    names = [l["name"] for p in kb["posts"] for l in (p["design"] or {}).get("libraries", [])]
    assert names and all(n == n.strip("; ,") and n for n in names)


def test_bad_requests_get_an_answer(tmp_path):
    import http.client, threading, server
    kb = tmp_path / "kb"; kb.mkdir()
    srv = server.ThreadingHTTPServer(("127.0.0.1", 0), server.make_handler(kb, False))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        port = srv.server_address[1]
        for method, path, headers in [("GET", "/%00", {}), ("POST", "/api/links", {"Content-Type": "application/json", "Content-Length": "-1"})]:
            c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            c.request(method, path, headers=headers)
            assert c.getresponse().status in (400, 404, 413)
    finally:
        srv.shutdown()
