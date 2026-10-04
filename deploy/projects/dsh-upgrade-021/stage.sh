#!/bin/bash
# Stage DSH 0.2.1-alpha.1 into a NEW versioned release dir, side-by-side with the
# running 0.2.0-rc.2. Never touches /opt/lightvela/dsh/current.
set -euo pipefail

DSH_ROOT=/opt/lightvela/dsh
OLD=$DSH_ROOT/releases/0.2.0-rc.2-da8e5035082a-bced78b8
NEW=$DSH_ROOT/releases/0.2.1-alpha.1-manual
PNPM=$DSH_ROOT/tooling/pnpm-10.33.0/node_modules/.bin/pnpm
TARGET=0.2.1-alpha.1

mkdir -p "$NEW"
cp -n "$OLD/package.json" "$NEW/package.json"
cp -n "$OLD/.pnpmfile.cjs" "$NEW/.pnpmfile.cjs"
cp -n "$OLD/install-manifest.json" "$NEW/install-manifest.json"

python3 - "$NEW" "$TARGET" <<'PY'
import json, sys, pathlib
new, target = pathlib.Path(sys.argv[1]), sys.argv[2]
p = new / "package.json"
d = json.loads(p.read_text())
d["dependencies"]["@deepseek-ai/dsh"] = target
p.write_text(json.dumps(d, indent=2) + "\n")
f = new / ".pnpmfile.cjs"
f.write_text(f.read_text().replace('const DSH_RELEASE = "0.2.0-rc.2"', f'const DSH_RELEASE = "{target}"'))
m = new / "install-manifest.json"
md = json.loads(m.read_text())
md.setdefault("runtime", {})["version"] = target
md.setdefault("runtime", {})["requested"] = target
md["snapshotId"] = target + "-manual"
m.write_text(json.dumps(md, indent=2) + "\n")
print("staged package.json / .pnpmfile.cjs / install-manifest.json for", target)
PY

cd "$NEW"
"$PNPM" install --no-frozen-lockfile --reporter=append-only
echo "--- installed ---"
node -e "console.log('dsh =', require('$NEW/node_modules/@deepseek-ai/dsh/package.json').version)"
