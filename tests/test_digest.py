import digest

NOTE = """---
id: AAA111
maker: someone
---
# A title

## Tools, repos and links mentioned
- Tool X: a thing (certain, on screen)
- Tool Y: other (heard)

## Usefulness
First line here. More.
Second line.
"""


def test_digest(tmp_path):
    f = tmp_path / "AAA111.md"
    f.write_text(NOTE, encoding="utf-8")
    assert digest.digest(f) == "AAA111 | someone | A title | Tool X, Tool Y | First line here. More."


def test_digest_none_and_bare_names(tmp_path):
    f = tmp_path / "B.md"
    f.write_text(NOTE.replace("- Tool X: a thing (certain, on screen)\n- Tool Y: other (heard)", "- Tool X\n- None"), encoding="utf-8")
    assert " | Tool X | " in digest.digest(f)
