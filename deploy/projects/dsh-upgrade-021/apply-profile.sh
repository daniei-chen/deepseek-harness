#!/bin/bash
# Upgrade the LIVE web profile (~/.dsh/profiles/web) from the 0.2.0-rc.2 pinning to
# 0.2.1-alpha.1, and install the rebuilt mobile-adaptation client plugin.
# Idempotent-ish; backs every touched config file up first. Does NOT restart the service.
set -euo pipefail

PROF=/home/agentuser/.dsh/profiles/web
PNPM=/opt/lightvela/dsh/tooling/pnpm-10.33.0/node_modules/.bin/pnpm
TGZ="$1"                                  # built plugin tarball
TARGET=0.2.1-alpha.1
TS=$(date +%Y%m%d-%H%M%S)
BK=$PROF/local/backups/upgrade-$TS
mkdir -p "$BK" "$PROF/local/plugins"

for f in .pnpmfile.cjs package.json cordis.patch.yml pnpm-lock.yaml; do cp -a "$PROF/$f" "$BK/"; done
echo "[backup] $BK"
cp -a "$TGZ" "$PROF/local/plugins/"
TGZNAME=$(basename "$TGZ")

# 1. repin the pnpm hook to the new runtime version
sed -i "s/^const DSH_RELEASE = \".*\";/const DSH_RELEASE = \"$TARGET\";/" "$PROF/.pnpmfile.cjs"
grep -m1 'const DSH_RELEASE' "$PROF/.pnpmfile.cjs"

# 2. drop the packer-materialized 0.2.0-rc.2 copies so pnpm resolves the matching versions
rm -rf "$PROF/node_modules/@deepseek-ai/cosmokit" \
       "$PROF/node_modules/@deepseek-ai/dsh-credentials-local" \
       "$PROF/node_modules/@deepseek-ai/schemastery"

# 3. declare the dependencies: credentials-local (runtime peer) + the mobile layer
python3 - "$PROF/package.json" "$TARGET" "$TGZNAME" <<'PY'
import json, sys, pathlib
p, target, tgz = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
d = json.loads(p.read_text())
deps = d.setdefault('dependencies', {})
deps['@deepseek-ai/dsh-credentials-local'] = target
deps['@dsh-android/dsh-client-ui-responsive'] = f'file:local/plugins/{tgz}'
d['dependencies'] = dict(sorted(deps.items()))
p.write_text(json.dumps(d, indent=2) + '\n')
print('[deps]', json.dumps(d['dependencies'], indent=1))
PY

cd "$PROF"
"$PNPM" install --no-frozen-lockfile --config.auto-install-peers=false --reporter=append-only 2>&1 | tail -4

# 4. mount the plugin row (ui-layout stays enabled; the two "open in app" rows are
#    meaningless on a phone browser — the upstream README for this plugin suggests
#    disabling them, and it is reversible)
if ! grep -q "ui-responsive" "$PROF/cordis.patch.yml"; then
  cat >> "$PROF/cordis.patch.yml" <<'YML'
- insert:
    - id: ui-responsive
      name: '@dsh-android/dsh-client-ui-responsive'
- id: open-in-app
  disabled: true
- id: ui-open-in-app
  disabled: true
YML
  echo "[patch] ui-responsive inserted"
else
  echo "[patch] ui-responsive already present"
fi

echo "--- installed versions ---"
for p in dsh-credentials-local cosmokit schemastery; do
  python3 -c "import json;print('  $p =', json.load(open('$PROF/node_modules/@deepseek-ai/$p/package.json'))['version'])" 2>/dev/null || echo "  $p MISSING"
done
python3 -c "import json;d=json.load(open('$PROF/node_modules/@dsh-android/dsh-client-ui-responsive/package.json'));print('  plugin =',d['version'])"
