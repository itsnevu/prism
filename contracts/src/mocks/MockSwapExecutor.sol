// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISwapExecutor} from "../interfaces/ISwapExecutor.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Swaps at oracle prices minus a configurable slippage. Stands in for a DEX router.
///         Mints tokenOut (requires MockERC20) so it never runs out of inventory; burns tokenIn.
contract MockSwapExecutor is ISwapExecutor, Ownable {
    using SafeERC20 for IERC20;

    IPriceOracle public oracle;
    uint256 public slippageBps; // applied against oracle-implied output

    event Swapped(address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);
    event SlippageSet(uint256 bps);

    error InsufficientOutput(uint256 got, uint256 min);

    constructor(address owner_, IPriceOracle oracle_, uint256 slippageBps_) Ownable(owner_) {
        oracle = oracle_;
        slippageBps = slippageBps_;
    }

    function setSlippageBps(uint256 bps) external onlyOwner {
        require(bps <= 10_000, "bps");
        slippageBps = bps;
        emit SlippageSet(bps);
    }

    function quote(address tokenIn, uint256 amountIn, address tokenOut) public view returns (uint256) {
        (uint256 pIn,) = oracle.getPrice(tokenIn);
        (uint256 pOut,) = oracle.getPrice(tokenOut);
        uint8 dIn = IERC20Metadata(tokenIn).decimals();
        uint8 dOut = IERC20Metadata(tokenOut).decimals();
        // value in 1e18 USDG = amountIn * pIn / 10^dIn
        uint256 value = amountIn * pIn / (10 ** dIn);
        uint256 out = value * (10 ** dOut) / pOut;
        return out * (10_000 - slippageBps) / 10_000;
    }

    function swap(address tokenIn, uint256 amountIn, address tokenOut, uint256 minAmountOut, address recipient)
        external
        override
        returns (uint256 amountOut)
    {
        amountOut = quote(tokenIn, amountIn, tokenOut);
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        // consume input (already transferred to us by the vault)
        MockERC20(tokenIn).burn(address(this), amountIn);
        MockERC20(tokenOut).mint(recipient, amountOut);
        emit Swapped(tokenIn, amountIn, tokenOut, amountOut);
    }
}
