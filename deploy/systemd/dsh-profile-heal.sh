#!/bin/bash
set -u
P=/home/agentuser/.dsh/profiles/web/node_modules/@deepseek-ai
S=/usr/local/share/dsh-profile-stash/@deepseek-ai
healed=""
for p in cosmokit dsh-credentials-local schemastery; do
  if [ ! -f "$P/$p/package.json" ]; then
    mkdir -p "$P/$p"
    cp -a "$S/$p/." "$P/$p/"
    chown -R agentuser:agentuser "$P/$p"
    healed="$healed $p"
  fi
done
if [ -n "$healed" ]; then
  logger -t dsh-profile-heal "restored:$healed"
  if [ "${1:-}" = "--restart" ]; then systemctl restart deepseek-harness.service; fi
fi
exit 0
