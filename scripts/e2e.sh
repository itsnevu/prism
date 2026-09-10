#!/usr/bin/env bash
# Browser wallet tests. Always runs against a *throwaway* anvil on its own port: reusing a chain
# leaves approvals and balances behind from the previous run, which made these tests order-dependent.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${E2E_ANVIL_PORT:-8546}"
RPC_URL="http://127.0.0.1:${PORT}"
export RPC_URL

anvil_pid=""
cleanup() {
  [ -n "$anvil_pid" ] && kill "$anvil_pid" 2>/dev/null || true
  # An interrupted run leaves Playwright's web server holding 3100. The next run then finds a server
  # built against a chain that no longer exists, and fails in ways that look like product bugs.
  lsof -ti tcp:3100 2>/dev/null | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

# Reclaim both ports from any earlier run that did not clean up.
lsof -ti "tcp:${PORT}" 2>/dev/null | xargs -r kill 2>/dev/null || true
lsof -ti tcp:3100 2>/dev/null | xargs -r kill 2>/dev/null || true

echo "starting a fresh anvil on $RPC_URL"
"$HERE/foundry.sh" anvil --chain-id 31337 --port "$PORT" >/tmp/prism-e2e-anvil.log 2>&1 &
anvil_pid=$!

for _ in $(seq 1 60); do
  curl -s -X POST -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}' "$RPC_URL" >/dev/null 2>&1 && break
  sleep 0.25
done

npm run deploy:local >/dev/null
echo "deployed; running browser tests"
NEXT_PUBLIC_RPC_URL="$RPC_URL" npx playwright test "$@"
