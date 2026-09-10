// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @notice Owner-controlled oracle for local/testnet use. Prices are 1e18 USDG per whole asset unit.
contract MockOracle is IPriceOracle, Ownable {
    struct Feed {
        uint256 price;
        uint256 updatedAt;
    }

    mapping(address => Feed) private _feeds;

    event PriceSet(address indexed asset, uint256 price, uint256 updatedAt);
    event FeedMarkedStale(address indexed asset, uint256 updatedAt);

    error NoFeed(address asset);

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Set price with updatedAt = block.timestamp.
    function setPrice(address asset, uint256 price) external onlyOwner {
        _feeds[asset] = Feed(price, block.timestamp);
        emit PriceSet(asset, price, block.timestamp);
    }

    /// @notice Set price with an explicit timestamp (useful for simulating market close).
    function setPriceWithTimestamp(address asset, uint256 price, uint256 updatedAt) external onlyOwner {
        _feeds[asset] = Feed(price, updatedAt);
        emit PriceSet(asset, price, updatedAt);
    }

    function setPrices(address[] calldata assets, uint256[] calldata prices) external onlyOwner {
        require(assets.length == prices.length, "len");
        for (uint256 i; i < assets.length; ++i) {
            _feeds[assets[i]] = Feed(prices[i], block.timestamp);
            emit PriceSet(assets[i], prices[i], block.timestamp);
        }
    }

    /// @notice Mark a feed stale by rewinding its timestamp `ageSeconds` into the past.
    function markStale(address asset, uint256 ageSeconds) external onlyOwner {
        Feed storage f = _feeds[asset];
        f.updatedAt = block.timestamp > ageSeconds ? block.timestamp - ageSeconds : 0;
        emit FeedMarkedStale(asset, f.updatedAt);
    }

    /// @notice Refresh timestamp without changing price (e.g. market reopens).
    function refresh(address asset) external onlyOwner {
        Feed storage f = _feeds[asset];
        f.updatedAt = block.timestamp;
        emit PriceSet(asset, f.price, block.timestamp);
    }

    function getPrice(address asset) external view override returns (uint256 price1e18, uint256 updatedAt) {
        Feed memory f = _feeds[asset];
        if (f.price == 0) revert NoFeed(asset);
        return (f.price, f.updatedAt);
    }
}
