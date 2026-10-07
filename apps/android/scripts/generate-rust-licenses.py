#!/usr/bin/env python3
"""Lists the Rust crates linked into the core library for Android with their
licence texts (app/src/main/res/raw/rust_licenses.json, shown under Settings >
Open-source licenses). Run it after the core's dependencies change:

    apps/android/scripts/generate-rust-licenses.py
"""

import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "apps/android/app/src/main/res/raw/rust_licenses.json"
LICENSE_FILE = re.compile(r"^(licen[sc]e|copying|notice|unlicense)", re.IGNORECASE)
MIT = """Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."""

metadata = json.loads(subprocess.check_output(
    ["cargo", "metadata", "--format-version", "1", "--filter-platform", "aarch64-linux-android"], cwd=ROOT))
packages = {p["id"]: p for p in metadata["packages"]}
nodes = {n["id"]: n for n in metadata["resolve"]["nodes"]}
core = next(p for p in metadata["packages"] if p["name"] == "pst-viewer-core")

# Normal (linked) dependencies only: no build, dev or proc-macro crates.
seen, stack = set(), [core["id"]]
while stack:
    for dep in nodes[stack.pop()]["deps"]:
        if dep["pkg"] in seen or not any(k["kind"] is None for k in dep["dep_kinds"]):
            continue
        if any("proc-macro" in t["kind"] for t in packages[dep["pkg"]]["targets"]):
            continue
        seen.add(dep["pkg"])
        stack.append(dep["pkg"])


def normalize(text):
    return "\n".join(line.rstrip() for line in text.strip().splitlines())


def license_files(package):
    directory = pathlib.Path(package["manifest_path"]).parent
    files = sorted(f for f in directory.iterdir() if f.is_file() and LICENSE_FILE.match(f.name))
    return [normalize(f.read_text(encoding="utf-8", errors="replace")) for f in files]


# Full texts of licences without project specific notices, for crates that ship no licence file.
standard = {"MIT": MIT}
for package_id in seen:
    for text in license_files(packages[package_id]):
        if text.startswith("Apache License"):
            standard.setdefault("Apache-2.0", text)
        elif text.startswith("Mozilla Public License"):
            standard.setdefault("MPL-2.0", text)

texts, crates = [], []


def text_index(text):
    if text not in texts:
        texts.append(text)
    return texts.index(text)


for package_id in seen:
    package = packages[package_id]
    found = license_files(package)
    if not found:
        authors = ", ".join(a.split(" <")[0] for a in package.get("authors", []))
        spdx = [s for s in re.findall(r"[\w.-]+", package.get("license") or "") if s in standard]
        notice = f"Copyright (c) {authors}" if authors else ""
        found = ([notice] if notice else []) + [standard[s] for s in spdx[:1]]
    crates.append({
        "name": package["name"],
        "version": package["version"],
        "license": package.get("license") or "",
        "texts": [text_index(t) for t in found],
    })
crates.sort(key=lambda c: c["name"].lower())
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"crates": crates, "texts": texts}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(crates)} crates, {len(texts)} distinct texts -> {OUT.relative_to(ROOT)}")
