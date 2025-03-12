// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/StatsLib.sol";

/// @title StatsLibTest
/// @notice Contratto di test per esporre le funzioni della libreria StatsLib
contract StatsLibTest {
    using StatsLib for uint256;

    uint256 private stats;

    // Maschere
    uint256 public constant MASK_LEVEL = 0xFF;
    uint256 public constant MASK_XP = 0xFFFF << 8;
    uint256 public constant MASK_BREEDING_SLOTS = 0xFF << 24;
    uint256 public constant MASK_BREEDING_COOLDOWN = 0xFFFFFFFF << 32;
    uint256 public constant MASK_BREEDING_COUNT = 0xFFFF << 64;
    uint256 public constant MASK_BREEDING_PARTNER = 0xFFFFFFFF << 80;
    uint256 public constant MASK_BREEDING_TIMESTAMP = 0xFFFFFFFF << 112;
    uint256 public constant MASK_FACTION = 0xFF << 144;
    uint256 public constant MASK_CLASS = 0xFF << 152;
    uint256 public constant MASK_RARITY = 0xFF << 160;
    uint256 public constant MASK_GENERATION = 0xFF << 168;
    uint256 public constant MASK_GENDER = 0x1 << 176;

    // Posizioni
    uint256 public constant POS_LEVEL = 0;
    uint256 public constant POS_XP = 8;
    uint256 public constant POS_BREEDING_SLOTS = 24;
    uint256 public constant POS_BREEDING_COOLDOWN = 32;
    uint256 public constant POS_BREEDING_COUNT = 64;
    uint256 public constant POS_BREEDING_PARTNER = 80;
    uint256 public constant POS_BREEDING_TIMESTAMP = 112;
    uint256 public constant POS_FACTION = 144;
    uint256 public constant POS_CLASS = 152;
    uint256 public constant POS_RARITY = 160;
    uint256 public constant POS_GENERATION = 168;
    uint256 public constant POS_GENDER = 176;

    // Limiti
    uint256 public constant MAX_LEVEL = 100;
    uint256 public constant MAX_XP = 65535;
    uint256 public constant MAX_BREEDING_SLOTS = 10;
    uint256 public constant MAX_BREEDING_COUNT = 10;
    uint256 public constant MAX_FACTION = 4;
    uint256 public constant MAX_CLASS = 4;
    uint256 public constant MAX_RARITY = 4;
    uint256 public constant MAX_GENERATION = 100;

    function extractField(uint256 data, uint256 mask, uint256 position) public pure returns (uint256) {
        return StatsLib.extractField(data, mask, position);
    }

    function updateField(uint256 data, uint256 value, uint256 mask, uint256 position) public pure returns (uint256) {
        return StatsLib.updateField(data, value, mask, position);
    }

    function setLevel(uint256 level) public {
        stats = StatsLib.setLevel(stats, level);
    }

    function setXP(uint256 xp) public {
        stats = StatsLib.setXP(stats, xp);
    }

    function setBreedingSlots(uint256 slots) public {
        stats = StatsLib.setBreedingSlots(stats, slots);
    }

    function setBreedingCount(uint256 count) public {
        stats = StatsLib.setBreedingCount(stats, count);
    }

    function setRarity(uint256 rarity) public {
        stats = StatsLib.setRarity(stats, rarity);
    }

    function getLevel() public view returns (uint256) {
        return StatsLib.getLevel(stats);
    }

    function getXP() public view returns (uint256) {
        return StatsLib.getXP(stats);
    }

    function getBreedingSlots() public view returns (uint256) {
        return StatsLib.getBreedingSlots(stats);
    }

    function getBreedingCount() public view returns (uint256) {
        return StatsLib.getBreedingCount(stats);
    }

    function getRarity() public view returns (uint256) {
        return StatsLib.getRarity(stats);
    }

    function getAllStats() public view returns (
        uint256 xp,
        uint256 level,
        uint256 breedingSlots,
        uint256 breedingCount,
        uint256 rarity
    ) {
        return StatsLib.getAllStats(stats);
    }

    // Costanti
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

    // Posizioni
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

    function getMaxLevel() public pure returns (uint256) {
        return StatsLib.MAX_LEVEL;
    }

    function getMaxXP() public pure returns (uint256) {
        return StatsLib.MAX_XP;
    }

    function getMaxBreedingSlots() public pure returns (uint256) {
        return StatsLib.MAX_BREEDING_SLOTS;
    }

    function getMaxBreedingCount() public pure returns (uint256) {
        return StatsLib.MAX_BREEDING_COUNT;
    }

    function getMaxRarity() public pure returns (uint256) {
        return StatsLib.MAX_RARITY;
    }

    // Funzioni di manipolazione dei campi
    function setBreedingCooldown(uint256 data, uint256 value) external pure returns (uint256) {
        return StatsLib.updateField(data, value, MASK_BREEDING_COOLDOWN, POS_BREEDING_COOLDOWN);
    }

    function getBreedingCooldown(uint256 data) external pure returns (uint256) {
        return StatsLib.extractField(data, MASK_BREEDING_COOLDOWN, POS_BREEDING_COOLDOWN);
    }

    function setBreedingPartner(uint256 data, uint256 value) external pure returns (uint256) {
        return StatsLib.updateField(data, value, MASK_BREEDING_PARTNER, POS_BREEDING_PARTNER);
    }

    function getBreedingPartner(uint256 data) external pure returns (uint256) {
        return StatsLib.extractField(data, MASK_BREEDING_PARTNER, POS_BREEDING_PARTNER);
    }

    function setBreedingTimestamp(uint256 data, uint256 value) external pure returns (uint256) {
        return StatsLib.updateField(data, value, MASK_BREEDING_TIMESTAMP, POS_BREEDING_TIMESTAMP);
    }

    function getBreedingTimestamp(uint256 data) external pure returns (uint256) {
        return StatsLib.extractField(data, MASK_BREEDING_TIMESTAMP, POS_BREEDING_TIMESTAMP);
    }

    function setFaction(uint256 data, uint256 value) external pure returns (uint256) {
        require(value <= MAX_FACTION, "Fazione non valida");
        return StatsLib.updateField(data, value, MASK_FACTION, POS_FACTION);
    }

    function getFaction(uint256 data) external pure returns (uint256) {
        return StatsLib.extractField(data, MASK_FACTION, POS_FACTION);
    }

    function setClass(uint256 data, uint256 value) external pure returns (uint256) {
        require(value <= MAX_CLASS, "Classe non valida");
        return StatsLib.updateField(data, value, MASK_CLASS, POS_CLASS);
    }

    function getClass(uint256 data) external pure returns (uint256) {
        return StatsLib.extractField(data, MASK_CLASS, POS_CLASS);
    }

    function setGeneration(uint256 data, uint256 value) external pure returns (uint256) {
        require(value <= MAX_GENERATION, "Generazione non valida");
        return StatsLib.updateField(data, value, MASK_GENERATION, POS_GENERATION);
    }

    function getGeneration(uint256 data) external pure returns (uint256) {
        return StatsLib.extractField(data, MASK_GENERATION, POS_GENERATION);
    }

    function setGender(uint256 data, bool value) external pure returns (uint256) {
        return StatsLib.updateField(data, value ? 1 : 0, MASK_GENDER, POS_GENDER);
    }

    function getGender(uint256 data) external pure returns (bool) {
        return StatsLib.extractField(data, MASK_GENDER, POS_GENDER) == 1;
    }
} 