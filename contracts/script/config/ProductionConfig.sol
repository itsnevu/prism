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
/// Robinhood Chain mainnet (4663). Run DeployInfra first, then:
///     forge script script/DeployProduction.s.sol --rpc-url $RPC_URL --broadcast
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

    // ── shared infrastructure on Robinhood Chain (4663) ──────────────────────
    /// Paxos USDG (docs.robinhood.com/chain/contracts).
    address public constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    /// ChainlinkPriceOracle + UniswapV3SwapExecutor from script/DeployInfra.s.sol.
    address public constant ORACLE = 0xB8aCb987db3e7A2F56b3e706E1417BA8Bef4983a;
    address public constant SWAP_EXECUTOR = 0xf7c70159bEF7544149E41A7666316839459378ad;

    /// Owner of the factory and every vault. Use a multisig, never an EOA.
    address public constant PROTOCOL_OWNER = 0xC96c8E663205Ec224eA579bC2DDD2ff02E7D071F;
    /// Receives the streamed management fee and the mint/redeem fee.
    address public constant FEE_RECIPIENT = 0xC96c8E663205Ec224eA579bC2DDD2ff02E7D071F;
    /// Allowed to call rebalance/rebalanceToTarget. May be the keeper bot's hot wallet.
    address public constant KEEPER = 0xC96c8E663205Ec224eA579bC2DDD2ff02E7D071F;

    // ── baskets ──────────────────────────────────────────────────────────────

    function indexCount() public pure returns (uint256) {
        return 3;
    }

    function indexCfg(uint256 i) public pure returns (IndexCfg memory) {
        if (i == 0) {
            // Chainlink stock feeds run 24/5: a weekend gap is ~64h, so 80h before a leg is stale.
            return IndexCfg("Prism Semis", "pSEMI", 80 hours, 300, 238.10e18, 50, 10, 100, 6 hours);
        } else if (i == 1) {
            return IndexCfg("Prism Commodities", "pMETL", 80 hours, 300, 33.20e18, 50, 10, 100, 6 hours);
        } else if (i == 2) {
            return IndexCfg("Prism Degen", "pDGEN", 80 hours, 500, 100e18, 50, 10, 150, 6 hours);
        }
        revert("no such index");
    }

    /// Real token addresses for basket `i`. Every `asset` must be filled in before deploying.
    function assetsFor(uint256 i) public pure returns (AssetCfg[] memory a) {
        // Robinhood Stock Tokens (api.robinhood.com/rhj/assets); each has a Chainlink feed on 4663.
        if (i == 0) {
            // AVGO / QCOM have Stock Tokens but no Chainlink feed on this chain yet.
            a = new AssetCfg[](6);
            a[0] = AssetCfg(0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, "NVDA", 3000, 4000);
            a[1] = AssetCfg(0x86923f96303D656E4aa86D9d42D1e57ad2023fdC, "AMD", 1500, 2500);
            a[2] = AssetCfg(0x58FfE4a942d3885bAa22D7520691F611EF09e7AA, "TSM", 2000, 3000);
            a[3] = AssetCfg(0x47F93d52cBeC7C6D2CfC080e154002370a60dAEA, "ASML", 1200, 2200);
            a[4] = AssetCfg(0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD, "MU", 1300, 2300);
            a[5] = AssetCfg(0xc72b96e0E48ecd4DC75E1e45396e26300BC39681, "INTC", 1000, 2000);
        } else if (i == 1) {
            // Silver + oil: the only commodity ETFs with both a Stock Token and a feed here.
            a = new AssetCfg[](2);
            a[0] = AssetCfg(0x411eFb0E7f985935DAec3D4C3ebaEa0d0AD7D89f, "SLV", 7000, 8000);
            a[1] = AssetCfg(0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344, "USO", 3000, 4000);
        } else if (i == 2) {
            // No memecoins are issued on Robinhood Chain; high-beta Stock Tokens instead.
            a = new AssetCfg[](4);
            a[0] = AssetCfg(0x1b0E319c6A659F002271B69dB8A7df2F911c153E, "GME", 2500, 3500);
            a[1] = AssetCfg(0xec262a75e413fAfD0dF80480274532C79D42da09, "MSTR", 2500, 3500);
            a[2] = AssetCfg(0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A, "PLTR", 2500, 3500);
            a[3] = AssetCfg(0x322F0929c4625eD5bAd873c95208D54E1c003b2d, "TSLA", 2500, 3500);
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
