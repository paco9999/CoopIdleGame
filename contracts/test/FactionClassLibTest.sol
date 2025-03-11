// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/FactionClassLib.sol";

/// @title FactionClassLibTest
/// @notice Contratto di test per FactionClassLib
/// @dev Espone tutte le funzionalità della libreria per i test
contract FactionClassLibTest {
    using FactionClassLib for FactionClassLib.FactionClassData;

    // Struttura dati per i test
    FactionClassLib.FactionClassData public data;

    // Espone i valori degli enum per i test
    function Faction_NONE() public pure returns (uint256) { return uint256(FactionClassLib.Faction.NONE); }
    function Faction_GUARDIAN() public pure returns (uint256) { return uint256(FactionClassLib.Faction.GUARDIAN); }
    function Faction_SHADOW() public pure returns (uint256) { return uint256(FactionClassLib.Faction.SHADOW); }
    function Faction_MYSTIC() public pure returns (uint256) { return uint256(FactionClassLib.Faction.MYSTIC); }
    function Faction_WILD() public pure returns (uint256) { return uint256(FactionClassLib.Faction.WILD); }

    function Class_NONE() public pure returns (uint256) { return uint256(FactionClassLib.Class.NONE); }
    function Class_WARRIOR() public pure returns (uint256) { return uint256(FactionClassLib.Class.WARRIOR); }
    function Class_ROGUE() public pure returns (uint256) { return uint256(FactionClassLib.Class.ROGUE); }
    function Class_MAGE() public pure returns (uint256) { return uint256(FactionClassLib.Class.MAGE); }
    function Class_RANGER() public pure returns (uint256) { return uint256(FactionClassLib.Class.RANGER); }
    function Class_TANK() public pure returns (uint256) { return uint256(FactionClassLib.Class.TANK); }

    // Espone le funzioni della libreria
    function setMaxGenLimits(uint256 maxFactionGen, uint256 maxClassGen) public {
        FactionClassLib.setMaxGenLimits(data, maxFactionGen, maxClassGen);
    }

    function hasAvailableSlots() public view returns (bool) {
        return FactionClassLib.hasAvailableSlots(data);
    }

    function generateValidFaction(uint256 randomValue, uint256 attempt) public returns (uint256) {
        return uint256(FactionClassLib.generateValidFaction(randomValue, attempt, data));
    }

    function generateValidClass(uint256 randomValue, uint256 attempt) public returns (uint256) {
        return uint256(FactionClassLib.generateValidClass(randomValue, attempt, data));
    }

    // Funzioni di utilità per i test
    function getMaxFactionGen() public view returns (uint256) {
        return data.maxFactionGen;
    }

    function getMaxClassGen() public view returns (uint256) {
        return data.maxClassGen;
    }

    function getFacGen() public view returns (uint256) {
        return data.facGen;
    }

    function getClassGen() public view returns (uint256) {
        return data.classGen;
    }

    function getFactionCount(uint256 faction) public view returns (uint256) {
        return data.factionCount[faction];
    }

    function getClassCount(uint256 class_) public view returns (uint256) {
        return data.classCount[class_];
    }
} 