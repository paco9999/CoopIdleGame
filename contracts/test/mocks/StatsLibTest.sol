// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../libraries/StatsLib.sol";

/// @title StatsLibTest
/// @notice Contratto di test per la libreria StatsLib
contract StatsLibTest {
    using StatsLib for uint256;

    // Funzioni per ottenere le maschere
    function getXPMask() public pure returns (uint256) {
        return StatsLib.XP_MASK;
    }

    function getLevelMask() public pure returns (uint256) {
        return StatsLib.LEVEL_MASK;
    }

    function getHealthMask() public pure returns (uint256) {
        return StatsLib.HEALTH_MASK;
    }

    function getStrengthMask() public pure returns (uint256) {
        return StatsLib.STRENGTH_MASK;
    }

    function getSpeedMask() public pure returns (uint256) {
        return StatsLib.SPEED_MASK;
    }

    function getIntelligenceMask() public pure returns (uint256) {
        return StatsLib.INTELLIGENCE_MASK;
    }

    function getAccuracyMask() public pure returns (uint256) {
        return StatsLib.ACCURACY_MASK;
    }

    function getCurrentHealthMask() public pure returns (uint256) {
        return StatsLib.CURRENT_HEALTH_MASK;
    }

    function getBreedingMask() public pure returns (uint256) {
        return StatsLib.BREEDING_MASK;
    }

    function getGeneticsMask() public pure returns (uint256) {
        return StatsLib.GENETICS_MASK;
    }

    function getClassMask() public pure returns (uint256) {
        return StatsLib.CLASS_MASK;
    }

    function getFactionMask() public pure returns (uint256) {
        return StatsLib.FACTION_MASK;
    }

    function getProfessionMask() public pure returns (uint256) {
        return StatsLib.PROFESSION_MASK;
    }

    function getProfessionLvlMask() public pure returns (uint256) {
        return StatsLib.PROFESSIONLVL_MASK;
    }

    function getProfessionExpMask() public pure returns (uint256) {
        return StatsLib.PROFESSIONEXP_MASK;
    }

    function getDungeonStatusMask() public pure returns (uint256) {
        return StatsLib.DUNGEON_STATUS_MASK;
    }

    // Funzioni per ottenere le posizioni
    function getXPPosition() public pure returns (uint256) {
        return StatsLib.XP_POSITION;
    }

    function getLevelPosition() public pure returns (uint256) {
        return StatsLib.LEVEL_POSITION;
    }

    function getHealthPosition() public pure returns (uint256) {
        return StatsLib.HEALTH_POSITION;
    }

    function getStrengthPosition() public pure returns (uint256) {
        return StatsLib.STRENGTH_POSITION;
    }

    function getSpeedPosition() public pure returns (uint256) {
        return StatsLib.SPEED_POSITION;
    }

    function getIntelligencePosition() public pure returns (uint256) {
        return StatsLib.INTELLIGENCE_POSITION;
    }

    function getAccuracyPosition() public pure returns (uint256) {
        return StatsLib.ACCURACY_POSITION;
    }

    function getCurrentHealthPosition() public pure returns (uint256) {
        return StatsLib.CURRENT_HEALTH_POSITION;
    }

    function getBreedingPosition() public pure returns (uint256) {
        return StatsLib.BREEDING_POSITION;
    }

    function getGeneticsPosition() public pure returns (uint256) {
        return StatsLib.GENETICS_POSITION;
    }

    function getClassPosition() public pure returns (uint256) {
        return StatsLib.CLASS_POSITION;
    }

    function getFactionPosition() public pure returns (uint256) {
        return StatsLib.FACTION_POSITION;
    }

    function getProfessionPosition() public pure returns (uint256) {
        return StatsLib.PROFESSION_POSITION;
    }

    function getProfessionLvlPosition() public pure returns (uint256) {
        return StatsLib.PROFESSIONLVL_POSITION;
    }

    function getProfessionExpPosition() public pure returns (uint256) {
        return StatsLib.PROFESSIONEXP_POSITION;
    }

    function getDungeonStatusPosition() public pure returns (uint256) {
        return StatsLib.DUNGEON_STATUS_POSITION;
    }

    // Funzioni per ottenere i valori massimi
    function getMaxLevel() public pure returns (uint256) {
        return StatsLib.MAX_LEVEL;
    }

    function getMaxXP() public pure returns (uint256) {
        return StatsLib.MAX_XP;
    }

    function getMaxBreedingSlots() public pure returns (uint256) {
        return StatsLib.MAX_BREEDING_SLOTS;
    }

    // Funzioni di base
    function extractField(uint256 data, uint256 mask, uint256 position) public pure returns (uint256) {
        return StatsLib.extractField(data, mask, position);
    }

    function updateField(uint256 data, uint256 value, uint256 mask, uint256 position) public pure returns (uint256) {
        return StatsLib.updateField(data, value, mask, position);
    }

    function createInitialData() public pure returns (uint256) {
        return StatsLib.createInitialData();
    }

    // Funzioni per le statistiche
    function setLevel(uint256 data, uint256 level) public pure returns (uint256) {
        return StatsLib.setLevel(data, level);
    }

    function setXP(uint256 data, uint256 xp) public pure returns (uint256) {
        return StatsLib.setXP(data, xp);
    }

    function setBreedingSlots(uint256 data, uint256 slots) public pure returns (uint256) {
        return StatsLib.setBreedingSlots(data, slots);
    }

    function setProfession(uint256 data, uint256 profession) public pure returns (uint256) {
        return StatsLib.setProfession(data, StatsLib.Professions(profession));
    }

    function setProfessionLevel(uint256 data, uint256 level) public pure returns (uint256) {
        return StatsLib.setProfessionLevel(data, level);
    }

    function setProfessionExp(uint256 data, uint256 exp) public pure returns (uint256) {
        return StatsLib.setProfessionExp(data, exp);
    }

    // Funzioni getter
    function getLevel(uint256 data) public pure returns (uint256) {
        return StatsLib.getLevel(data);
    }

    function getXP(uint256 data) public pure returns (uint256) {
        return StatsLib.getXP(data);
    }

    function getBreedingSlots(uint256 data) public pure returns (uint256) {
        return StatsLib.getBreedingSlots(data);
    }

    function getProfession(uint256 data) public pure returns (uint256) {
        return uint256(StatsLib.getProfession(data));
    }

    function getProfessionLevel(uint256 data) public pure returns (uint256) {
        return StatsLib.getProfessionLevel(data);
    }

    function getProfessionExp(uint256 data) public pure returns (uint256) {
        return StatsLib.getProfessionExp(data);
    }

    // Funzioni per CURRENT_HEALTH
    function getCurrentHealth(uint256 data) public pure returns (uint256) {
        return StatsLib.getCurrentHealth(data);
    }

    function setCurrentHealth(uint256 data, uint256 newHealth) public pure returns (uint256) {
        return StatsLib.setCurrentHealth(data, newHealth);
    }

    function modifyCurrentHealth(uint256 data, uint256 delta, bool isAddition) public pure returns (uint256) {
        return StatsLib.modifyCurrentHealth(data, delta, isAddition);
    }

    function getDungeonStatus(uint256 data) public pure returns (uint256) {
        return StatsLib.getDungeonStatus(data);
    }

    function setDungeonStatus(uint256 data, uint256 status) public pure returns (uint256) {
        return StatsLib.setDungeonStatus(data, status);
    }

    function getAllStats(uint256 data) public pure returns (
        uint256 xp,
        uint256 level,
        uint256 breedingSlots,
        uint256 breedingCount,
        uint256 rarity,
        uint256 dungeonStatus
    ) {
        return StatsLib.getAllStats(data);
    }
} 