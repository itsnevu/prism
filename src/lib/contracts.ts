import type { Address } from "viem";
import { localDeployment } from "./generated/deployments";
import { activeChain } from "./chain";

export {
  IndexVaultAbi,
  IndexTokenAbi,
  IndexFactoryAbi,
  MockOracleAbi,
  MockERC20Abi,
  MockSwapExecutorAbi,
} from "./generated/abis";

export type IndexKey = "pSEMI" | "pMETL" | "pDGEN";
export const INDEX_KEYS: IndexKey[] = ["pSEMI", "pMETL", "pDGEN"];

export type IndexDeployment = {
  key: IndexKey;
  name: string;
  vault: Address;
  token: Address;
  assets: readonly Address[];
  assetSymbols: readonly string[];
};

export type Deployment = {
  chainId: number;
  network: string;
  deployer: Address;
  usdg: Address;
  oracle: Address;
  swapExecutor: Address;
  factory: Address;
  indexes: IndexDeployment[];
};

const INDEX_NAMES: Record<IndexKey, string> = {
  pSEMI: "SEMIS",
  pMETL: "COMMODITIES",
  pDGEN: "DEGEN",
};

function load(): Deployment | null {
  const d = localDeployment as unknown as
    | (Record<string, unknown> & { chainIdNum: number })
    | null;
  if (!d) return null;
  const indexes: IndexDeployment[] = [];
  for (const key of INDEX_KEYS) {
    const ix = d[key] as IndexDeployment | undefined;
    if (!ix) continue;
    indexes.push({ ...ix, key, name: INDEX_NAMES[key] });
  }
  return {
    chainId: d.chainIdNum,
    network: String(d.network),
    deployer: d.deployer as Address,
    usdg: d.usdg as Address,
    oracle: d.oracle as Address,
    swapExecutor: d.swapExecutor as Address,
    factory: d.factory as Address,
    indexes,
  };
}

/** Deployment manifest for the active chain, or null if none (frontend falls back to static copy). */
export const deployment: Deployment | null = (() => {
  const d = load();
  if (!d) return null;
  return d.chainId === activeChain.id ? d : null;
})();

export const hasDeployment = deployment !== null && deployment.indexes.length > 0;
