// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/WhitelistLib.sol";
import "./WhitelistLibTestLib.sol";

/// @title WhitelistLibTest
/// @notice Contratto di test per WhitelistLib
/// @dev Espone tutte le funzionalità della libreria per i test
contract WhitelistLibTest {
    using WhitelistLibTestLib for WhitelistLibTestLib.WhitelistData;

    WhitelistLibTestLib.WhitelistData private data;

    function addToWhitelist(address account, uint8 phase) public {
        WhitelistLibTestLib.addToWhitelist(data, account, phase);
    }

    function removeFromWhitelist(address account, uint8 phase) public {
        WhitelistLibTestLib.removeFromWhitelist(data, account, phase);
    }

    function setPhaseStatus(uint8 phase, bool status) public {
        WhitelistLibTestLib.setPhaseStatus(data, phase, status);
    }

    function setPrice(uint8 phase, uint256 price) public {
        WhitelistLibTestLib.setPrice(data, phase, price);
    }

    function setMaxMint(uint8 phase, uint256 maxMint) public {
        WhitelistLibTestLib.setMaxMint(data, phase, maxMint);
    }

    function isWhitelisted(address account, uint8 phase) public view returns (bool) {
        return WhitelistLibTestLib.isWhitelisted(data, account, phase);
    }

    function isPhaseActive(uint8 phase) public view returns (bool) {
        return WhitelistLibTestLib.isPhaseActive(data, phase);
    }

    function getPrice(uint8 phase) public view returns (uint256) {
        return WhitelistLibTestLib.getPrice(data, phase);
    }

    function getMaxMint(uint8 phase) public view returns (uint256) {
        return WhitelistLibTestLib.getMaxMint(data, phase);
    }

    function getMintCount(address account) public view returns (uint256) {
        return WhitelistLibTestLib.getMintCount(data, account);
    }

    function incrementMintCount(address account) public {
        WhitelistLibTestLib.incrementMintCount(data, account);
    }

    function checkMintConditions(address account) public view returns (uint256) {
        return WhitelistLibTestLib.checkMintConditions(data, account);
    }

    function getMintInfo(address account) public view returns (bool, uint256, uint256) {
        return WhitelistLibTestLib.getMintInfo(data, account);
    }
} 