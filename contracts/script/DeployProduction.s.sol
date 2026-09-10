// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IndexVault} from "../src/IndexVault.sol";
import {IndexFactory} from "../src/IndexFactory.sol";
import {VaultDeployer} from "../src/VaultDeployer.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {ProductionConfig} from "./config/ProductionConfig.sol";

/// @notice Real-network deployment. Deploys nothing but the factory and the vaults — USDG, the
///         oracle and the swap venue must already exist on the chain and are read from
///         `ProductionConfig`. No mocks, no seed mint, no test balances.
///
///         Preflight (`--sig 'check()'`) validates the config without broadcasting: every address
///         non-zero, weights summing to 10000, and a live non-stale oracle price for every leg.
///
///         forge script script/DeployProduction.s.sol --sig 'check()' --rpc-url $RPC_URL
///         forge script script/DeployProduction.s.sol --rpc-url $RPC_URL --broadcast --verify
contract DeployProduction is Script, ProductionConfig {
    string json = "deployments";

    error NotConfigured(string what);
    error WeightsDoNotSum(string symbol, uint256 sum);
    error NoOraclePrice(string symbol, address asset);
    error OraclePriceStale(string symbol, address asset, uint256 ageSec);

    /// Dry run: reverts with a named error on the first thing that is not production-ready.
    function check() public view {
        _requireAddr(USDG, "USDG");
        _requireAddr(ORACLE, "ORACLE");
        _requireAddr(SWAP_EXECUTOR, "SWAP_EXECUTOR");
        _requireAddr(PROTOCOL_OWNER, "PROTOCOL_OWNER");
        _requireAddr(FEE_RECIPIENT, "FEE_RECIPIENT");

        for (uint256 i; i < indexCount(); ++i) {
            IndexCfg memory ix = indexCfg(i);
            AssetCfg[] memory a = assetsFor(i);
            uint256 sum;
            for (uint256 j; j < a.length; ++j) {
                if (a[j].asset == address(0)) revert NotConfigured(string.concat(ix.symbol, ".", a[j].symbol));
                sum += a[j].targetWeightBps;
                (uint256 price, uint256 updatedAt) = IPriceOracle(ORACLE).getPrice(a[j].asset);
                if (price == 0) revert NoOraclePrice(ix.symbol, a[j].asset);
                uint256 age = block.timestamp - updatedAt;
                if (age > ix.maxStaleness) revert OraclePriceStale(ix.symbol, a[j].asset, age);
            }
            if (sum != 10_000) revert WeightsDoNotSum(ix.symbol, sum);
            console.log("ok:", ix.symbol, a.length, "legs priced and in band");
        }
        console.log("config is deployable");
    }

    function run() external {
        check(); // never broadcast a half-filled config
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        VaultDeployer vaultDeployer = new VaultDeployer();
        IndexFactory factory = new IndexFactory(vm.addr(pk), vaultDeployer); // ownership handed over at the end
        console.log("vaultDeployer", address(vaultDeployer));
        console.log("factory", address(factory));

        vm.serializeUint(json, "chainIdNum", block.chainid);
        vm.serializeAddress(json, "deployer", vm.addr(pk));
        vm.serializeAddress(json, "usdg", USDG);
        vm.serializeAddress(json, "oracle", ORACLE);
        vm.serializeAddress(json, "swapExecutor", SWAP_EXECUTOR);
        vm.serializeAddress(json, "factory", address(factory));

        for (uint256 i; i < indexCount(); ++i) {
            _deployIndex(factory, i);
        }

        // hand the factory to the multisig; each vault is already owned by it
        factory.transferOwnership(PROTOCOL_OWNER);
        vm.stopBroadcast();

        string memory out = vm.serializeString(json, "network", vm.toString(block.chainid));
        vm.writeJson(out, "./deployments/production.json");
        console.log("wrote deployments/production.json - run: DEPLOYMENT=production npm run abi:sync");
    }

    function _deployIndex(IndexFactory factory, uint256 i) internal {
        IndexCfg memory ix = indexCfg(i);
        AssetCfg[] memory a = assetsFor(i);

        IndexVault.Config memory cfg = IndexVault.Config({
            name: ix.name,
            symbol: ix.symbol,
            usdg: USDG,
            oracle: ORACLE,
            components: componentsFor(i),
            maxStaleness: ix.maxStaleness,
            bandBps: ix.bandBps,
            initialNav1e18: ix.initialNav1e18,
            fees: IndexVault.FeeParams({
                mgmtFeeBps: ix.mgmtFeeBps,
                mintFeeBps: ix.mintFeeBps,
                feeRecipient: FEE_RECIPIENT
            }),
            rebalance: IndexVault.RebalanceParams({
                maxRebalanceLossBps: ix.maxRebalanceLossBps,
                cooldown: ix.rebalanceCooldown,
                swapExecutor: SWAP_EXECUTOR
            })
        });

        IndexVault vault = IndexVault(factory.createIndex(PROTOCOL_OWNER, cfg));
        console.log(ix.symbol, "vault", address(vault));
        console.log(ix.symbol, "token", address(vault.token()));

        address[] memory addrs = new address[](a.length);
        string[] memory symbols = new string[](a.length);
        for (uint256 j; j < a.length; ++j) {
            addrs[j] = a[j].asset;
            symbols[j] = a[j].symbol;
        }
        string memory obj = string.concat("idx_", ix.symbol);
        vm.serializeAddress(obj, "vault", address(vault));
        vm.serializeAddress(obj, "token", address(vault.token()));
        vm.serializeAddress(obj, "assets", addrs);
        string memory o = vm.serializeString(obj, "assetSymbols", symbols);
        vm.serializeString(json, ix.symbol, o);
    }

    function _requireAddr(address a, string memory what) internal pure {
        if (a == address(0)) revert NotConfigured(what);
    }
}
