"""Package the public site; keep browser profiles, archives and old copies local."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path, help="Archive path outside the public site")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
output = args.output.resolve()
if output.is_relative_to(root):
    raise SystemExit("Save the archive outside public_html.")
output.parent.mkdir(parents=True, exist_ok=True)
files = [root / "index.html", root / ".htaccess"]
files += sorted((root / "css").glob("*.css"))
files += sorted((root / "js").glob("*.js"))
for path in sorted((root / "assets").rglob("*")):
    if not path.is_file() or path.is_symlink():
        continue
    relative = path.relative_to(root)
    if any(part.startswith("chrome-") for part in relative.parts):
        continue
    if path.name.endswith((".1", "-old", "_old")):
        continue
    files.append(path)
checksums = []
total = 0
with tarfile.open(output, "w") as archive:
    for path in files:
        relative = path.relative_to(root).as_posix()
        archive.add(path, arcname=relative, recursive=False)
        checksums.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}\n")
        total += path.stat().st_size
output.with_suffix(".sha256").write_text("".join(checksums), encoding="utf-8")
print(json.dumps({"archive": str(output), "files": len(files), "bytes": total,
                  "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
