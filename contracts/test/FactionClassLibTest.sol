// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/FactionClassLib.sol";

/// @title FactionClassLibTest
/// @notice Contratto di test per FactionClassLib
/// @dev Espone tutte le funzionalità della libreria per i test
contract FactionClassLibTest {
    using FactionClassLib for FactionClassLib.FactionClassData;

    FactionClassLib.FactionClassData private data;

    event FactionGenerated(uint8 factionId);
    event ClassGenerated(uint8 classId);
    event MaxGenLimitsUpdated(uint256 newMaxFactionGen, uint256 newMaxClassGen);

    // Espone i valori degli enum per i test
    function Faction_NONE() public pure returns (uint256) { return uint256(FactionClassLib.Faction.NONE); }
    function Faction_GUARDIAN() public pure returns (uint256) { return uint256(FactionClassLib.Faction.GUARDIAN); }
    function Faction_SHADOW() public pure returns (uint256) { return uint256(FactionClassLib.Faction.SHADOW); }
    function Faction_MYSTIC() public pure returns (uint256) { return uint256(FactionClassLib.Faction.MYSTIC); }
    function Faction_WILD() public pure returns (uint256) { return uint256(FactionClassLib.Faction.WILD); }

    function Class_NONE() public pure returns (uint256) { return uint256(FactionClassLib.Class.NONE); }
    function Class_WARRIOR() public pure returns (uint256) { return uint256(FactionClassLib.Class.WARRIOR); }
    function Class_EXPLORER() public pure returns (uint256) { return uint256(FactionClassLib.Class.EXPLORER); }
    function Class_MAGE() public pure returns (uint256) { return uint256(FactionClassLib.Class.MAGE); }
    function Class_RANGER() public pure returns (uint256) { return uint256(FactionClassLib.Class.RANGER); }
    function Class_TANK() public pure returns (uint256) { return uint256(FactionClassLib.Class.TANK); }

    // Espone le funzioni della libreria
    function setMaxGenLimits(uint256 maxFactions, uint256 maxClasses) public {
        data.setMaxGenLimits(maxFactions, maxClasses);
        emit MaxGenLimitsUpdated(maxFactions, maxClasses);
    }

    function generateValidFaction(bytes32 randomValue, uint256 attempt) public returns (uint256) {
        FactionClassLib.Faction faction = FactionClassLib.generateValidFaction(uint256(randomValue), attempt, data);
        uint8 factionId = uint8(uint256(faction));
        emit FactionGenerated(factionId);
        return uint256(faction);
    }

    function generateValidClass(bytes32 randomValue, uint256 attempt) public returns (uint256) {
        FactionClassLib.Class class_ = FactionClassLib.generateValidClass(uint256(randomValue), attempt, data);
        uint8 classId = uint8(uint256(class_));
        emit ClassGenerated(classId);
        return uint256(class_);
    }

    // Funzioni di utilità per i test
    function getMaxGenLimits() public view returns (uint256 maxFactionGen, uint256 maxClassGen) {
        return data.getMaxGenLimits();
    }

    function getFactionGenCount() public view returns (uint256) {
        return data.facGen;
    }

    function getClassGenCount() public view returns (uint256) {
        return data.classGen;
    }

    function getFactionCount(uint256 faction) public view returns (uint256) {
        return data.factionCount[faction];
    }

    function getClassCount(uint256 class_) public view returns (uint256) {
        return data.classCount[class_];
    }

    function hasAvailableSlots() public view returns (bool) {
        return data.hasAvailableSlots();
    }

    function getAvailableFactions() public view returns (uint256[5] memory) {
        return data.getAvailableFactions();
    }

    function getAvailableClasses() public view returns (uint256[6] memory) {
        return data.getAvailableClasses();
    }
}