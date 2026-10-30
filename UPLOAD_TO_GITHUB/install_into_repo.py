#!/usr/bin/env python3
"""Install staged project files safely into the repository root.
Run from repository root: python3 UPLOAD_TO_GITHUB/install_into_repo.py
"""
from pathlib import Path
import hashlib, json, sys
stage=Path(__file__).resolve().parent
repo=stage.parent
entries=json.loads((stage/'manifest.json').read_text(encoding='utf-8'))
planned=[]
errors=[]
for entry in entries:
    src=(stage/entry['source']).resolve()
    dst=(repo/entry['target']).resolve()
    if not src.is_relative_to(stage.resolve()) or not dst.is_relative_to(repo.resolve()):
        errors.append(f"Unsafe path: {entry['target']}"); continue
    if not src.is_file():
        errors.append(f"Missing source: {entry['source']}"); continue
    data=src.read_bytes()
    if hashlib.sha256(data).hexdigest()!=entry['sha256']:
        errors.append(f"Source checksum mismatch: {entry['source']}"); continue
    if dst.exists() and dst.read_bytes()!=data:
        errors.append(f"Existing file differs; review before overwrite: {entry['target']}"); continue
    planned.append((dst,data))
if errors:
    print("STOP: Resolve conflicts before installing:\n- " + "\n- ".join(errors))
    sys.exit(1)
if '--verify-only' in sys.argv:
    print(f"Validated {len(planned)} staged files; no conflicts. No changes made.")
    sys.exit(0)
for dst,data in planned:
    dst.parent.mkdir(parents=True,exist_ok=True)
    if not dst.exists(): dst.write_bytes(data)
print(f"Installed or confirmed {len(planned)} files into {repo}.")
print("Verify .claude/skills/, .cursor/rules/, .github/ and docs/.")
print("Review git status and remove UPLOAD_TO_GITHUB staging only AFTER verifying results.")
