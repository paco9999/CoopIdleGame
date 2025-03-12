// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/WhitelistLib.sol";

/// @title WhitelistLibTest
/// @notice Contratto di test per WhitelistLib
/// @dev Espone tutte le funzionalità della libreria per i test
contract WhitelistLibTest {
    using WhitelistLib for WhitelistLib.WhitelistData;

    WhitelistLib.WhitelistData private data;
    uint256 constant MINT_PER_WALLET = 2;

    function setWhitelistPhase1(address[] calldata addresses, bool status) public {
        data.setWhitelistPhase1(addresses, status);
    }

    function setWhitelistPhase2(address[] calldata addresses, bool status) public {
        data.setWhitelistPhase2(addresses, status);
    }

    function setPhaseStatus(uint256 phase, bool status) public {
        data.setPhaseStatus(phase, status);
    }

    function setPrice(uint256 _price) public {
        data.setPrice(_price);
    }

    function setWhitelistBatch(
        address[] calldata addresses,
        bool[] calldata phase1Status,
        bool[] calldata phase2Status
    ) public {
        data.setWhitelistBatch(addresses, phase1Status, phase2Status);
    }

    function checkMintConditions(
        address sender,
        uint256 value
    ) public view returns (bool) {
        return data.checkMintConditions(sender, value, MINT_PER_WALLET);
    }

    function getMintInfo(address wallet) public view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    ) {
        return data.getMintInfo(wallet, MINT_PER_WALLET);
    }

    // Funzioni di visualizzazione aggiuntive per i test
    function isPhase1Active() public view returns (bool) {
        return data.isPhase1Active;
    }

    function isPhase2Active() public view returns (bool) {
        return data.isPhase2Active;
    }

    function getPrice() public view returns (uint256) {
        return data.price;
    }

    function isWhitelistedInPhase1(address account) public view returns (bool) {
        return data.whitelistPhase1[account];
    }

    function isWhitelistedInPhase2(address account) public view returns (bool) {
        return data.whitelistPhase2[account];
    }
} 