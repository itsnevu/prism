/**
 * A minimal EIP-1193 provider injected as `window.ethereum` before the app boots.
 *
 * It is a thin JSON-RPC proxy to the local anvil node. Anvil keeps its dev accounts unlocked, so
 * `eth_sendTransaction` is signed by the node itself and no key ever touches the page — which is
 * what lets these tests exercise the real wagmi connect → approve → write path end to end instead
 * of stubbing the contract calls.
 */
export function injectedWalletScript(rpcUrl: string, account: string, chainIdHex: string) {
  return `(() => {
  const RPC = ${JSON.stringify(rpcUrl)};
  const ACCOUNT = ${JSON.stringify(account)};
  const CHAIN_ID = ${JSON.stringify(chainIdHex)};

  let connected = false;
  let nextId = 1;
  const listeners = new Map();

  async function rpc(method, params) {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params: params ?? [] }),
    });
    const json = await res.json();
    if (json.error) {
      const err = new Error(json.error.message || "rpc error");
      err.code = json.error.code ?? -32000;
      err.data = json.error.data;
      throw err;
    }
    return json.result;
  }

  const provider = {
    isMetaMask: true,
    isPrismTestWallet: true,
    async request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
          connected = true;
          return [ACCOUNT];
        case "eth_accounts":
          return connected ? [ACCOUNT] : [];
        case "eth_chainId":
          return CHAIN_ID;
        case "net_version":
          return String(parseInt(CHAIN_ID, 16));
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "wallet_requestPermissions":
          connected = true;
          return [{ parentCapability: "eth_accounts" }];
        case "wallet_revokePermissions":
          connected = false;
          return null;
        case "eth_sendTransaction": {
          // anvil signs with the unlocked dev account
          const tx = { ...(params?.[0] ?? {}) };
          delete tx.gas;
          return rpc("eth_sendTransaction", [tx]);
        }
        default:
          return rpc(method, params);
      }
    },
    on(event, handler) {
      const set = listeners.get(event) ?? new Set();
      set.add(handler);
      listeners.set(event, set);
      return provider;
    },
    removeListener(event, handler) {
      listeners.get(event)?.delete(handler);
      return provider;
    },
  };

  Object.defineProperty(window, "ethereum", { value: provider, configurable: true, writable: true });
  // EIP-6963 discovery, which is how wagmi's injected connector finds modern wallets.
  const info = {
    uuid: "11111111-2222-3333-4444-555555555555",
    name: "Prism Test Wallet",
    rdns: "capital.prism.test",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }),
    );
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();`;
}
