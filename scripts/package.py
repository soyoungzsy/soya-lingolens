"""Package only reviewed extension runtime and public installation documents."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]
files = ["manifest.json", "background.js", "content.js", "trigger-policy.js", "lib.js",
         "record-backup.js", "README.en.md", "SOURCES.md", "MAINTENANCE.md", "OPEN_SOURCE_REVIEW.md", "options.html", "options.js", "sidepanel.html", "sidepanel.js", "ui.css",
         "README.md", "PRIVACY.md", "CHANGELOG.md", "UPDATING.md", "VALIDATION.md", "CONTRIBUTING.md", "LICENSE"]
required = [manifest["background"]["service_worker"], manifest["options_page"], manifest["side_panel"]["default_path"]]
required += [js for entry in manifest["content_scripts"] for js in entry["js"]]
assert set(required) <= set(files), "Missing runtime files"
out = root / "outputs"
out.mkdir(exist_ok=True)
archive = out / f"soya-lingolens-{version}.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as package:
    for name in sorted(files):
        info = ZipInfo("soya-lingolens/" + name, (2026, 10, 15, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        package.writestr(info, (root / name).read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
checksum = f"{digest}  {archive.name}\n"
(out / (archive.name + ".sha256")).write_text(checksum, encoding="utf-8")
print(archive)
print(checksum, end="")
