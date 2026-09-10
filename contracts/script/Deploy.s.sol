// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockSwapExecutor} from "../src/mocks/MockSwapExecutor.sol";
import {IndexVault} from "../src/IndexVault.sol";
import {IndexFactory} from "../src/IndexFactory.sol";
import {VaultDeployer} from "../src/VaultDeployer.sol";

/// @notice Local deployment: mocks + oracle + factory + pSEMI / pMETL / pDGEN, seeded and live.
///         Run: forge script script/Deploy.s.sol --rpc-url anvil --broadcast
///         Writes deployments/local.json for the frontend (scripts/sync-abi.mjs reads it).
contract Deploy is Script {
    // Anvil default accounts
    address constant ANVIL_1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    struct IndexSpec {
        string name;
        string symbol;
        uint32 staleness;
        uint16 band;
        uint256 initialNav;
        uint16 maxLoss;
        uint32 cooldown;
    }

    struct AssetSpec {
        string name;
        string symbol;
        uint8 decimals;
        uint256 price1e18;
    }

    MockOracle oracle;
    MockSwapExecutor executor;
    IndexFactory factory;
    MockERC20 usdg;
    address deployer;

    string json = "deployments";

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        oracle = new MockOracle(deployer);
        oracle.setPrice(address(usdg), 1e18); // the executor prices the USDG leg of every entry/exit
        executor = new MockSwapExecutor(deployer, oracle, 5); // 5 bps mock slippage
        factory = new IndexFactory(deployer, new VaultDeployer());

        vm.serializeAddress(json, "chainId", address(uint160(block.chainid)));
        vm.serializeUint(json, "chainIdNum", block.chainid);
        vm.serializeAddress(json, "deployer", deployer);
        vm.serializeAddress(json, "usdg", address(usdg));
        vm.serializeAddress(json, "oracle", address(oracle));
        vm.serializeAddress(json, "swapExecutor", address(executor));
        vm.serializeAddress(json, "factory", address(factory));

        // ───────── pSEMI ─────────
        AssetSpec[] memory semi = new AssetSpec[](8);
        semi[0] = AssetSpec("NVIDIA", "NVDA", 18, 182.40e18);
        semi[1] = AssetSpec("AMD", "AMD", 18, 164.10e18);
        semi[2] = AssetSpec("Broadcom", "AVGO", 18, 331.70e18);
        semi[3] = AssetSpec("TSMC", "TSM", 18, 238.90e18);
        semi[4] = AssetSpec("ASML", "ASML", 18, 812.30e18);
        semi[5] = AssetSpec("Micron", "MU", 18, 129.60e18);
        semi[6] = AssetSpec("Qualcomm", "QCOM", 18, 158.20e18);
        semi[7] = AssetSpec("Intel", "INTC", 18, 24.85e18);
        uint16[] memory semiW = _w8(2000, 1100, 1400, 1600, 1000, 900, 1000, 1000);
        uint16[] memory semiCap = _w8(3000, 2000, 2400, 2600, 2000, 1800, 2000, 2000);
        _deployIndex(IndexSpec("Prism Semis", "pSEMI", 26 hours, 300, 238.10e18, 100, 6 hours), semi, semiW, semiCap);

        // ───────── pMETL ─────────
        AssetSpec[] memory metl = new AssetSpec[](3);
        metl[0] = AssetSpec("iShares Silver", "SLV", 18, 39.20e18);
        metl[1] = AssetSpec("Sprott Platinum", "PPLT", 18, 128.40e18);
        metl[2] = AssetSpec("Copper Miners", "COPX", 18, 51.10e18);
        uint16[] memory metlW = _w3(7000, 1500, 1500);
        uint16[] memory metlCap = _w3(8000, 2500, 2500);
        _deployIndex(IndexSpec("Prism Metals", "pMETL", 72 hours, 300, 33.20e18, 100, 6 hours), metl, metlW, metlCap);

        // ───────── pDGEN ─────────
        AssetSpec[] memory dgen = new AssetSpec[](4);
        dgen[0] = AssetSpec("Dogecoin", "DOGE", 18, 0.21e18);
        dgen[1] = AssetSpec("Shiba Inu", "SHIB", 18, 0.0000226e18);
        dgen[2] = AssetSpec("Pepe", "PEPE", 18, 0.0000118e18);
        dgen[3] = AssetSpec("dogwifhat", "WIF", 18, 1.84e18);
        uint16[] memory dgenW = _w4(2500, 2500, 2500, 2500);
        uint16[] memory dgenCap = _w4(3500, 3500, 3500, 3500);
        _deployIndex(IndexSpec("Prism Degen", "pDGEN", 15 minutes, 500, 0.19e18, 150, 1 hours), dgen, dgenW, dgenCap);

        // deployer + anvil #1 get USDG too
        usdg.mint(deployer, 1_000_000e6);
        usdg.mint(ANVIL_1, 1_000_000e6);

        vm.stopBroadcast();

        string memory out = vm.serializeString(json, "network", "anvil");
        vm.writeJson(out, "./deployments/local.json");
        console.log("wrote deployments/local.json");
    }

    function _deployAssets(AssetSpec[] memory specs, uint16[] memory weights, uint16[] memory caps)
        internal
        returns (IndexVault.ComponentInput[] memory comps, address[] memory addrs, string[] memory symbols)
    {
        uint256 n = specs.length;
        comps = new IndexVault.ComponentInput[](n);
        addrs = new address[](n);
        symbols = new string[](n);
        for (uint256 i; i < n; ++i) {
            MockERC20 t = new MockERC20(specs[i].name, specs[i].symbol, specs[i].decimals);
            oracle.setPrice(address(t), specs[i].price1e18);
            t.mint(deployer, 10_000_000 * 10 ** specs[i].decimals);
            t.mint(ANVIL_1, 10_000_000 * 10 ** specs[i].decimals);
            comps[i] = IndexVault.ComponentInput(address(t), weights[i], caps[i]);
            addrs[i] = address(t);
            symbols[i] = specs[i].symbol;
        }
    }

    function _deployIndex(IndexSpec memory ix, AssetSpec[] memory specs, uint16[] memory weights, uint16[] memory caps) internal {
        (IndexVault.ComponentInput[] memory comps, address[] memory addrs, string[] memory symbols) = _deployAssets(specs, weights, caps);

        IndexVault.Config memory cfg = IndexVault.Config({
            name: ix.name,
            symbol: ix.symbol,
            usdg: address(usdg),
            oracle: address(oracle),
            components: comps,
            maxStaleness: ix.staleness,
            bandBps: ix.band,
            initialNav1e18: ix.initialNav,
            fees: IndexVault.FeeParams({mgmtFeeBps: 50, mintFeeBps: 10, feeRecipient: deployer}),
            rebalance: IndexVault.RebalanceParams({maxRebalanceLossBps: ix.maxLoss, cooldown: ix.cooldown, swapExecutor: address(executor)})
        });
        IndexVault vault = IndexVault(factory.createIndex(deployer, cfg));

        // seed: approve + one initial mint so nav() is live
        for (uint256 i; i < addrs.length; ++i) MockERC20(addrs[i]).approve(address(vault), type(uint256).max);
        vault.mint(1_000e18, deployer);

        console.log(ix.symbol, "vault", address(vault));
        console.log(ix.symbol, "token", address(vault.token()));
        console.log(ix.symbol, "nav ", vault.nav());

        _record(ix.symbol, vault, addrs, symbols);
    }

    function _record(string memory key, IndexVault vault, address[] memory addrs, string[] memory symbols) internal {
        string memory obj = string.concat("idx_", key);
        vm.serializeAddress(obj, "vault", address(vault));
        vm.serializeAddress(obj, "token", address(vault.token()));
        vm.serializeAddress(obj, "assets", addrs);
        string memory o = vm.serializeString(obj, "assetSymbols", symbols);
        vm.serializeString(json, key, o);
    }

    function _w8(uint16 a, uint16 b, uint16 c, uint16 d, uint16 e, uint16 f, uint16 g, uint16 h) internal pure returns (uint16[] memory w) {
        w = new uint16[](8);
        w[0] = a; w[1] = b; w[2] = c; w[3] = d; w[4] = e; w[5] = f; w[6] = g; w[7] = h;
    }

    function _w4(uint16 a, uint16 b, uint16 c, uint16 d) internal pure returns (uint16[] memory w) {
        w = new uint16[](4);
        w[0] = a; w[1] = b; w[2] = c; w[3] = d;
    }

    function _w3(uint16 a, uint16 b, uint16 c) internal pure returns (uint16[] memory w) {
        w = new uint16[](3);
        w[0] = a; w[1] = b; w[2] = c;
    }
}
