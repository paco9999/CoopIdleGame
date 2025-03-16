// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/IIdleProcioneNFT.sol";

contract MockDungeonManager {
    function modifyHealth(address nftContract, uint256 tokenId, uint256 amount, bool isAddition) external {
        IIdleProcioneNFT(nftContract).modifyCurrentHealth(tokenId, amount, isAddition);
    }

    // Funzione per ricevere ETH
    receive() external payable {}

    // Funzione fallback
    fallback() external payable {}
} 