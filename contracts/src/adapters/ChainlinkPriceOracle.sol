// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice Production oracle: one Chainlink aggregator per basket asset, normalised to 1e18 USD.
///         Reports `updatedAt` faithfully; IndexVault applies its own staleness rule.
///         Refuses to report a price that cannot be true (zero/negative answer, unfinished round).
contract ChainlinkPriceOracle is IPriceOracle, Ownable2Step {
    struct Feed {
        IAggregatorV3 aggregator;
        uint8 decimals;
    }

    mapping(address => Feed) private _feeds;

    event FeedSet(address indexed asset, address indexed aggregator, uint8 decimals);
    event FeedRemoved(address indexed asset);

    error ZeroAddress();
    error UnknownAsset(address asset);
    error InvalidAnswer(address asset, int256 answer);
    error IncompleteRound(address asset);
    error UnsupportedDecimals(uint8 decimals);

    constructor(address owner_) Ownable(owner_) {}

    function setFeed(address asset, IAggregatorV3 aggregator) external onlyOwner {
        if (asset == address(0) || address(aggregator) == address(0)) revert ZeroAddress();
        uint8 dec = aggregator.decimals();
        if (dec > 18) revert UnsupportedDecimals(dec);
        _feeds[asset] = Feed({aggregator: aggregator, decimals: dec});
        emit FeedSet(asset, address(aggregator), dec);
    }

    function removeFeed(address asset) external onlyOwner {
        if (address(_feeds[asset].aggregator) == address(0)) revert UnknownAsset(asset);
        delete _feeds[asset];
        emit FeedRemoved(asset);
    }

    function feedOf(address asset) external view returns (address aggregator, uint8 decimals) {
        Feed memory f = _feeds[asset];
        return (address(f.aggregator), f.decimals);
    }

    /// @inheritdoc IPriceOracle
    function getPrice(address asset) external view override returns (uint256 price1e18, uint256 updatedAt) {
        Feed memory f = _feeds[asset];
        if (address(f.aggregator) == address(0)) revert UnknownAsset(asset);
        (uint80 roundId, int256 answer,, uint256 ts, uint80 answeredInRound) = f.aggregator.latestRoundData();
        if (answer <= 0) revert InvalidAnswer(asset, answer);
        if (ts == 0 || answeredInRound < roundId) revert IncompleteRound(asset);
        price1e18 = uint256(answer) * (10 ** (18 - f.decimals));
        updatedAt = ts;
    }
}
