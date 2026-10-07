#!/usr/bin/env python3
"""Collects the licences of the Rust crates linked into the core for the
app's "Open-Source Licences" screen.

    apps/ios/scripts/generate-licenses.py

Reads `cargo metadata` of the workspace (offline, locked), follows the normal
dependencies of pst-viewer-core for iOS (proc macros only run at build time
and are skipped) and writes PstViewer/Resources/ThirdPartyLicenses.json with
each crate's licence files. Run it after changing the core's dependencies.
"""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parents[1] / "PstViewer" / "Resources" / "ThirdPartyLicenses.json"
LICENSE_PREFIXES = ("license", "licence", "copying", "unlicense", "notice")


def metadata() -> dict:
    result = subprocess.run(
        ["cargo", "metadata", "--format-version", "1", "--filter-platform", "aarch64-apple-ios", "--offline", "--locked"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def shipped_packages(meta: dict) -> list[dict]:
    packages = {p["id"]: p for p in meta["packages"]}
    nodes = {n["id"]: n for n in meta["resolve"]["nodes"]}
    root = next(p["id"] for p in meta["packages"] if p["name"] == "pst-viewer-core")
    seen, stack = set(), [root]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        for dep in nodes[current]["deps"]:
            if not any(kind["kind"] is None for kind in dep["dep_kinds"]):
                continue
            package = packages[dep["pkg"]]
            if any("proc-macro" in target["kind"] for target in package["targets"]):
                continue
            stack.append(dep["pkg"])
    seen.discard(root)
    return sorted((packages[i] for i in seen), key=lambda p: (p["name"], p["version"]))


def license_texts(package: dict) -> list[str]:
    directory = Path(package["manifest_path"]).parent
    files = sorted(f for f in directory.iterdir() if f.is_file() and f.name.lower().startswith(LICENSE_PREFIXES))
    return [f.read_text(encoding="utf-8", errors="replace").strip() for f in files]


MIT_BODY = """Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""


def standard_texts(packages: list[dict]) -> dict[str, str]:
    """Canonical Apache and MPL texts as shipped by other crates."""
    found: dict[str, str] = {}
    markers = {"Apache-2.0": "Version 2.0, January 2004", "MPL-2.0": "Mozilla Public License Version 2.0"}
    for package in packages:
        for text in license_texts(package):
            for spdx, marker in markers.items():
                if spdx not in found and marker in text:
                    found[spdx] = text
    return found


def fallback_texts(package: dict, standard: dict[str, str]) -> list[str]:
    """Licence texts for crates that do not ship their licence files."""
    expression = package.get("license") or ""
    texts = []
    if "MIT" in expression:
        authors = ", ".join(a.split("<")[0].strip() for a in package.get("authors", [])) or f"the {package['name']} authors"
        texts.append(f"MIT License\n\nCopyright (c) {authors}\n\n{MIT_BODY}")
    for spdx in ("Apache-2.0", "MPL-2.0"):
        if spdx in expression and spdx in standard:
            texts.append(standard[spdx])
    return texts


def main() -> None:
    texts: dict[str, str] = {}
    crates = []
    packages = shipped_packages(metadata())
    standard = standard_texts(packages)
    for package in packages:
        ids = []
        for text in license_texts(package) or fallback_texts(package, standard):
            key = hashlib.sha1(text.encode()).hexdigest()[:12]
            texts[key] = text
            ids.append(key)
        if not ids:
            print(f"warning: no licence text for {package['name']} {package['version']}", file=sys.stderr)
        crates.append({
            "name": package["name"],
            "version": package["version"],
            "license": package.get("license") or "",
            "repository": package.get("repository") or "",
            "texts": ids,
        })
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"crates": crates, "texts": texts}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(crates)} crates, {len(texts)} licence texts -> {OUTPUT}")


if __name__ == "__main__":
    main()
