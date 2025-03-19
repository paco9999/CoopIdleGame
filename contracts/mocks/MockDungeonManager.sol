// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IIdleProcioneNFT.sol";

/**
 * @title MockDungeonManager
 * @dev Mock del DungeonManager per scopi di testing
 */
contract MockDungeonManager {
    // Dummy address che verrà restituito come owner
    address public owner;

    // Indica se il mittente ha il permesso di modificare la salute
    mapping(address => bool) public canModifyHealth;

    constructor() {
        owner = msg.sender;
        canModifyHealth[msg.sender] = true;
    }

    function setCanModifyHealth(address account, bool allowed) external {
        canModifyHealth[account] = allowed;
    }

    function modifyHealth(address nftContract, uint256 tokenId, uint256 amount, bool isAddition) external {
        require(canModifyHealth[msg.sender], "Not authorized to modify health");
        IIdleProcioneNFT(nftContract).modifyCurrentHealth(tokenId, amount, isAddition);
    }

    function getAddress() external view returns (address) {
        return address(this);
    }

    // Funzione per ricevere ETH
    receive() external payable {}

    // Funzione fallback
    fallback() external payable {}
} 