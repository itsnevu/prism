// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {IndexVault} from "../src/IndexVault.sol";
import {IndexToken} from "../src/IndexToken.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract IndexVaultTest is BaseTest {
    // ───────────── construction / factory ─────────────

    function test_factoryTracksVaults() public view {
        address[] memory all = factory.allIndexes();
        assertEq(all.length, 1);
        assertEq(all[0], address(vault));
        assertTrue(factory.isIndex(address(vault)));
        assertEq(factory.vaultBySymbol("pTEST"), address(vault));
    }

    function test_constructorRejectsBadWeights() public {
        IndexVault.ComponentInput[] memory comps = new IndexVault.ComponentInput[](2);
        comps[0] = IndexVault.ComponentInput(address(nvda), 6000, 7000);
        comps[1] = IndexVault.ComponentInput(address(amd), 3000, 5000);
        IndexVault.Config memory cfg = _cfg(comps);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.WeightsMustSumTo10000.selector, 9000));
        new IndexVault(owner, cfg);

        comps[0] = IndexVault.ComponentInput(address(nvda), 7000, 6000);
        comps[1] = IndexVault.ComponentInput(address(amd), 3000, 5000);
        cfg = _cfg(comps);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.WeightAboveCap.selector, address(nvda), 7000, 6000));
        new IndexVault(owner, cfg);
    }

    function test_indexTokenOnlyVaultMints() public {
        vm.expectRevert(IndexToken.OnlyVault.selector);
        token.mint(alice, 1e18);
        vm.expectRevert(IndexToken.OnlyVault.selector);
        token.burn(alice, 1e18);
        assertEq(token.vault(), address(vault));
        assertEq(token.decimals(), 18);
    }

    // ───────────── NAV ─────────────

    function test_navBootstrapEqualsInitialNav() public view {
        assertEq(vault.nav(), INITIAL_NAV);
        assertEq(vault.totalValue(), 0);
    }

    function test_bootstrapMintPullsTargetWeightedBasket() public {
        uint256 amt = 10e18; // 10 index tokens worth 100 USDG each = 1000 USDG
        (, uint256[] memory need) = vault.previewMint(amt);
        // NVDA 40% of 1000 = 400 / 180
        assertEq(need[0], _ceil(400e18 * 1e18, 180e18));
        // TSM 20% = 200 / 200 = 1 TSM = 1e6 (6 decimals)
        assertEq(need[3], 1e6);

        uint256[] memory before = balances(alice);
        uint256 got = mintAs(alice, amt);
        uint256[] memory after_ = balances(alice);
        for (uint256 i; i < assets.length; ++i) {
            assertEq(before[i] - after_[i], need[i], "pulled exact");
            assertEq(MockERC20(assets[i]).balanceOf(address(vault)), need[i]);
        }
        assertEq(got, amt - amt * 10 / 10_000);
        assertEq(token.balanceOf(feeRecipient), amt * 10 / 10_000);
        assertEq(token.totalSupply(), amt);
    }

    function test_navMathAfterMint() public {
        mintAs(alice, 10e18);
        // total value should be ~1000 USDG (ceil rounding adds dust)
        uint256 tv = vault.totalValue();
        assertApproxEqRel(tv, 1000e18, 1e12);
        assertApproxEqRel(vault.nav(), INITIAL_NAV, 1e12);

        // price move: NVDA doubles -> NAV up by 40%
        vm.prank(owner);
        oracle.setPrice(address(nvda), 360e18);
        assertApproxEqRel(vault.nav(), 140e18, 1e12);
    }

    function test_navRevertsStalePrice() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        oracle.markStale(address(amd), STALENESS + 1);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(amd)));
        vault.nav();
        assertEq(vault.staleAsset(), address(amd));
        assertFalse(vault.mintRedeemOpen());
    }

    function test_navFreshExactlyAtStalenessBoundary() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        oracle.markStale(address(amd), STALENESS); // exactly maxStaleness => still fresh
        vault.nav();
        assertEq(vault.staleAsset(), address(0));
    }

    // ───────────── mint / redeem ─────────────

    function test_secondMintIsProRataOfHoldings() public {
        mintAs(alice, 10e18);
        // skew holdings: donate extra NVDA so pro-rata != target weights
        nvda.mint(address(vault), 5e18);
        uint256 supply = token.totalSupply();
        (, uint256[] memory need) = vault.previewMint(5e18);
        for (uint256 i; i < assets.length; ++i) {
            uint256 bal = MockERC20(assets[i]).balanceOf(address(vault));
            assertEq(need[i], _ceil(bal * 5e18, supply));
        }
        uint256[] memory before = balances(bob);
        mintAs(bob, 5e18);
        uint256[] memory after_ = balances(bob);
        for (uint256 i; i < assets.length; ++i) assertEq(before[i] - after_[i], need[i]);
    }

    function test_redeemReturnsProRataBasket() public {
        mintAs(alice, 10e18);
        uint256 aliceIdx = token.balanceOf(alice);
        (, uint256[] memory expected) = vault.previewRedeem(aliceIdx);
        uint256[] memory before = balances(alice);
        vm.prank(alice);
        uint256[] memory out = vault.redeem(aliceIdx, alice);
        uint256[] memory after_ = balances(alice);
        for (uint256 i; i < assets.length; ++i) {
            assertEq(out[i], expected[i]);
            assertEq(after_[i] - before[i], expected[i]);
        }
        assertEq(token.balanceOf(alice), 0);
        // fee recipient has mint fee + redeem fee
        assertEq(token.balanceOf(feeRecipient), 10e18 * 10 / 10_000 + aliceIdx * 10 / 10_000);
    }

    function test_roundTripLossBoundedByFees() public {
        uint256[] memory start = balances(alice);
        mintAs(alice, 10e18);
        uint256 idx = token.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(idx, alice);
        uint256[] memory end_ = balances(alice);
        // two fees of 10bps each => keep >= (1-0.001)^2 of each leg (allow 1 wei rounding)
        for (uint256 i; i < assets.length; ++i) {
            uint256 lost = start[i] - end_[i];
            (, uint256[] memory need) = _bootstrapNeed(10e18);
            uint256 maxLoss = need[i] * 20 / 10_000 + 2;
            assertLe(lost, maxLoss, "loss > fees");
        }
    }

    function test_mintRevertsOnStaleLeg() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        oracle.markStale(address(tsm), STALENESS + 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(tsm)));
        vault.mint(1e18, bob);
    }

    function test_redeemRevertsOnStaleLeg() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        oracle.markStale(address(nvda), STALENESS + 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(nvda)));
        vault.redeem(1e18, alice);
    }

    function test_staleThenRefreshReopens() public {
        mintAs(alice, 10e18);
        vm.startPrank(owner);
        oracle.markStale(address(nvda), STALENESS + 1);
        assertFalse(vault.mintRedeemOpen());
        oracle.refresh(address(nvda));
        vm.stopPrank();
        assertTrue(vault.mintRedeemOpen());
        mintAs(bob, 1e18);
    }

    function test_ownerPauseBlocksMintRedeem() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());
        assertFalse(vault.mintRedeemOpen());
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.mint(1e18, bob);
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.redeem(1e18, alice);
        vm.prank(owner);
        vault.unpause();
        mintAs(bob, 1e18);
    }

    function test_pauseOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.pause();
    }

    function test_mintZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(IndexVault.ZeroAmount.selector);
        vault.mint(0, alice);
    }

    function test_mintWithoutApprovalReverts() public {
        address carol = makeAddr("carol");
        vm.prank(carol);
        vm.expectRevert();
        vault.mint(1e18, carol);
    }

    // ───────────── fees ─────────────

    function test_managementFeeAccruesOverTime() public {
        mintAs(alice, 100e18);
        uint256 supply = token.totalSupply();
        uint256 feeBefore = token.balanceOf(feeRecipient);
        vm.warp(block.timestamp + 365 days);
        refreshAll();
        uint256 pending = vault.pendingManagementFee();
        assertEq(pending, supply * 50 / 10_000);
        vault.accrueFee();
        assertEq(token.balanceOf(feeRecipient) - feeBefore, pending);
        assertEq(vault.pendingManagementFee(), 0);
        // NAV diluted by ~0.5%
        assertApproxEqRel(vault.nav(), INITIAL_NAV * 10_000 / 10_050, 1e12);
    }

    function test_mintAccruesFeeFirst() public {
        mintAs(alice, 100e18);
        vm.warp(block.timestamp + 180 days);
        refreshAll();
        uint256 pending = vault.pendingManagementFee();
        uint256 feeBefore = token.balanceOf(feeRecipient);
        mintAs(bob, 1e18);
        // fee recipient got pending mgmt + mint fee
        assertEq(token.balanceOf(feeRecipient) - feeBefore, pending + 1e18 * 10 / 10_000);
    }

    function test_setFeeParamsBounds() public {
        vm.startPrank(owner);
        vm.expectRevert(IndexVault.FeeTooHigh.selector);
        vault.setFeeParams(501, 10, feeRecipient);
        vm.expectRevert(IndexVault.FeeTooHigh.selector);
        vault.setFeeParams(50, 201, feeRecipient);
        vault.setFeeParams(100, 20, bob);
        assertEq(vault.mgmtFeeBps(), 100);
        assertEq(vault.feeRecipient(), bob);
        vm.stopPrank();
    }

    // ───────────── weights / caps / rebalance ─────────────

    function test_setTargetWeightsEnforcesSumAndCaps() public {
        uint16[] memory w = new uint16[](4);
        w[0] = 5000; w[1] = 2000; w[2] = 2000; w[3] = 500;
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.WeightsMustSumTo10000.selector, 9500));
        vault.setTargetWeights(w);
        w[0] = 5500; w[3] = 500;
        vm.expectRevert(abi.encodeWithSelector(IndexVault.WeightAboveCap.selector, address(nvda), 5500, 5000));
        vault.setTargetWeights(w);
        w[0] = 4500; w[3] = 1500;
        vault.setTargetWeights(w);
        assertEq(vault.component(0).targetWeightBps, 4500);
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert();
        vault.setTargetWeights(w);
    }

    function test_rebalanceNeededBandLogic() public {
        mintAs(alice, 10e18);
        assertFalse(vault.rebalanceNeeded());
        // NVDA +5% -> weight 40% -> ~41.4%: drift 1.4% < 3% band
        vm.prank(owner);
        oracle.setPrice(address(nvda), 189e18);
        assertFalse(vault.rebalanceNeeded());
        // NVDA +30% -> weight = 52/112 = 46.4%: drift 6.4% > band
        vm.prank(owner);
        oracle.setPrice(address(nvda), 234e18);
        assertTrue(vault.rebalanceNeeded());
    }

    function test_rebalanceViaExecutorRestoresWeights() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        oracle.setPrice(address(nvda), 234e18);
        assertTrue(vault.rebalanceNeeded());
        // sell NVDA worth ~$72 spread into AMD/AVGO/TSM. Total value = 520+200+200+200 = 1120.
        // target NVDA 448 -> sell 72/234 NVDA. Buy 24 each of the others.
        uint256 sellEach = uint256(24e18) * 1e18 / uint256(234e18);
        address[] memory sells = new address[](3);
        uint256[] memory sAmts = new uint256[](3);
        address[] memory buys = new address[](3);
        uint256[] memory bAmts = new uint256[](3);
        for (uint256 i; i < 3; ++i) { sells[i] = address(nvda); sAmts[i] = sellEach; }
        buys[0] = address(amd); buys[1] = address(avgo); buys[2] = address(tsm);
        bAmts[0] = 0; bAmts[1] = 0; bAmts[2] = 0;

        uint256 navBefore = vault.nav();
        vm.prank(keeper);
        vault.rebalance(sells, sAmts, buys, bAmts);
        assertApproxEqRel(vault.nav(), navBefore, 1e12);
        assertFalse(vault.rebalanceNeeded());
        assertEq(vault.lastRebalance(), block.timestamp);
    }

    function test_rebalanceOnlyKeeper() public {
        mintAs(alice, 10e18);
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(1e18);
        vm.prank(alice);
        vm.expectRevert(IndexVault.NotKeeper.selector);
        vault.rebalance(s, sa, b, ba);
    }

    function test_rebalanceCooldown() public {
        mintAs(alice, 10e18);
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(1e17);
        vm.startPrank(keeper);
        vault.rebalance(s, sa, b, ba);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.CooldownActive.selector, block.timestamp + COOLDOWN));
        vault.rebalance(s, sa, b, ba);
        vm.warp(block.timestamp + COOLDOWN);
        vault.rebalance(s, sa, b, ba);
        vm.stopPrank();
    }

    function test_rebalanceNavLossGuard() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        executor.setSlippageBps(2500); // 25% haircut on a $90 swap of a $1000 basket => 2.25% NAV loss > 1%
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(5e17);
        vm.prank(keeper);
        vm.expectPartialRevert(IndexVault.RebalanceLossTooHigh.selector);
        vault.rebalance(s, sa, b, ba);
        // small slippage passes
        vm.prank(owner);
        executor.setSlippageBps(10);
        vm.prank(keeper);
        vault.rebalance(s, sa, b, ba);
    }

    function test_rebalanceMinOutEnforcedByExecutor() public {
        mintAs(alice, 10e18);
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(1e17);
        ba[0] = type(uint128).max;
        vm.prank(keeper);
        vm.expectRevert();
        vault.rebalance(s, sa, b, ba);
    }

    function test_rebalanceWeightCapGuard() public {
        mintAs(alice, 10e18);
        // Push NVDA (cap 50%) from 40% to >50% by selling AMD/AVGO/TSM into NVDA.
        address[] memory sells = new address[](3);
        uint256[] memory sAmts = new uint256[](3);
        address[] memory buys = new address[](3);
        uint256[] memory bAmts = new uint256[](3);
        sells[0] = address(amd); sAmts[0] = amd.balanceOf(address(vault)) / 2;
        sells[1] = address(avgo); sAmts[1] = avgo.balanceOf(address(vault)) / 2;
        sells[2] = address(tsm); sAmts[2] = tsm.balanceOf(address(vault)) / 2;
        for (uint256 i; i < 3; ++i) buys[i] = address(nvda);
        vm.prank(keeper);
        vm.expectPartialRevert(IndexVault.WeightAboveCap.selector); // ~70% > 50% cap
        vault.rebalance(sells, sAmts, buys, bAmts);
    }

    function test_rebalanceRejectsUnknownAssetAndBadLengths() public {
        mintAs(alice, 10e18);
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(1e17);
        b[0] = address(usdg);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.UnknownAsset.selector, address(usdg)));
        vault.rebalance(s, sa, b, ba);
        uint256[] memory bad = new uint256[](2);
        vm.prank(keeper);
        vm.expectRevert(IndexVault.LengthMismatch.selector);
        vault.rebalance(s, bad, b, ba);
    }

    function test_rebalanceRevertsOnStale() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        oracle.markStale(address(avgo), STALENESS + 1);
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(1e17);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(IndexVault.StalePrice.selector, address(avgo)));
        vault.rebalance(s, sa, b, ba);
    }

    function test_rebalanceRequiresExecutor() public {
        mintAs(alice, 10e18);
        vm.prank(owner);
        vault.setSwapExecutor(address(0));
        (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba) = _simpleSwap(1e17);
        vm.prank(keeper);
        vm.expectRevert(IndexVault.NoSwapExecutor.selector);
        vault.rebalance(s, sa, b, ba);
    }

    // ───────────── fuzz ─────────────

    function testFuzz_mintRedeemRoundTrip(uint96 rawAmt, uint32 dt) public {
        uint256 amt = bound(uint256(rawAmt), 1e15, 1_000_000e18);
        dt = uint32(bound(dt, 0, 30 days));
        // seed so the fuzzer isn't always the bootstrapper
        mintAs(bob, 7e18);

        uint256[] memory start = balances(alice);
        (, uint256[] memory need) = vault.previewMint(amt);
        mintAs(alice, amt);
        uint256 idx = token.balanceOf(alice);
        vm.warp(block.timestamp + dt);
        refreshAll();
        vm.prank(alice);
        vault.redeem(idx, alice);
        uint256[] memory end_ = balances(alice);
        for (uint256 i; i < assets.length; ++i) {
            assertLe(end_[i], start[i], "cannot profit from round trip");
            uint256 lost = start[i] - end_[i];
            // fees: 10bps mint + 10bps redeem + mgmt dilution over dt (50bps/yr) + rounding
            uint256 mgmt = need[i] * 50 * dt / (10_000 * 365 days);
            uint256 maxLoss = need[i] * 20 / 10_000 + mgmt + need[i] / 1e6 + 4;
            assertLe(lost, maxLoss, "loss exceeds fees");
        }
        // vault never insolvent: value >= 0 and NAV stays close to bootstrap (only fee dilution)
        assertGe(vault.nav(), INITIAL_NAV * 995 / 1000);
    }

    function testFuzz_navInvariantUnderMints(uint96 a, uint96 b) public {
        // floor at 1 index token: below that, ceil rounding on the 6-decimal TSM leg dominates
        uint256 amtA = bound(uint256(a), 1e18, 1_000_000e18);
        uint256 amtB = bound(uint256(b), 1e18, 1_000_000e18);
        mintAs(alice, amtA);
        uint256 navBefore = vault.nav();
        mintAs(bob, amtB);
        // minting pro-rata cannot decrease NAV for existing holders (ceil rounding only helps)
        assertGe(vault.nav() + 1, navBefore);
        assertApproxEqRel(vault.nav(), navBefore, 1e14); // ceil rounding dust
    }

    // ───────────── helpers ─────────────

    function _cfg(IndexVault.ComponentInput[] memory comps) internal view returns (IndexVault.Config memory) {
        return IndexVault.Config({
            name: "x",
            symbol: "x",
            usdg: address(usdg),
            oracle: address(oracle),
            components: comps,
            maxStaleness: uint32(STALENESS),
            bandBps: uint16(BAND),
            initialNav1e18: INITIAL_NAV,
            fees: IndexVault.FeeParams(50, 10, feeRecipient),
            rebalance: IndexVault.RebalanceParams(uint16(MAX_LOSS), uint32(COOLDOWN), address(executor))
        });
    }

    function _bootstrapNeed(uint256 amt) internal view returns (address[] memory, uint256[] memory) {
        uint256[] memory need = new uint256[](4);
        uint16[4] memory w = [4000, 2000, 2000, 2000];
        uint256[4] memory p = [uint256(180e18), 160e18, 300e18, 200e18];
        for (uint256 i; i < 4; ++i) {
            uint256 v = amt * INITIAL_NAV / 1e18 * w[i] / 10_000;
            need[i] = _ceil(v * 10 ** MockERC20(assets[i]).decimals(), p[i]);
        }
        return (assets, need);
    }

    function _simpleSwap(uint256 nvdaAmt)
        internal
        view
        returns (address[] memory s, uint256[] memory sa, address[] memory b, uint256[] memory ba)
    {
        s = new address[](1); sa = new uint256[](1); b = new address[](1); ba = new uint256[](1);
        s[0] = address(nvda); sa[0] = nvdaAmt; b[0] = address(amd); ba[0] = 0;
    }

    function _ceil(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }
}
