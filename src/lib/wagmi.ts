import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { anvil, targetChain } from "./chain";

export const wagmiConfig = createConfig({
  chains: [anvil, targetChain],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(anvil.rpcUrls.default.http[0]),
    [targetChain.id]: http(targetChain.rpcUrls.default.http[0]),
  },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
