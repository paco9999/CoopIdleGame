// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../IdleProcioneNFT.sol";

/// @title ReentrancyAttacker
/// @notice Contratto malevolo per testare la protezione contro la reentracy
contract ReentrancyAttacker {
    IdleProcioneNFT public nftContract;
    uint256 public tokenId;
    uint256 public newData;
    bool public attacking;

    constructor(address payable _nftContract) {
        nftContract = IdleProcioneNFT(_nftContract);
    }

    function attack(uint256 _tokenId, uint256 _newData) external {
        tokenId = _tokenId;
        newData = _newData;
        attacking = true;
        nftContract.updateProcioneData(tokenId, newData);
    }

    function onDataUpdated(uint256 _tokenId, uint256 _newData) external {
        if (attacking) {
            attacking = false;
            nftContract.updateProcioneData(_tokenId, _newData);
        }
    }

    fallback() external {
        if (attacking) {
            attacking = false;
            nftContract.updateProcioneData(tokenId, newData);
        }
    }

    receive() external payable {
        if (attacking) {
            attacking = false;
            nftContract.updateProcioneData(tokenId, newData);
        }
    }
} 