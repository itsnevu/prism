// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {IndexVault} from "../src/IndexVault.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockSwapExecutor} from "../src/mocks/MockSwapExecutor.sol";

/// Covers the two things the basket-only vault could not do: enter/exit in USDG, and rebalance
/// without a keeper hand-picking the pairs.
contract UsdgAndSolverTest is BaseTest {
    uint16 constant SLIP = 50; // 0.5% tolerance handed to the solver

    function setUp() public override {
        super.setUp();
        mintAs(alice, 1_000e18); // seed the basket so NAV is live
    }

    // ───────────── mintWithUSDG ─────────────

    function test_mintWithUSDGIssuesSharesAtNav() public {
        uint256 navBefore = vault.nav();
        uint256 expected = vault.previewMintWithUSDG(10_000e6);

        vm.prank(bob);
        uint256 got = vault.mintWithUSDG(10_000e6, expected * 99 / 100, bob);

        assertApproxEqRel(got, expected, 0.005e18, "shares should track the preview");
        assertEq(token.balanceOf(bob), got);
        // existing holders are untouched: NAV per token does not move on a zero-slippage fill
        assertApproxEqRel(vault.nav(), navBefore, 0.001e18, "nav per token unchanged");
        assertEq(usdg.balanceOf(address(vault)), 0, "no USDG stranded in the vault");
    }

    function test_mintWithUSDGSpendsEveryUsdgAcrossTheBasket() public {
        vm.prank(bob);
        vault.mintWithUSDG(10_000e6, 0, bob);

        // every leg got bought, and the basket is still at target weights
        uint256[] memory w = vault.currentWeightsBps();
        for (uint256 i; i < w.length; ++i) {
            assertApproxEqAbs(w[i], vault.component(i).targetWeightBps, 5, "leg drifted off target");
        }
    }

    function test_mintWithUSDGSlippageGuard() public {
        uint256 expected = vault.previewMintWithUSDG(10_000e6);
        vm.prank(owner);
        executor.setSlippageBps(500); // 5% worse than oracle

        vm.prank(bob);
        vm.expectPartialRevert(IndexVault.SlippageExceeded.selector);
        vault.mintWithUSDG(10_000e6, expected, bob);
    }

    function test_mintWithUSDGChargesMintFee() public {
        uint256 feeBefore = token.balanceOf(feeRecipient);
        vm.prank(bob);
        uint256 got = vault.mintWithUSDG(10_000e6, 0, bob);
        uint256 fee = token.balanceOf(feeRecipient) - feeBefore;
        assertApproxEqRel(fee, got * vault.mintFeeBps() / vault.BPS(), 0.01e18, "mint fee in index tokens");
    }

    function test_mintWithUSDGRevertsOnStaleLeg() public {
        vm.prank(owner);
        oracle.markStale(address(nvda), STALENESS + 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(nvda)));
        vault.mintWithUSDG(10_000e6, 0, bob);
    }

    function test_mintWithUSDGRevertsWithoutExecutor() public {
        vm.prank(owner);
        vault.setSwapExecutor(address(0));
        vm.prank(bob);
        vm.expectRevert(IndexVault.NoSwapExecutor.selector);
        vault.mintWithUSDG(10_000e6, 0, bob);
    }

    // ───────────── redeemForUSDG ─────────────

    function test_redeemForUSDGReturnsBasketValue() public {
        vm.prank(bob);
        uint256 shares = vault.mintWithUSDG(10_000e6, 0, bob);

        uint256 expected = vault.previewRedeemForUSDG(shares);
        uint256 before = usdg.balanceOf(bob);
        vm.prank(bob);
        uint256 out = vault.redeemForUSDG(shares, expected * 99 / 100, bob);

        assertApproxEqRel(out, expected, 0.005e18, "USDG out should track the preview");
        assertEq(usdg.balanceOf(bob) - before, out);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_usdgRoundTripLossBoundedByFees() public {
        uint256 usdgIn = 10_000e6;
        uint256 before = usdg.balanceOf(bob);

        vm.prank(bob);
        uint256 shares = vault.mintWithUSDG(usdgIn, 0, bob);
        vm.prank(bob);
        vault.redeemForUSDG(shares, 0, bob);

        uint256 lost = before - usdg.balanceOf(bob);
        // two 10bp fees plus rounding; well under 1%
        assertLt(lost, usdgIn / 100, "round trip should only cost fees");
    }

    function test_redeemForUSDGSlippageGuard() public {
        vm.prank(bob);
        uint256 shares = vault.mintWithUSDG(10_000e6, 0, bob);
        uint256 expected = vault.previewRedeemForUSDG(shares);

        vm.prank(owner);
        executor.setSlippageBps(500);

        vm.prank(bob);
        vm.expectPartialRevert(IndexVault.SlippageExceeded.selector);
        vault.redeemForUSDG(shares, expected, bob);
    }

    function test_redeemForUSDGRevertsOnStaleLeg() public {
        vm.prank(bob);
        uint256 shares = vault.mintWithUSDG(10_000e6, 0, bob);
        vm.prank(owner);
        oracle.markStale(address(tsm), STALENESS + 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(tsm)));
        vault.redeemForUSDG(shares, 0, bob);
    }

    // ───────────── weight solver ─────────────

    /// Push NVDA up so the basket drifts outside the band.
    function _driftNvdaUp() internal {
        vm.prank(owner);
        oracle.setPrice(address(nvda), 260e18); // +44%
        refreshAll();
    }

    function test_previewRebalanceEmptyWhenInsideBand() public view {
        (address[] memory sell,,,) = vault.previewRebalance(SLIP);
        assertEq(sell.length, 0, "no trades while every leg is on target");
    }

    function test_previewRebalanceSellsTheOverweightLeg() public {
        _driftNvdaUp();
        (address[] memory sell, uint256[] memory sellAmts, address[] memory buy, uint256[] memory buyAmts) =
            vault.previewRebalance(SLIP);

        assertGt(sell.length, 0, "solver found nothing to do");
        for (uint256 i; i < sell.length; ++i) {
            assertEq(sell[i], address(nvda), "only NVDA is overweight");
            assertTrue(buy[i] != address(nvda), "cannot buy what we are selling");
            assertGt(sellAmts[i], 0);
            assertGt(buyAmts[i], 0);
        }
    }

    function test_rebalanceToTargetRestoresWeights() public {
        _driftNvdaUp();
        assertTrue(vault.rebalanceNeeded());
        uint256 navBefore = vault.nav();

        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(keeper);
        uint256 swaps = vault.rebalanceToTarget(SLIP);

        assertGt(swaps, 0);
        assertFalse(vault.rebalanceNeeded(), "still out of band after solving");
        uint256[] memory w = vault.currentWeightsBps();
        for (uint256 i; i < w.length; ++i) {
            assertApproxEqAbs(w[i], vault.component(i).targetWeightBps, BAND, "leg not back near target");
        }
        assertApproxEqRel(vault.nav(), navBefore, 0.001e18, "rebalance should be NAV-neutral");
    }

    function test_rebalanceToTargetRevertsWhenNothingToDo() public {
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(keeper);
        vm.expectRevert(IndexVault.NothingToRebalance.selector);
        vault.rebalanceToTarget(SLIP);
    }

    function test_rebalanceToTargetOnlyKeeper() public {
        _driftNvdaUp();
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(alice);
        vm.expectRevert(IndexVault.NotKeeper.selector);
        vault.rebalanceToTarget(SLIP);
    }

    function test_rebalanceToTargetRespectsCooldown() public {
        _driftNvdaUp();
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(keeper);
        vault.rebalanceToTarget(SLIP);

        vm.prank(owner);
        oracle.setPrice(address(nvda), 400e18);
        refreshAll();
        vm.prank(keeper);
        vm.expectPartialRevert(IndexVault.CooldownActive.selector);
        vault.rebalanceToTarget(SLIP);
    }

    /// A venue worse than the solver's own tolerance is rejected by the per-trade minOut floor,
    /// before the NAV guard ever sees it.
    function test_rebalanceToTargetMinOutFloorStopsBadVenue() public {
        _driftNvdaUp();
        vm.prank(owner);
        executor.setSlippageBps(400); // 4% burned per swap, far past the 0.5% floor
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(keeper);
        vm.expectPartialRevert(MockSwapExecutor.InsufficientOutput.selector);
        vault.rebalanceToTarget(SLIP);
    }

    /// Loosen the per-trade floor past the NAV-loss ceiling and the NAV guard catches it instead.
    function test_rebalanceToTargetNavLossGuard() public {
        _driftNvdaUp();
        vm.prank(owner);
        executor.setSlippageBps(1500); // 15% burned on the traded slice, enough to move NAV past 1%
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(keeper);
        vm.expectPartialRevert(IndexVault.RebalanceLossTooHigh.selector);
        vault.rebalanceToTarget(2000); // tolerance wide enough for the fill to go through
    }

    function test_rebalanceToTargetRevertsOnStale() public {
        _driftNvdaUp();
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();
        vm.prank(owner);
        oracle.markStale(address(amd), STALENESS + 1);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(amd)));
        vault.rebalanceToTarget(SLIP);
    }

    // ───────────── fuzz ─────────────

    function testFuzz_mintWithUSDGNeverDilutesHolders(uint96 usdgIn) public {
        usdgIn = uint96(bound(usdgIn, 100e6, 500_000e6));
        uint256 navBefore = vault.nav();
        uint256 aliceValueBefore = token.balanceOf(alice) * navBefore / 1e18;

        vm.prank(bob);
        vault.mintWithUSDG(usdgIn, 0, bob);

        uint256 aliceValueAfter = token.balanceOf(alice) * vault.nav() / 1e18;
        assertGe(aliceValueAfter * 10_001 / 10_000, aliceValueBefore, "existing holder lost value");
    }

    function testFuzz_solverNeverBreachesCaps(uint256 priceMul) public {
        priceMul = bound(priceMul, 1.05e18, 1.6e18);
        vm.prank(owner);
        oracle.setPrice(address(nvda), 180e18 * priceMul / 1e18);
        refreshAll();
        vm.warp(block.timestamp + COOLDOWN + 1);
        refreshAll();

        (address[] memory sell,,,) = vault.previewRebalance(SLIP);
        if (sell.length == 0) return;
        vm.prank(keeper);
        vault.rebalanceToTarget(SLIP);

        uint256[] memory w = vault.currentWeightsBps();
        for (uint256 i; i < w.length; ++i) {
            assertLe(w[i], vault.component(i).maxWeightBps, "cap breached after solve");
        }
    }
}

/// EIP-170 is a deployment-time cliff, not a compile warning: the factory once carried the vault's
/// creation code and silently became undeployable. Keep both sides measured.
contract BytecodeSizeTest is BaseTest {
    uint256 constant EIP170_LIMIT = 24_576;

    function test_everyDeployedContractFitsUnderEip170() public view {
        _assertFits("IndexVault", address(vault));
        _assertFits("IndexToken", address(token));
        _assertFits("IndexFactory", address(factory));
        _assertFits("VaultDeployer", address(factory.deployer()));
    }

    function _assertFits(string memory name, address a) internal view {
        uint256 size = a.code.length;
        assertGt(size, 0, string.concat(name, " has no code"));
        assertLt(size, EIP170_LIMIT, string.concat(name, " exceeds the EIP-170 runtime limit"));
    }
}

/// Config-level guards. A vault is immutable once deployed, so a bad basket definition has to be
/// rejected at construction — there is no fixing it afterwards.
contract ConfigGuardTest is BaseTest {
    /// USDG doubles as the settlement asset for mintWithUSDG. If it were also a leg, the USDG the
    /// minter delivers would be counted as basket value and mint shares out of thin air.
    function test_constructorRejectsUsdgAsComponent() public {
        IndexVault.ComponentInput[] memory comps = new IndexVault.ComponentInput[](2);
        comps[0] = IndexVault.ComponentInput(address(nvda), 5000, 6000);
        comps[1] = IndexVault.ComponentInput(address(usdg), 5000, 6000);

        IndexVault.Config memory cfg = IndexVault.Config({
            name: "Bad Index",
            symbol: "pBAD",
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

        vm.expectRevert(IndexVault.UsdgCannotBeComponent.selector);
        new IndexVault(owner, cfg);
    }
}
