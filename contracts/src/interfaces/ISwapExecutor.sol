// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Adapter the vault calls to execute a rebalance trade.
///         The vault transfers `amountIn` of `tokenIn` to the executor before calling,
///         and expects at least `minAmountOut` of `tokenOut` to be sent back to `recipient`.
interface ISwapExecutor {
    function swap(address tokenIn, uint256 amountIn, address tokenOut, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut);
}
