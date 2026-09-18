// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ISwapExecutor} from "../interfaces/ISwapExecutor.sol";

/// @dev Uniswap SwapRouter02 (no deadline in the params struct).
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Executes vault trades on Uniswap v3 (Robinhood Chain). One fee tier per unordered
///         pair, chosen by the owner for the deepest pool. Only registered vaults may swap, so
///         tokens parked here between transfer and swap cannot be swept by a stranger.
contract UniswapV3SwapExecutor is ISwapExecutor, Ownable2Step {
    using SafeERC20 for IERC20;

    ISwapRouter02 public immutable router;
    mapping(bytes32 => uint24) public feeOf;
    mapping(address => bool) public isVault;

    event FeeTierSet(address indexed a, address indexed b, uint24 fee);
    event VaultSet(address indexed vault, bool allowed);
    event Swapped(address indexed vault, address tokenIn, uint256 amountIn, address tokenOut, uint256 amountOut);

    error NotVault();
    error NoRoute(address tokenIn, address tokenOut);
    error ZeroAddress();

    constructor(address owner_, ISwapRouter02 router_) Ownable(owner_) {
        if (address(router_) == address(0)) revert ZeroAddress();
        router = router_;
    }

    function setFeeTier(address a, address b, uint24 fee) external onlyOwner {
        feeOf[_key(a, b)] = fee;
        emit FeeTierSet(a, b, fee);
    }

    function setVault(address vault, bool allowed) external onlyOwner {
        isVault[vault] = allowed;
        emit VaultSet(vault, allowed);
    }

    /// @inheritdoc ISwapExecutor
    function swap(address tokenIn, uint256 amountIn, address tokenOut, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut)
    {
        if (!isVault[msg.sender]) revert NotVault();
        uint24 fee = feeOf[_key(tokenIn, tokenOut)];
        if (fee == 0) revert NoRoute(tokenIn, tokenOut);
        IERC20(tokenIn).forceApprove(address(router), amountIn);
        amountOut = router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
        emit Swapped(msg.sender, tokenIn, amountIn, tokenOut, amountOut);
    }

    /// @notice Owner escape hatch for tokens stranded by a failed vault call.
    function sweep(IERC20 token, address to) external onlyOwner {
        token.safeTransfer(to, token.balanceOf(address(this)));
    }

    function _key(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}
