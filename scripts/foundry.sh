#!/usr/bin/env bash
# Run a Foundry binary, wherever it happens to live.
#
# Locally Foundry usually sits in ~/.foundry/bin and is not always on PATH; in CI the toolchain
# action puts it on PATH somewhere else entirely. Resolving it in one place keeps every npm script
# and scripts/e2e.sh working in both.
#
#   scripts/foundry.sh forge test -vvv
#   scripts/foundry.sh anvil --port 8546
set -euo pipefail

cmd="${1:?usage: foundry.sh <forge|anvil|cast> [args...]}"
shift

if command -v "$cmd" >/dev/null 2>&1; then
  exec "$cmd" "$@"
fi

for dir in "${FOUNDRY_BIN:-}" "$HOME/.foundry/bin" /usr/local/bin; do
  [ -n "$dir" ] && [ -x "$dir/$cmd" ] && exec "$dir/$cmd" "$@"
done

echo "foundry.sh: could not find '$cmd'. Install Foundry (https://getfoundry.sh) or set FOUNDRY_BIN." >&2
exit 127
