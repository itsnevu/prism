// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {ISwapExecutor} from "./interfaces/ISwapExecutor.sol";
import {IndexToken} from "./IndexToken.sol";

/// @title IndexVault
/// @notice Holds a basket of tokenized assets and issues an IndexToken that is a pro-rata claim on it.
///
///  - mint():   deliver the basket, receive index tokens (minus mint fee).
///  - redeem(): burn index tokens, receive the basket (minus redeem fee).
///  - nav():    oracle-priced value per index token. Reverts StalePrice if ANY leg is stale —
///              the vault pauses rather than guessing (stock legs close, memecoins never sleep).
///  - rebalance(): keeper-driven, routed through an owner-approved ISwapExecutor, guarded by
///              NAV-loss ceiling, per-asset caps and a cooldown.
///
///  - mintWithUSDG()/redeemForUSDG(): single-asset entry and exit. USDG is split across the basket
///              (or the basket is sold back to USDG) through the same owner-approved ISwapExecutor
///              used by rebalance. Shares are issued at NAV from the measured value delta, so a bad
///              fill costs the minter, never the existing holders; `minOut` bounds the damage.
///  - previewRebalance()/rebalanceToTarget(): on-chain weight solver. Ranks every leg by its
///              distance from target, greedily pairs the biggest surplus against the biggest
///              deficit, and executes the resulting plan under the same NAV/cap/cooldown guards.
contract IndexVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────── types ───────────────────────────────

    struct ComponentInput {
        address asset;
        uint16 targetWeightBps;
        uint16 maxWeightBps;
    }

    struct Component {
        address asset;
        uint16 targetWeightBps;
        uint16 maxWeightBps;
        uint8 decimals;
    }

    struct FeeParams {
        uint16 mgmtFeeBps; // per year, streamed as index tokens to feeRecipient
        uint16 mintFeeBps; // on mint AND redeem, paid in index tokens
        address feeRecipient;
    }

    struct RebalanceParams {
        uint16 maxRebalanceLossBps; // max NAV drop tolerated across one rebalance
        uint32 cooldown; // seconds between rebalances
        address swapExecutor; // owner-approved venue
    }

    /// Priced snapshot the greedy weight solver works from.
    struct Solve {
        uint256[] prices;
        uint256[] surplus; // value above target, 1e18 USDG
        uint256[] deficit; // value below target, 1e18 USDG
        uint256 minTrade; // dust floor
        bool outOfBand;
    }

    /// Working buffer for the greedy weight solver.
    struct Plan {
        address[] sellAssets;
        uint256[] sellAmts;
        address[] buyAssets;
        uint256[] buyAmts;
        uint256 k;
    }

    struct Config {
        string name;
        string symbol;
        address usdg;
        address oracle;
        ComponentInput[] components;
        uint32 maxStaleness;
        uint16 bandBps;
        uint256 initialNav1e18; // bootstrap NAV per index token when supply == 0
        FeeParams fees;
        RebalanceParams rebalance;
    }

    // ─────────────────────────────── constants ───────────────────────────

    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_MGMT_FEE_BPS = 500; // 5%/yr
    uint256 public constant MAX_MINT_FEE_BPS = 200; // 2%
    uint256 public constant MIN_TRADE_BPS = 10; // solver ignores imbalances under 0.1% of the basket

    // ─────────────────────────────── storage ─────────────────────────────

    IndexToken public immutable token;
    IERC20 public immutable usdg;
    IPriceOracle public oracle;

    Component[] private _components;
    mapping(address => uint256) private _componentIndexPlusOne;

    uint32 public maxStaleness;
    uint16 public bandBps;
    uint256 public immutable initialNav1e18;

    uint16 public mgmtFeeBps;
    uint16 public mintFeeBps;
    address public feeRecipient;
    uint64 public lastAccrual;

    uint16 public maxRebalanceLossBps;
    uint32 public rebalanceCooldown;
    uint64 public lastRebalance;
    ISwapExecutor public swapExecutor;

    mapping(address => bool) public isKeeper;

    // ─────────────────────────────── events ──────────────────────────────

    event Minted(address indexed sender, address indexed to, uint256 indexAmount, uint256 fee, uint256[] amountsIn);
    event Redeemed(address indexed sender, address indexed to, uint256 indexAmount, uint256 fee, uint256[] amountsOut);
    event ManagementFeeAccrued(address indexed recipient, uint256 shares, uint256 elapsed);
    event Rebalanced(address indexed keeper, uint256 navBefore, uint256 navAfter, uint256 swaps);
    event MintedWithUSDG(address indexed sender, address indexed to, uint256 usdgIn, uint256 indexAmount, uint256 fee);
    event RedeemedForUSDG(address indexed sender, address indexed to, uint256 indexAmount, uint256 fee, uint256 usdgOut);
    event RebalanceSwap(address indexed sold, uint256 soldAmt, address indexed bought, uint256 boughtAmt);
    event TargetWeightsSet(uint16[] targetWeightBps);
    event KeeperSet(address indexed keeper, bool enabled);
    event SwapExecutorSet(address indexed executor);
    event OracleSet(address indexed oracle);
    event FeeParamsSet(uint16 mgmtFeeBps, uint16 mintFeeBps, address feeRecipient);
    event RiskParamsSet(uint32 maxStaleness, uint16 bandBps, uint16 maxRebalanceLossBps, uint32 cooldown);

    // ─────────────────────────────── errors ──────────────────────────────

    error StalePrice(address asset);
    error ZeroAmount();
    error ZeroAddress();
    error NotKeeper();
    error LengthMismatch();
    error WeightsMustSumTo10000(uint256 sum);
    error WeightAboveCap(address asset, uint256 weightBps, uint256 capBps);
    error UnknownAsset(address asset);
    error DuplicateAsset(address asset);
    error NoComponents();
    error FeeTooHigh();
    error CooldownActive(uint256 availableAt);
    error RebalanceLossTooHigh(uint256 navBefore, uint256 navAfter);
    error NoSwapExecutor();
    error NothingToRebalance();
    error SlippageExceeded(uint256 got, uint256 minOut);
    error NavUnavailable();
    error UsdgCannotBeComponent();

    // ─────────────────────────────── modifiers ───────────────────────────

    modifier onlyKeeper() {
        if (!isKeeper[msg.sender] && msg.sender != owner()) revert NotKeeper();
        _;
    }

    // ─────────────────────────────── constructor ─────────────────────────

    constructor(address owner_, Config memory cfg) Ownable(owner_) {
        if (cfg.usdg == address(0) || cfg.oracle == address(0) || cfg.fees.feeRecipient == address(0)) revert ZeroAddress();
        if (cfg.components.length == 0) revert NoComponents();
        if (cfg.fees.mgmtFeeBps > MAX_MGMT_FEE_BPS || cfg.fees.mintFeeBps > MAX_MINT_FEE_BPS) revert FeeTooHigh();
        if (cfg.initialNav1e18 == 0) revert ZeroAmount();

        token = new IndexToken(cfg.name, cfg.symbol, address(this));
        usdg = IERC20(cfg.usdg);
        oracle = IPriceOracle(cfg.oracle);
        maxStaleness = cfg.maxStaleness;
        bandBps = cfg.bandBps;
        initialNav1e18 = cfg.initialNav1e18;

        mgmtFeeBps = cfg.fees.mgmtFeeBps;
        mintFeeBps = cfg.fees.mintFeeBps;
        feeRecipient = cfg.fees.feeRecipient;
        lastAccrual = uint64(block.timestamp);

        maxRebalanceLossBps = cfg.rebalance.maxRebalanceLossBps;
        rebalanceCooldown = cfg.rebalance.cooldown;
        swapExecutor = ISwapExecutor(cfg.rebalance.swapExecutor);

        uint256 sum;
        for (uint256 i; i < cfg.components.length; ++i) {
            ComponentInput memory c = cfg.components[i];
            if (c.asset == address(0)) revert ZeroAddress();
            // USDG is the settlement asset of mintWithUSDG/redeemForUSDG. If it were also a basket
            // leg, the USDG pulled in from the minter would register as basket value and mint free
            // shares, and redeemForUSDG would swap USDG for itself. Reject the config outright.
            if (c.asset == cfg.usdg) revert UsdgCannotBeComponent();
            if (_componentIndexPlusOne[c.asset] != 0) revert DuplicateAsset(c.asset);
            if (c.targetWeightBps > c.maxWeightBps) revert WeightAboveCap(c.asset, c.targetWeightBps, c.maxWeightBps);
            _components.push(
                Component({
                    asset: c.asset,
                    targetWeightBps: c.targetWeightBps,
                    maxWeightBps: c.maxWeightBps,
                    decimals: IERC20Metadata(c.asset).decimals()
                })
            );
            _componentIndexPlusOne[c.asset] = i + 1;
            sum += c.targetWeightBps;
        }
        if (sum != BPS) revert WeightsMustSumTo10000(sum);

        isKeeper[owner_] = true;
        emit KeeperSet(owner_, true);
    }

    // ─────────────────────────────── views ───────────────────────────────

    function componentCount() external view returns (uint256) {
        return _components.length;
    }

    function components() external view returns (Component[] memory) {
        return _components;
    }

    function component(uint256 i) external view returns (Component memory) {
        return _components[i];
    }

    function totalSupply() public view returns (uint256) {
        return token.totalSupply();
    }

    /// @notice Fresh price for an asset, reverting StalePrice if older than maxStaleness.
    function freshPrice(address asset) public view returns (uint256) {
        (uint256 p, uint256 updatedAt) = oracle.getPrice(asset);
        if (block.timestamp - updatedAt > maxStaleness || p == 0) revert StalePrice(asset);
        return p;
    }

    /// @notice Non-reverting staleness probe for UIs: returns first stale asset, or address(0).
    function staleAsset() public view returns (address) {
        for (uint256 i; i < _components.length; ++i) {
            (uint256 p, uint256 updatedAt) = oracle.getPrice(_components[i].asset);
            if (block.timestamp - updatedAt > maxStaleness || p == 0) return _components[i].asset;
        }
        return address(0);
    }

    /// @notice True when mint/redeem would succeed w.r.t. pausing (owner pause OR any stale leg).
    function mintRedeemOpen() external view returns (bool) {
        return !paused() && staleAsset() == address(0);
    }

    /// @notice Total basket value in 1e18 USDG. Reverts StalePrice on any stale leg.
    function totalValue() public view returns (uint256 total) {
        for (uint256 i; i < _components.length; ++i) {
            Component memory c = _components[i];
            total += _value(c, IERC20(c.asset).balanceOf(address(this)));
        }
    }

    /// @notice NAV per index token, 1e18 USDG. Reverts StalePrice on any stale leg.
    ///         Returns initialNav1e18 when supply is zero (bootstrap price).
    function nav() external view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 tv = totalValue();
        if (supply == 0) return initialNav1e18;
        return tv * 1e18 / supply;
    }

    /// @notice Current weights in bps (same order as components()). Reverts on stale.
    function currentWeightsBps() public view returns (uint256[] memory weights) {
        uint256 n = _components.length;
        weights = new uint256[](n);
        uint256[] memory values = new uint256[](n);
        uint256 total;
        for (uint256 i; i < n; ++i) {
            Component memory c = _components[i];
            values[i] = _value(c, IERC20(c.asset).balanceOf(address(this)));
            total += values[i];
        }
        if (total == 0) return weights;
        for (uint256 i; i < n; ++i) {
            weights[i] = values[i] * BPS / total;
        }
    }

    /// @notice True if any component drifted outside target ± bandBps.
    function rebalanceNeeded() external view returns (bool) {
        uint256[] memory w = currentWeightsBps();
        for (uint256 i; i < w.length; ++i) {
            uint256 t = _components[i].targetWeightBps;
            uint256 lo = t > bandBps ? t - bandBps : 0;
            uint256 hi = t + bandBps;
            if (w[i] < lo || w[i] > hi) return true;
        }
        return false;
    }

    /// @notice Basket units required to mint `indexAmount` (before fee deduction; fee is in index tokens).
    function previewMint(uint256 indexAmount) public view returns (address[] memory assets, uint256[] memory amounts) {
        uint256 n = _components.length;
        assets = new address[](n);
        amounts = new uint256[](n);
        uint256 supply = _supplyAfterAccrual();
        for (uint256 i; i < n; ++i) {
            Component memory c = _components[i];
            assets[i] = c.asset;
            if (supply == 0) {
                // bootstrap from target weights + oracle price
                uint256 price = freshPrice(c.asset);
                uint256 valueNeeded = indexAmount * initialNav1e18 / 1e18 * c.targetWeightBps / BPS; // 1e18 USDG
                amounts[i] = Math.mulDiv(valueNeeded, 10 ** c.decimals, price, Math.Rounding.Ceil);
            } else {
                uint256 bal = IERC20(c.asset).balanceOf(address(this));
                amounts[i] = Math.mulDiv(bal, indexAmount, supply, Math.Rounding.Ceil);
            }
        }
    }

    /// @notice Basket units returned for redeeming `indexAmount` (after fee).
    function previewRedeem(uint256 indexAmount) public view returns (address[] memory assets, uint256[] memory amounts) {
        uint256 n = _components.length;
        assets = new address[](n);
        amounts = new uint256[](n);
        uint256 supply = _supplyAfterAccrual();
        uint256 fee = indexAmount * mintFeeBps / BPS;
        uint256 net = indexAmount - fee;
        for (uint256 i; i < n; ++i) {
            Component memory c = _components[i];
            assets[i] = c.asset;
            if (supply == 0) continue;
            uint256 bal = IERC20(c.asset).balanceOf(address(this));
            amounts[i] = Math.mulDiv(bal, net, supply, Math.Rounding.Floor);
        }
    }

    /// @notice Management fee shares that would be minted if accrueFee() ran now.
    function pendingManagementFee() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrual;
        if (elapsed == 0 || mgmtFeeBps == 0) return 0;
        return totalSupply() * mgmtFeeBps * elapsed / (BPS * YEAR);
    }

    // ─────────────────────────────── mint / redeem ───────────────────────

    /// @notice Mint `indexAmount` index tokens by delivering the pro-rata basket.
    ///         Caller must have approved each component. `to` receives indexAmount minus mint fee.
    function mint(uint256 indexAmount, address to) external nonReentrant whenNotPaused returns (uint256 received) {
        if (indexAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        _requireFresh();
        accrueFee();

        (, uint256[] memory amounts) = previewMint(indexAmount);
        for (uint256 i; i < amounts.length; ++i) {
            if (amounts[i] == 0) revert ZeroAmount();
            IERC20(_components[i].asset).safeTransferFrom(msg.sender, address(this), amounts[i]);
        }

        uint256 fee = indexAmount * mintFeeBps / BPS;
        received = indexAmount - fee;
        token.mint(to, received);
        if (fee > 0) token.mint(feeRecipient, fee);

        emit Minted(msg.sender, to, indexAmount, fee, amounts);
    }

    /// @notice Burn `indexAmount` index tokens and receive the pro-rata basket (net of fee) at `to`.
    function redeem(uint256 indexAmount, address to) external nonReentrant whenNotPaused returns (uint256[] memory amounts) {
        if (indexAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        _requireFresh();
        accrueFee();

        (, amounts) = previewRedeem(indexAmount);
        uint256 fee = indexAmount * mintFeeBps / BPS;

        token.burn(msg.sender, indexAmount);
        if (fee > 0) token.mint(feeRecipient, fee);
        for (uint256 i; i < amounts.length; ++i) {
            if (amounts[i] > 0) IERC20(_components[i].asset).safeTransfer(to, amounts[i]);
        }

        emit Redeemed(msg.sender, to, indexAmount, fee, amounts);
    }

    /// @notice Stream the management fee as newly minted index tokens to feeRecipient.
    function accrueFee() public {
        uint256 shares = pendingManagementFee();
        uint256 elapsed = block.timestamp - lastAccrual;
        lastAccrual = uint64(block.timestamp);
        if (shares == 0) return;
        token.mint(feeRecipient, shares);
        emit ManagementFeeAccrued(feeRecipient, shares, elapsed);
    }

    // ─────────────────────────────── rebalance ───────────────────────────

    /// @notice Execute pairwise swaps sellAssets[i] -> buyAssets[i] through the approved executor.
    ///         buyAmts[i] is the minimum acceptable output. Guarded by NAV loss, caps and cooldown.
    function rebalance(address[] calldata sellAssets, uint256[] calldata sellAmts, address[] calldata buyAssets, uint256[] calldata buyAmts)
        external
        nonReentrant
        whenNotPaused
        onlyKeeper
    {
        if (address(swapExecutor) == address(0)) revert NoSwapExecutor();
        uint256 n = sellAssets.length;
        if (n == 0) revert NothingToRebalance();
        if (sellAmts.length != n || buyAssets.length != n || buyAmts.length != n) revert LengthMismatch();
        uint256 availableAt = uint256(lastRebalance) + rebalanceCooldown;
        if (block.timestamp < availableAt) revert CooldownActive(availableAt);

        uint256 navBefore = _navFresh();
        _executeSwaps(sellAssets, sellAmts, buyAssets, buyAmts);
        uint256 navAfter = _navFresh();
        _checkLoss(navBefore, navAfter);
        _enforceCaps();

        lastRebalance = uint64(block.timestamp);
        emit Rebalanced(msg.sender, navBefore, navAfter, n);
    }

    function _executeSwaps(address[] calldata sellAssets, uint256[] calldata sellAmts, address[] calldata buyAssets, uint256[] calldata buyAmts)
        internal
    {
        uint256 n = sellAssets.length;
        for (uint256 i; i < n; ++i) {
            if (_componentIndexPlusOne[sellAssets[i]] == 0) revert UnknownAsset(sellAssets[i]);
            if (_componentIndexPlusOne[buyAssets[i]] == 0) revert UnknownAsset(buyAssets[i]);
            if (sellAmts[i] == 0) revert ZeroAmount();
            IERC20(sellAssets[i]).safeTransfer(address(swapExecutor), sellAmts[i]);
            uint256 got = swapExecutor.swap(sellAssets[i], sellAmts[i], buyAssets[i], buyAmts[i], address(this));
            emit RebalanceSwap(sellAssets[i], sellAmts[i], buyAssets[i], got);
        }
    }

    function _checkLoss(uint256 navBefore, uint256 navAfter) internal view {
        if (navAfter < navBefore) {
            uint256 lossBps = (navBefore - navAfter) * BPS / navBefore;
            if (lossBps > maxRebalanceLossBps) revert RebalanceLossTooHigh(navBefore, navAfter);
        }
    }

    // ─────────────────────────────── USDG entry / exit ───────────────────

    /// @notice Rough estimate of index tokens out for `usdgIn`, at oracle prices and zero slippage.
    ///         The real fill goes through the swap executor, so pass a `minIndexOut` below this.
    function previewMintWithUSDG(uint256 usdgIn) external view returns (uint256) {
        if (usdgIn == 0) return 0;
        uint256 usdgValue = usdgIn * 1e18 / (10 ** IERC20Metadata(address(usdg)).decimals());
        uint256 shares = Math.mulDiv(usdgValue, 1e18, _navFresh());
        return shares - shares * mintFeeBps / BPS;
    }

    /// @notice Rough estimate of USDG out for redeeming `indexAmount`, at oracle prices, zero slippage.
    function previewRedeemForUSDG(uint256 indexAmount) external view returns (uint256) {
        if (indexAmount == 0) return 0;
        uint256 fee = indexAmount * mintFeeBps / BPS;
        uint256 value = Math.mulDiv(indexAmount - fee, _navFresh(), 1e18);
        return value * (10 ** IERC20Metadata(address(usdg)).decimals()) / 1e18;
    }

    /// @notice Single-asset entry: deliver USDG, the vault buys the basket and mints at NAV.
    ///         USDG is split across the components by target weight, so entering also nudges the
    ///         basket back towards target. Shares are derived from the *measured* value the swaps
    ///         actually added, so slippage is borne by the minter, not by existing holders.
    /// @param usdgIn      USDG to spend (caller must approve).
    /// @param minIndexOut Minimum index tokens to receive after fee; reverts SlippageExceeded below it.
    function mintWithUSDG(uint256 usdgIn, uint256 minIndexOut, address to)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 received)
    {
        if (usdgIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (address(swapExecutor) == address(0)) revert NoSwapExecutor();
        _requireFresh();
        accrueFee();

        uint256 navBefore = _navFresh();
        if (navBefore == 0) revert NavUnavailable();
        uint256 valueBefore = totalValue();

        usdg.safeTransferFrom(msg.sender, address(this), usdgIn);
        _spendUSDGAcrossBasket(usdgIn);

        uint256 valueAdded = totalValue() - valueBefore;
        uint256 gross = Math.mulDiv(valueAdded, 1e18, navBefore);
        if (gross == 0) revert ZeroAmount();

        uint256 fee = gross * mintFeeBps / BPS;
        received = gross - fee;
        if (received < minIndexOut) revert SlippageExceeded(received, minIndexOut);

        token.mint(to, received);
        if (fee > 0) token.mint(feeRecipient, fee);
        _enforceCaps();

        emit MintedWithUSDG(msg.sender, to, usdgIn, gross, fee);
    }

    /// @notice Single-asset exit: burn index tokens, the vault sells the pro-rata basket for USDG.
    /// @param minUsdgOut Minimum USDG to receive; reverts SlippageExceeded below it.
    function redeemForUSDG(uint256 indexAmount, uint256 minUsdgOut, address to)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 usdgOut)
    {
        if (indexAmount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (address(swapExecutor) == address(0)) revert NoSwapExecutor();
        _requireFresh();
        accrueFee();

        (, uint256[] memory amounts) = previewRedeem(indexAmount);
        uint256 fee = indexAmount * mintFeeBps / BPS;

        token.burn(msg.sender, indexAmount);
        if (fee > 0) token.mint(feeRecipient, fee);

        uint256 usdgBefore = usdg.balanceOf(address(this));
        for (uint256 i; i < amounts.length; ++i) {
            if (amounts[i] == 0) continue;
            _swapOut(_components[i].asset, amounts[i], address(usdg), 0);
        }
        usdgOut = usdg.balanceOf(address(this)) - usdgBefore;
        if (usdgOut < minUsdgOut) revert SlippageExceeded(usdgOut, minUsdgOut);
        usdg.safeTransfer(to, usdgOut);

        emit RedeemedForUSDG(msg.sender, to, indexAmount, fee, usdgOut);
    }

    /// Split `usdgIn` by target weight and buy each leg. The last leg takes the rounding remainder
    /// so no USDG is left stranded in the vault.
    function _spendUSDGAcrossBasket(uint256 usdgIn) internal {
        uint256 n = _components.length;
        uint256 spent;
        for (uint256 i; i < n; ++i) {
            uint256 slice = i + 1 == n ? usdgIn - spent : usdgIn * _components[i].targetWeightBps / BPS;
            if (slice == 0) continue;
            spent += slice;
            _swapOut(address(usdg), slice, _components[i].asset, 0);
        }
    }

    /// Send `amountIn` of `tokenIn` to the executor and pull `tokenOut` back into the vault.
    function _swapOut(address tokenIn, uint256 amountIn, address tokenOut, uint256 minOut)
        internal
        returns (uint256 got)
    {
        IERC20(tokenIn).safeTransfer(address(swapExecutor), amountIn);
        got = swapExecutor.swap(tokenIn, amountIn, tokenOut, minOut, address(this));
    }

    // ─────────────────────────────── weight solver ───────────────────────

    /// @notice Compute the trade plan that would move every leg back to its target weight.
    ///         Greedy: repeatedly match the largest surplus against the largest deficit. Legs whose
    ///         imbalance is under `minTradeBps` of the basket are left alone (dust is not worth gas).
    ///         Returns empty arrays when nothing is worth trading.
    /// @param slippageBps Tolerance baked into each `buyAmts` floor (e.g. 50 = accept 0.5% worse).
    function previewRebalance(uint16 slippageBps)
        public
        view
        returns (address[] memory sellAssets, uint256[] memory sellAmts, address[] memory buyAssets, uint256[] memory buyAmts)
    {
        Solve memory st = _solveState();
        if (!st.outOfBand) {
            return (new address[](0), new uint256[](0), new address[](0), new uint256[](0));
        }

        // At most n trades are ever needed to settle n legs.
        uint256 n = _components.length;
        Plan memory plan = Plan(new address[](n), new uint256[](n), new address[](n), new uint256[](n), 0);
        while (plan.k < n) {
            if (!_appendTrade(plan, st, slippageBps)) break;
        }

        sellAssets = new address[](plan.k);
        sellAmts = new uint256[](plan.k);
        buyAssets = new address[](plan.k);
        buyAmts = new uint256[](plan.k);
        for (uint256 i; i < plan.k; ++i) {
            sellAssets[i] = plan.sellAssets[i];
            sellAmts[i] = plan.sellAmts[i];
            buyAssets[i] = plan.buyAssets[i];
            buyAmts[i] = plan.buyAmts[i];
        }
    }

    /// Price every leg, then express its drift from target as a surplus or a deficit in 1e18 USDG.
    /// `outOfBand` is true only if some leg drifted past bandBps — otherwise there is nothing to do.
    function _solveState() private view returns (Solve memory st) {
        uint256 n = _components.length;
        st.prices = new uint256[](n);
        st.surplus = new uint256[](n);
        st.deficit = new uint256[](n);
        uint256[] memory values = new uint256[](n);
        uint256 total;
        for (uint256 i; i < n; ++i) {
            st.prices[i] = freshPrice(_components[i].asset);
            values[i] = IERC20(_components[i].asset).balanceOf(address(this)) * st.prices[i]
                / (10 ** _components[i].decimals);
            total += values[i];
        }
        if (total == 0) return st;
        st.minTrade = total * MIN_TRADE_BPS / BPS;
        for (uint256 i; i < n; ++i) {
            uint256 target = total * _components[i].targetWeightBps / BPS;
            if (values[i] > target) st.surplus[i] = values[i] - target;
            else st.deficit[i] = target - values[i];
            uint256 drift = values[i] > target ? values[i] - target : target - values[i];
            if (drift * BPS / total > bandBps) st.outOfBand = true;
        }
    }

    /// One greedy step: match the largest surplus against the largest deficit, append the trade to
    /// `plan` and net both sides down. Returns false when nothing above the dust floor is left.
    function _appendTrade(Plan memory plan, Solve memory st, uint16 slippageBps) private view returns (bool) {
        (uint256 si, uint256 sv) = _argmax(st.surplus);
        (uint256 di, uint256 dv) = _argmax(st.deficit);
        uint256 trade = sv < dv ? sv : dv;
        if (trade <= st.minTrade) return false;

        uint256 sellAmt = Math.mulDiv(trade, 10 ** _components[si].decimals, st.prices[si], Math.Rounding.Floor);
        uint256 bal = IERC20(_components[si].asset).balanceOf(address(this));
        if (sellAmt > bal) sellAmt = bal;
        if (sellAmt == 0) return false;

        uint256 buyMin = Math.mulDiv(trade, 10 ** _components[di].decimals, st.prices[di], Math.Rounding.Floor);
        plan.sellAssets[plan.k] = _components[si].asset;
        plan.sellAmts[plan.k] = sellAmt;
        plan.buyAssets[plan.k] = _components[di].asset;
        plan.buyAmts[plan.k] = buyMin * (BPS - slippageBps) / BPS;
        plan.k++;

        st.surplus[si] -= trade;
        st.deficit[di] -= trade;
        return true;
    }

    /// @notice Solve for the trades and execute them in one keeper call. Same guards as rebalance():
    ///         NAV-loss ceiling, weight caps, cooldown.
    function rebalanceToTarget(uint16 slippageBps) external nonReentrant whenNotPaused onlyKeeper returns (uint256 swaps) {
        if (address(swapExecutor) == address(0)) revert NoSwapExecutor();
        uint256 availableAt = uint256(lastRebalance) + rebalanceCooldown;
        if (block.timestamp < availableAt) revert CooldownActive(availableAt);

        (address[] memory sellAssets, uint256[] memory sellAmts, address[] memory buyAssets, uint256[] memory buyAmts) =
            previewRebalance(slippageBps);
        swaps = sellAssets.length;
        if (swaps == 0) revert NothingToRebalance();

        uint256 navBefore = _navFresh();
        for (uint256 i; i < swaps; ++i) {
            uint256 got = _swapOut(sellAssets[i], sellAmts[i], buyAssets[i], buyAmts[i]);
            emit RebalanceSwap(sellAssets[i], sellAmts[i], buyAssets[i], got);
        }
        uint256 navAfter = _navFresh();
        _checkLoss(navBefore, navAfter);
        _enforceCaps();

        lastRebalance = uint64(block.timestamp);
        emit Rebalanced(msg.sender, navBefore, navAfter, swaps);
    }

    function _argmax(uint256[] memory xs) private pure returns (uint256 idx, uint256 val) {
        for (uint256 i; i < xs.length; ++i) {
            if (xs[i] > val) {
                val = xs[i];
                idx = i;
            }
        }
    }

    // ─────────────────────────────── admin ───────────────────────────────

    function setTargetWeights(uint16[] calldata targetWeightBps) external onlyOwner {
        if (targetWeightBps.length != _components.length) revert LengthMismatch();
        uint256 sum;
        for (uint256 i; i < targetWeightBps.length; ++i) {
            Component storage c = _components[i];
            if (targetWeightBps[i] > c.maxWeightBps) revert WeightAboveCap(c.asset, targetWeightBps[i], c.maxWeightBps);
            c.targetWeightBps = targetWeightBps[i];
            sum += targetWeightBps[i];
        }
        if (sum != BPS) revert WeightsMustSumTo10000(sum);
        emit TargetWeightsSet(targetWeightBps);
    }

    function setKeeper(address keeper, bool enabled) external onlyOwner {
        isKeeper[keeper] = enabled;
        emit KeeperSet(keeper, enabled);
    }

    function setSwapExecutor(address executor) external onlyOwner {
        swapExecutor = ISwapExecutor(executor);
        emit SwapExecutorSet(executor);
    }

    function setOracle(address oracle_) external onlyOwner {
        if (oracle_ == address(0)) revert ZeroAddress();
        oracle = IPriceOracle(oracle_);
        emit OracleSet(oracle_);
    }

    function setFeeParams(uint16 mgmtFeeBps_, uint16 mintFeeBps_, address feeRecipient_) external onlyOwner {
        if (mgmtFeeBps_ > MAX_MGMT_FEE_BPS || mintFeeBps_ > MAX_MINT_FEE_BPS) revert FeeTooHigh();
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        accrueFee(); // settle at old rate first
        mgmtFeeBps = mgmtFeeBps_;
        mintFeeBps = mintFeeBps_;
        feeRecipient = feeRecipient_;
        emit FeeParamsSet(mgmtFeeBps_, mintFeeBps_, feeRecipient_);
    }

    function setRiskParams(uint32 maxStaleness_, uint16 bandBps_, uint16 maxRebalanceLossBps_, uint32 cooldown_) external onlyOwner {
        maxStaleness = maxStaleness_;
        bandBps = bandBps_;
        maxRebalanceLossBps = maxRebalanceLossBps_;
        rebalanceCooldown = cooldown_;
        emit RiskParamsSet(maxStaleness_, bandBps_, maxRebalanceLossBps_, cooldown_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────── internals ───────────────────────────

    function _value(Component memory c, uint256 balance) internal view returns (uint256) {
        if (balance == 0) {
            freshPrice(c.asset); // still enforce staleness on empty legs
            return 0;
        }
        return balance * freshPrice(c.asset) / (10 ** c.decimals);
    }

    function _requireFresh() internal view {
        for (uint256 i; i < _components.length; ++i) {
            freshPrice(_components[i].asset);
        }
    }

    function _navFresh() internal view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 tv = totalValue();
        if (supply == 0) return initialNav1e18;
        return tv * 1e18 / supply;
    }

    function _supplyAfterAccrual() internal view returns (uint256) {
        return totalSupply() + pendingManagementFee();
    }

    function _enforceCaps() internal view {
        uint256[] memory w = currentWeightsBps();
        for (uint256 i; i < w.length; ++i) {
            if (w[i] > _components[i].maxWeightBps) revert WeightAboveCap(_components[i].asset, w[i], _components[i].maxWeightBps);
        }
    }
}
