// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockSwapExecutor} from "../src/mocks/MockSwapExecutor.sol";
import {IndexVault} from "../src/IndexVault.sol";
import {IndexToken} from "../src/IndexToken.sol";

/// Drives the vault through random user activity. Prices are held constant and the management fee
/// is off, which isolates the property under test: whether *entering and leaving* can move NAV.
contract Handler is Test {
    IndexVault public vault;
    IndexToken public token;
    MockOracle public oracle;
    MockERC20 public usdg;
    address[] public assets;
    address[] public actors;

    uint256 public mints;
    uint256 public redeems;
    uint256 public buys;
    uint256 public sells;

    constructor(IndexVault vault_, MockOracle oracle_, MockERC20 usdg_, address[] memory assets_, address[] memory actors_) {
        vault = vault_;
        token = vault_.token();
        oracle = oracle_;
        usdg = usdg_;
        assets = assets_;
        actors = actors_;
    }

    modifier fresh() {
        address owner = vault.owner();
        vm.startPrank(owner);
        for (uint256 i; i < assets.length; ++i) oracle.refresh(assets[i]);
        oracle.refresh(address(usdg));
        vm.stopPrank();
        _;
    }

    function actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function mintBasket(uint256 seed, uint256 amount) external fresh {
        amount = bound(amount, 1e15, 5_000e18);
        address who = actor(seed);
        vm.prank(who);
        try vault.mint(amount, who) {
            mints++;
        } catch {}
    }

    function redeemBasket(uint256 seed, uint256 amount) external fresh {
        address who = actor(seed);
        uint256 bal = token.balanceOf(who);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(who);
        try vault.redeem(amount, who) {
            redeems++;
        } catch {}
    }

    function buyWithUsdg(uint256 seed, uint256 amount) external fresh {
        amount = bound(amount, 1e6, 500_000e6);
        address who = actor(seed);
        vm.prank(who);
        try vault.mintWithUSDG(amount, 0, who) {
            buys++;
        } catch {}
    }

    function sellForUsdg(uint256 seed, uint256 amount) external fresh {
        address who = actor(seed);
        uint256 bal = token.balanceOf(who);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(who);
        try vault.redeemForUSDG(amount, 0, who) {
            sells++;
        } catch {}
    }

    function accrue() external fresh {
        vault.accrueFee();
    }
}

/// @notice With prices flat and no management fee, NAV per index token is a *conservation law*:
///         minting hands over exactly the value it receives, redeeming takes exactly its share, and
///         the USDG routes only add a swap in between. Anything that moves NAV here is a leak —
///         either users are minting free value or holders are being drained.
contract InvariantTest is Test {
    uint256 constant INITIAL_NAV = 100e18;
    /// Slack for integer-division dust, ~1e-8 of NAV.
    uint256 constant TOLERANCE = 1e12;

    /// Highest NAV seen so far in this run. NAV is allowed to ratchet *up* — previewMint rounds the
    /// basket the minter owes upward, so every mint leaves a sliver of dust behind for the existing
    /// holders — but it must never fall, which is what a value leak would look like.
    uint256 private _navHighWater = INITIAL_NAV;

    MockERC20 usdg;
    MockOracle oracle;
    MockSwapExecutor executor;
    IndexVault vault;
    IndexToken token;
    Handler handler;

    address owner = makeAddr("owner");
    address feeRecipient = makeAddr("fees");
    address[] assets;

    function setUp() public {
        vm.warp(1_800_000_000);
        usdg = new MockERC20("USDG", "USDG", 6);
        MockERC20 a = new MockERC20("Alpha", "ALPHA", 18);
        MockERC20 b = new MockERC20("Beta", "BETA", 6); // deliberately odd decimals
        MockERC20 c = new MockERC20("Gamma", "GAMMA", 8);

        oracle = new MockOracle(owner);
        executor = new MockSwapExecutor(owner, oracle, 5); // 5 bps, a realistic venue
        vm.startPrank(owner);
        oracle.setPrice(address(a), 180e18);
        oracle.setPrice(address(b), 42e18);
        oracle.setPrice(address(c), 7e18);
        oracle.setPrice(address(usdg), 1e18);
        vm.stopPrank();

        IndexVault.ComponentInput[] memory comps = new IndexVault.ComponentInput[](3);
        comps[0] = IndexVault.ComponentInput(address(a), 5000, 7000);
        comps[1] = IndexVault.ComponentInput(address(b), 3000, 5000);
        comps[2] = IndexVault.ComponentInput(address(c), 2000, 5000);

        vault = new IndexVault(
            owner,
            IndexVault.Config({
                name: "Invariant Index",
                symbol: "pINV",
                usdg: address(usdg),
                oracle: address(oracle),
                components: comps,
                maxStaleness: 1 hours,
                bandBps: 300,
                initialNav1e18: INITIAL_NAV,
                // management fee off: it deliberately dilutes, which would mask a real leak
                fees: IndexVault.FeeParams({mgmtFeeBps: 0, mintFeeBps: 10, feeRecipient: feeRecipient}),
                rebalance: IndexVault.RebalanceParams({
                    maxRebalanceLossBps: 100,
                    cooldown: 1 hours,
                    swapExecutor: address(executor)
                })
            })
        );
        token = vault.token();

        assets = [address(a), address(b), address(c)];
        address[] memory actors = new address[](3);
        actors[0] = makeAddr("alice");
        actors[1] = makeAddr("bob");
        actors[2] = makeAddr("carol");

        for (uint256 i; i < actors.length; ++i) {
            usdg.mint(actors[i], 10_000_000e6);
            vm.prank(actors[i]);
            usdg.approve(address(vault), type(uint256).max);
            for (uint256 j; j < assets.length; ++j) {
                MockERC20(assets[j]).mint(actors[i], 100_000_000 * 10 ** MockERC20(assets[j]).decimals());
                vm.prank(actors[i]);
                MockERC20(assets[j]).approve(address(vault), type(uint256).max);
            }
        }

        handler = new Handler(vault, oracle, usdg, assets, actors);
        targetContract(address(handler));
    }

    /// NAV per token must never fall. With prices flat and the management fee off, the only way it
    /// can drop is if someone extracted more value than they were entitled to.
    function invariant_navNeverFalls() public {
        if (token.totalSupply() == 0) return;
        uint256 nav = vault.nav();
        assertGe(nav + TOLERANCE, _navHighWater, "NAV fell: value leaked out of the basket");
        if (nav > _navHighWater) _navHighWater = nav;
    }

    /// And it must not run away upward either — free shares would show up here as NAV climbing far
    /// past the bootstrap price on nothing but user activity.
    function invariant_navDoesNotInflate() public view {
        if (token.totalSupply() == 0) return;
        assertLe(vault.nav(), INITIAL_NAV + INITIAL_NAV / 200, "NAV inflated: value is being created");
    }

    /// Supply priced at NAV must equal the basket it is a claim on.
    function invariant_supplyMatchesBasket() public view {
        uint256 supply = token.totalSupply();
        if (supply == 0) return;
        assertApproxEqRel(supply * vault.nav() / 1e18, vault.totalValue(), 0.0001e18, "supply and basket disagree");
    }

    /// The vault settles USDG straight through; it must never sit on a balance between calls.
    function invariant_noUsdgStranded() public view {
        assertEq(usdg.balanceOf(address(vault)), 0, "USDG left in the vault");
    }

    /// A leg may drift, but never past the cap the basket was configured with.
    function invariant_capsHold() public view {
        if (vault.totalValue() == 0) return;
        uint256[] memory w = vault.currentWeightsBps();
        for (uint256 i; i < w.length; ++i) {
            assertLe(w[i], vault.component(i).maxWeightBps, "weight cap breached");
        }
    }

    /// Guards the guards: if every handler call were reverting, the invariants above would pass
    /// vacuously. `afterInvariant` runs once the sequence is done, when the counters mean something.
    function afterInvariant() public view {
        assertGt(handler.mints() + handler.buys(), 0, "no successful entries: invariants are vacuous");
    }
}
