// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IndexVault} from "./IndexVault.sol";
import {VaultDeployer} from "./VaultDeployer.sol";

/// @notice Deploys IndexVaults and keeps a registry of them.
contract IndexFactory is Ownable {
    /// Creation code for IndexVault lives here, not in the factory's own bytecode (EIP-170).
    VaultDeployer public immutable deployer;

    address[] private _indexes;
    mapping(address => bool) public isIndex;
    mapping(string => address) public vaultBySymbol;

    event IndexCreated(address indexed vault, address indexed token, string symbol, address owner);

    error SymbolTaken(string symbol);

    error ZeroAddress();

    constructor(address owner_, VaultDeployer deployer_) Ownable(owner_) {
        if (address(deployer_) == address(0)) revert ZeroAddress();
        deployer = deployer_;
    }

    /// @notice Deploy a new vault. `vaultOwner` becomes owner (and default keeper) of the vault.
    function createIndex(address vaultOwner, IndexVault.Config calldata cfg) external onlyOwner returns (address vault) {
        if (vaultBySymbol[cfg.symbol] != address(0)) revert SymbolTaken(cfg.symbol);
        IndexVault v = IndexVault(deployer.deploy(vaultOwner, cfg));
        vault = address(v);
        _indexes.push(vault);
        isIndex[vault] = true;
        vaultBySymbol[cfg.symbol] = vault;
        emit IndexCreated(vault, address(v.token()), cfg.symbol, vaultOwner);
    }

    function allIndexes() external view returns (address[] memory) {
        return _indexes;
    }

    function indexCount() external view returns (uint256) {
        return _indexes.length;
    }
}
