// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal price oracle interface consumed by IndexVault.
/// @dev price is USDG per 1 whole unit of `asset`, scaled to 1e18.
interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256 price1e18, uint256 updatedAt);
}
