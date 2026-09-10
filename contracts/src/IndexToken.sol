// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IIndexToken} from "./interfaces/IIndexToken.sol";

/// @notice 18-decimal ERC20 representing a pro-rata claim on an IndexVault's basket.
///         Only the vault may mint or burn.
contract IndexToken is ERC20, ERC20Permit, IIndexToken {
    address public immutable override vault;

    error OnlyVault();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(string memory name_, string memory symbol_, address vault_) ERC20(name_, symbol_) ERC20Permit(name_) {
        vault = vault_;
    }

    function mint(address to, uint256 amount) external override onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external override onlyVault {
        _burn(from, amount);
    }
}
