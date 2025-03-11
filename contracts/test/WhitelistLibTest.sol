// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/WhitelistLib.sol";

/// @title WhitelistLibTest
/// @notice Contratto di test per WhitelistLib
/// @dev Espone tutte le funzionalità della libreria per i test
contract WhitelistLibTest {
    using WhitelistLib for WhitelistLib.WhitelistData;

    // Struttura dati per i test
    WhitelistLib.WhitelistData public data;

    // Espone le funzioni della libreria
    function setWhitelistPhase1(address[] calldata addresses, bool status) public {
        WhitelistLib.setWhitelistPhase1(data, addresses, status);
    }

    function setWhitelistPhase2(address[] calldata addresses, bool status) public {
        WhitelistLib.setWhitelistPhase2(data, addresses, status);
    }

    function setPhaseStatus(uint256 phase, bool status) public returns (bool) {
        return WhitelistLib.setPhaseStatus(data, phase, status);
    }

    function setPrice(uint256 _price) public returns (bool) {
        return WhitelistLib.setPrice(data, _price);
    }

    function setWhitelistBatch(
        address[] calldata addresses,
        bool[] calldata phase1Status,
        bool[] calldata phase2Status
    ) public {
        WhitelistLib.setWhitelistBatch(data, addresses, phase1Status, phase2Status);
    }

    function checkMintConditions(
        address sender,
        uint256 value,
        uint256 mintPerWallet
    ) public view returns (bool) {
        return WhitelistLib.checkMintConditions(data, sender, value, mintPerWallet);
    }

    function getMintInfo(
        address wallet,
        uint256 mintPerWallet
    ) public view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    ) {
        return WhitelistLib.getMintInfo(data, wallet, mintPerWallet);
    }

    // Funzioni di utilità per i test
    function isInPhase1(address wallet) public view returns (bool) {
        return data.whitelistPhase1[wallet];
    }

    function isInPhase2(address wallet) public view returns (bool) {
        return data.whitelistPhase2[wallet];
    }

    function getMintedAmount(address wallet) public view returns (uint256) {
        return data.mintedPerWallet[wallet];
    }

    function getPhase1Status() public view returns (bool) {
        return data.isPhase1Active;
    }

    function getPhase2Status() public view returns (bool) {
        return data.isPhase2Active;
    }

    function getPrice() public view returns (uint256) {
        return data.price;
    }

    // Funzione per simulare un mint (incrementa il contatore)
    function incrementMintCount(address wallet) public {
        data.mintedPerWallet[wallet]++;
    }
} 