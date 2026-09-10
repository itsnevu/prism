// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IndexVault} from "./IndexVault.sol";

/// @notice Holds IndexVault's creation code so IndexFactory does not have to.
///
///         A factory that embeds a vault's initcode carries that initcode in its own *runtime*
///         bytecode, and IndexVault is large enough that the pair blew past the 24 KB EIP-170
///         limit. Splitting the creation code into its own contract keeps both sides deployable
///         and changes nothing about how vaults behave.
contract VaultDeployer {
    /// @dev Anyone may call this, but a vault created outside the factory is not registered by it
    ///      and is not referenced by the frontend — it is just a contract someone paid gas for.
    function deploy(address vaultOwner, IndexVault.Config calldata cfg) external returns (address) {
        return address(new IndexVault(vaultOwner, cfg));
    }
}
