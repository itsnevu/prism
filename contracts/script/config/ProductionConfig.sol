// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IndexVault} from "../../src/IndexVault.sol";

/// @notice The one file to edit before a real deployment.
///
/// Everything Prism needs from the target chain lives here: the USDG address, the price oracle,
/// the swap venue, and the real tokenized-equity / commodity / memecoin addresses for each basket.
/// It is Solidity rather than JSON on purpose — the addresses are compile-checked, they show up in
/// a diff, and `DeployProduction` refuses to run while any of them is still zero.
///
/// Robinhood Chain has not published these yet. Fill them in, run:
///     forge script script/DeployProduction.s.sol --rpc-url $RPC_URL --broadcast --verify
abstract contract ProductionConfig {
    struct AssetCfg {
        address asset;
        string symbol;
        uint16 targetWeightBps; // must sum to 10_000 per index
        uint16 maxWeightBps;
    }

    struct IndexCfg {
        string name;
        string symbol;
        uint32 maxStaleness; // stocks: past the closing bell + a margin. memecoins: minutes.
        uint16 bandBps; // rebalance trigger
        uint256 initialNav1e18; // bootstrap NAV per index token
        uint16 mgmtFeeBps; // per year
        uint16 mintFeeBps; // mint and redeem
        uint16 maxRebalanceLossBps;
        uint32 rebalanceCooldown;
    }

    // ── shared infrastructure on the target chain ────────────────────────────
    address public constant USDG = address(0);
    address public constant ORACLE = address(0);
    address public constant SWAP_EXECUTOR = address(0);

    /// Owner of the factory and every vault. Use a multisig, never an EOA.
    address public constant PROTOCOL_OWNER = address(0);
    /// Receives the streamed management fee and the mint/redeem fee.
    address public constant FEE_RECIPIENT = address(0);
    /// Allowed to call rebalance/rebalanceToTarget. May be the keeper bot's hot wallet.
    address public constant KEEPER = address(0);

    // ── baskets ──────────────────────────────────────────────────────────────

    function indexCount() public pure returns (uint256) {
        return 3;
    }

    function indexCfg(uint256 i) public pure returns (IndexCfg memory) {
        if (i == 0) {
            return IndexCfg("Prism Semis", "pSEMI", 26 hours, 300, 238.10e18, 50, 10, 100, 6 hours);
        } else if (i == 1) {
            return IndexCfg("Prism Metals", "pMETL", 72 hours, 300, 33.20e18, 50, 10, 100, 6 hours);
        } else if (i == 2) {
            return IndexCfg("Prism Degen", "pDGEN", 15 minutes, 500, 0.19e18, 50, 10, 150, 1 hours);
        }
        revert("no such index");
    }

    /// Real token addresses for basket `i`. Every `asset` must be filled in before deploying.
    function assetsFor(uint256 i) public pure returns (AssetCfg[] memory a) {
        if (i == 0) {
            a = new AssetCfg[](8);
            a[0] = AssetCfg(address(0), "NVDA", 2000, 3000);
            a[1] = AssetCfg(address(0), "AMD", 1100, 2000);
            a[2] = AssetCfg(address(0), "AVGO", 1400, 2400);
            a[3] = AssetCfg(address(0), "TSM", 1600, 2600);
            a[4] = AssetCfg(address(0), "ASML", 1000, 2000);
            a[5] = AssetCfg(address(0), "MU", 900, 1800);
            a[6] = AssetCfg(address(0), "QCOM", 1000, 2000);
            a[7] = AssetCfg(address(0), "INTC", 1000, 2000);
        } else if (i == 1) {
            a = new AssetCfg[](3);
            a[0] = AssetCfg(address(0), "SLV", 7000, 8000);
            a[1] = AssetCfg(address(0), "PPLT", 1500, 2500);
            a[2] = AssetCfg(address(0), "COPX", 1500, 2500);
        } else if (i == 2) {
            a = new AssetCfg[](4);
            a[0] = AssetCfg(address(0), "DOGE", 2500, 3500);
            a[1] = AssetCfg(address(0), "SHIB", 2500, 3500);
            a[2] = AssetCfg(address(0), "PEPE", 2500, 3500);
            a[3] = AssetCfg(address(0), "WIF", 2500, 3500);
        } else {
            revert("no such index");
        }
    }

    /// Convert to the vault's own component type.
    function componentsFor(uint256 i) public pure returns (IndexVault.ComponentInput[] memory comps) {
        AssetCfg[] memory a = assetsFor(i);
        comps = new IndexVault.ComponentInput[](a.length);
        for (uint256 j; j < a.length; ++j) {
            comps[j] = IndexVault.ComponentInput(a[j].asset, a[j].targetWeightBps, a[j].maxWeightBps);
        }
    }
}
