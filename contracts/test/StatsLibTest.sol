// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/StatsLib.sol";

/// @title StatsLibTest
/// @notice Contratto di test per esporre le funzioni della libreria StatsLib
contract StatsLibTest {
    using StatsLib for uint256;

    // Esposizione delle costanti
    function XP_MASK() public pure returns (uint256) {
        return StatsLib.XP_MASK;
    }

    function LEVEL_MASK() public pure returns (uint256) {
        return StatsLib.LEVEL_MASK;
    }

    function HEALTH_MASK() public pure returns (uint256) {
        return StatsLib.HEALTH_MASK;
    }

    function STRENGTH_MASK() public pure returns (uint256) {
        return StatsLib.STRENGTH_MASK;
    }

    function SPEED_MASK() public pure returns (uint256) {
        return StatsLib.SPEED_MASK;
    }

    function INTELLIGENCE_MASK() public pure returns (uint256) {
        return StatsLib.INTELLIGENCE_MASK;
    }

    function ACCURACY_MASK() public pure returns (uint256) {
        return StatsLib.ACCURACY_MASK;
    }

    function BREEDING_MASK() public pure returns (uint256) {
        return StatsLib.BREEDING_MASK;
    }

    function CLASS_MASK() public pure returns (uint256) {
        return StatsLib.CLASS_MASK;
    }

    function FACTION_MASK() public pure returns (uint256) {
        return StatsLib.FACTION_MASK;
    }

    function GENETICS_MASK() public pure returns (uint256) {
        return StatsLib.GENETICS_MASK;
    }

    // Esposizione delle posizioni
    function XP_POSITION() public pure returns (uint256) {
        return StatsLib.XP_POSITION;
    }

    function LEVEL_POSITION() public pure returns (uint256) {
        return StatsLib.LEVEL_POSITION;
    }

    function HEALTH_POSITION() public pure returns (uint256) {
        return StatsLib.HEALTH_POSITION;
    }

    function STRENGTH_POSITION() public pure returns (uint256) {
        return StatsLib.STRENGTH_POSITION;
    }

    function SPEED_POSITION() public pure returns (uint256) {
        return StatsLib.SPEED_POSITION;
    }

    function INTELLIGENCE_POSITION() public pure returns (uint256) {
        return StatsLib.INTELLIGENCE_POSITION;
    }

    function ACCURACY_POSITION() public pure returns (uint256) {
        return StatsLib.ACCURACY_POSITION;
    }

    function BREEDING_POSITION() public pure returns (uint256) {
        return StatsLib.BREEDING_POSITION;
    }

    function CLASS_POSITION() public pure returns (uint256) {
        return StatsLib.CLASS_POSITION;
    }

    function FACTION_POSITION() public pure returns (uint256) {
        return StatsLib.FACTION_POSITION;
    }

    function GENETICS_POSITION() public pure returns (uint256) {
        return StatsLib.GENETICS_POSITION;
    }

    // Esposizione delle funzioni di utilità
    function updateField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) public pure returns (uint256) {
        return StatsLib.updateField(data, value, mask, position);
    }

    function extractField(
        uint256 data,
        uint256 mask,
        uint256 position
    ) public pure returns (uint256) {
        return StatsLib.extractField(data, mask, position);
    }
} 