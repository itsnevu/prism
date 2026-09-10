// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockSwapExecutor} from "../src/mocks/MockSwapExecutor.sol";
import {IndexVault} from "../src/IndexVault.sol";
import {IndexToken} from "../src/IndexToken.sol";
import {IndexFactory} from "../src/IndexFactory.sol";
import {VaultDeployer} from "../src/VaultDeployer.sol";

abstract contract BaseTest is Test {
    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address feeRecipient = makeAddr("fees");

    MockERC20 usdg;
    MockERC20 nvda;
    MockERC20 amd;
    MockERC20 avgo;
    MockERC20 tsm;
    MockOracle oracle;
    MockSwapExecutor executor;
    IndexFactory factory;
    IndexVault vault;
    IndexToken token;

    address[] assets;
    uint256 constant STALENESS = 1 hours;
    uint256 constant BAND = 300;
    uint256 constant COOLDOWN = 1 hours;
    uint256 constant MAX_LOSS = 100;
    uint256 constant INITIAL_NAV = 100e18;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        usdg = new MockERC20("USDG", "USDG", 6);
        nvda = new MockERC20("NVIDIA", "NVDA", 18);
        amd = new MockERC20("AMD", "AMD", 18);
        avgo = new MockERC20("Broadcom", "AVGO", 18);
        tsm = new MockERC20("TSMC", "TSM", 6); // deliberately odd decimals

        oracle = new MockOracle(owner);
        executor = new MockSwapExecutor(owner, oracle, 0);

        vm.startPrank(owner);
        oracle.setPrice(address(nvda), 180e18);
        oracle.setPrice(address(amd), 160e18);
        oracle.setPrice(address(avgo), 300e18);
        oracle.setPrice(address(tsm), 200e18);
        oracle.setPrice(address(usdg), 1e18); // the executor prices the USDG leg too
        vm.stopPrank();

        factory = new IndexFactory(owner, new VaultDeployer());
        vault = IndexVault(factory_create());
        token = vault.token();

        vm.prank(owner);
        vault.setKeeper(keeper, true);

        assets = [address(nvda), address(amd), address(avgo), address(tsm)];
        for (uint256 i; i < assets.length; ++i) {
            MockERC20(assets[i]).mint(alice, 1_000_000 * 10 ** MockERC20(assets[i]).decimals());
            MockERC20(assets[i]).mint(bob, 1_000_000 * 10 ** MockERC20(assets[i]).decimals());
            vm.prank(alice);
            MockERC20(assets[i]).approve(address(vault), type(uint256).max);
            vm.prank(bob);
            MockERC20(assets[i]).approve(address(vault), type(uint256).max);
        }
        for (uint256 i; i < 2; ++i) {
            address who = i == 0 ? alice : bob;
            usdg.mint(who, 1_000_000e6);
            vm.prank(who);
            usdg.approve(address(vault), type(uint256).max);
        }
    }

    function factory_create() internal returns (address) {
        IndexVault.ComponentInput[] memory comps = new IndexVault.ComponentInput[](4);
        comps[0] = IndexVault.ComponentInput(address(nvda), 4000, 5000);
        comps[1] = IndexVault.ComponentInput(address(amd), 2000, 3000);
        comps[2] = IndexVault.ComponentInput(address(avgo), 2000, 3000);
        comps[3] = IndexVault.ComponentInput(address(tsm), 2000, 3000);
        IndexVault.Config memory cfg = IndexVault.Config({
            name: "Prism Test Index",
            symbol: "pTEST",
            usdg: address(usdg),
            oracle: address(oracle),
            components: comps,
            maxStaleness: uint32(STALENESS),
            bandBps: uint16(BAND),
            initialNav1e18: INITIAL_NAV,
            fees: IndexVault.FeeParams({mgmtFeeBps: 50, mintFeeBps: 10, feeRecipient: feeRecipient}),
            rebalance: IndexVault.RebalanceParams({
                maxRebalanceLossBps: uint16(MAX_LOSS),
                cooldown: uint32(COOLDOWN),
                swapExecutor: address(executor)
            })
        });
        vm.prank(owner);
        return factory.createIndex(owner, cfg);
    }

    function balances(address who) internal view returns (uint256[] memory b) {
        b = new uint256[](assets.length);
        for (uint256 i; i < assets.length; ++i) b[i] = MockERC20(assets[i]).balanceOf(who);
    }

    /// Re-stamp every feed to now (USDG included, so the executor can still quote). (simulates the oracle publishing after a time warp).
    function refreshAll() internal {
        vm.startPrank(owner);
        for (uint256 i; i < assets.length; ++i) oracle.refresh(assets[i]);
        oracle.refresh(address(usdg));
        vm.stopPrank();
    }

    function mintAs(address who, uint256 amt) internal returns (uint256) {
        vm.prank(who);
        return vault.mint(amt, who);
    }
}
