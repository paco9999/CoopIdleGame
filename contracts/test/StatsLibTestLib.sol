// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title StatsLibTestLib
/// @notice Versione della libreria StatsLib per i test
/// @dev Implementa le stesse funzionalità ma con visibilità public
library StatsLibTestLib {
    // ========== Constants ==========
    uint256 public constant MAX_LEVEL = 100;
    uint256 public constant MAX_XP = 1000;
    uint256 public constant MAX_BREEDING_SLOTS = 5;
    uint256 public constant MAX_BREEDING_COUNT = 10;
    uint256 public constant MAX_RARITY = 5;

    // ========== Masks ==========
    uint256 private constant LEVEL_MASK = 0xFF;
    uint256 private constant XP_MASK = 0x3FF;
    uint256 private constant BREEDING_SLOTS_MASK = 0x7;
    uint256 private constant BREEDING_COUNT_MASK = 0xF;
    uint256 private constant RARITY_MASK = 0x7;

    // ========== Positions ==========
    uint256 private constant LEVEL_POSITION = 0;
    uint256 private constant XP_POSITION = 8;
    uint256 private constant BREEDING_SLOTS_POSITION = 18;
    uint256 private constant BREEDING_COUNT_POSITION = 21;
    uint256 private constant RARITY_POSITION = 25;

    // ========== Errors ==========
    error InvalidLevel();
    error InvalidXP();
    error InvalidBreedingSlots();
    error InvalidBreedingCount();
    error InvalidRarity();

    // ========== Events ==========
    event LevelUpdated(uint256 newLevel);
    event XPUpdated(uint256 newXP);
    event BreedingSlotsUpdated(uint256 newSlots);
    event BreedingCountUpdated(uint256 newCount);
    event RarityUpdated(uint256 newRarity);

    // ========== Public Functions ==========
    /// @notice Imposta il livello
    /// @param stats Valore corrente delle statistiche
    /// @param level Nuovo livello
    /// @return uint256 Nuovo valore delle statistiche
    function setLevel(uint256 stats, uint256 level) public returns (uint256) {
        if (level > MAX_LEVEL) revert InvalidLevel();
        stats = (stats & ~(LEVEL_MASK << LEVEL_POSITION)) | (level << LEVEL_POSITION);
        emit LevelUpdated(level);
        return stats;
    }

    /// @notice Imposta l'XP
    /// @param stats Valore corrente delle statistiche
    /// @param xp Nuovo valore XP
    /// @return uint256 Nuovo valore delle statistiche
    function setXP(uint256 stats, uint256 xp) public returns (uint256) {
        if (xp > MAX_XP) revert InvalidXP();
        stats = (stats & ~(XP_MASK << XP_POSITION)) | (xp << XP_POSITION);
        emit XPUpdated(xp);
        return stats;
    }

    /// @notice Imposta gli slot di breeding
    /// @param stats Valore corrente delle statistiche
    /// @param slots Nuovo numero di slot
    /// @return uint256 Nuovo valore delle statistiche
    function setBreedingSlots(uint256 stats, uint256 slots) public returns (uint256) {
        if (slots > MAX_BREEDING_SLOTS) revert InvalidBreedingSlots();
        stats = (stats & ~(BREEDING_SLOTS_MASK << BREEDING_SLOTS_POSITION)) | (slots << BREEDING_SLOTS_POSITION);
        emit BreedingSlotsUpdated(slots);
        return stats;
    }

    /// @notice Imposta il conteggio dei breeding
    /// @param stats Valore corrente delle statistiche
    /// @param count Nuovo conteggio
    /// @return uint256 Nuovo valore delle statistiche
    function setBreedingCount(uint256 stats, uint256 count) public returns (uint256) {
        if (count > MAX_BREEDING_COUNT) revert InvalidBreedingCount();
        stats = (stats & ~(BREEDING_COUNT_MASK << BREEDING_COUNT_POSITION)) | (count << BREEDING_COUNT_POSITION);
        emit BreedingCountUpdated(count);
        return stats;
    }

    /// @notice Imposta la rarità
    /// @param stats Valore corrente delle statistiche
    /// @param rarity Nuovo valore di rarità
    /// @return uint256 Nuovo valore delle statistiche
    function setRarity(uint256 stats, uint256 rarity) public returns (uint256) {
        if (rarity > MAX_RARITY) revert InvalidRarity();
        stats = (stats & ~(RARITY_MASK << RARITY_POSITION)) | (rarity << RARITY_POSITION);
        emit RarityUpdated(rarity);
        return stats;
    }

    /// @notice Ottiene il livello
    /// @param stats Valore delle statistiche
    /// @return uint256 Livello corrente
    function getLevel(uint256 stats) public pure returns (uint256) {
        return (stats >> LEVEL_POSITION) & LEVEL_MASK;
    }

    /// @notice Ottiene l'XP
    /// @param stats Valore delle statistiche
    /// @return uint256 XP corrente
    function getXP(uint256 stats) public pure returns (uint256) {
        return (stats >> XP_POSITION) & XP_MASK;
    }

    /// @notice Ottiene gli slot di breeding
    /// @param stats Valore delle statistiche
    /// @return uint256 Numero di slot corrente
    function getBreedingSlots(uint256 stats) public pure returns (uint256) {
        return (stats >> BREEDING_SLOTS_POSITION) & BREEDING_SLOTS_MASK;
    }

    /// @notice Ottiene il conteggio dei breeding
    /// @param stats Valore delle statistiche
    /// @return uint256 Conteggio corrente
    function getBreedingCount(uint256 stats) public pure returns (uint256) {
        return (stats >> BREEDING_COUNT_POSITION) & BREEDING_COUNT_MASK;
    }

    /// @notice Ottiene la rarità
    /// @param stats Valore delle statistiche
    /// @return uint256 Rarità corrente
    function getRarity(uint256 stats) public pure returns (uint256) {
        return (stats >> RARITY_POSITION) & RARITY_MASK;
    }

    /// @notice Ottiene tutte le statistiche
    /// @param stats Valore delle statistiche
    /// @return level Livello corrente
    /// @return xp XP corrente
    /// @return breedingSlots Slot di breeding correnti
    /// @return breedingCount Conteggio breeding corrente
    /// @return rarity Rarità corrente
    function getAllStats(uint256 stats) public pure returns (
        uint256 level,
        uint256 xp,
        uint256 breedingSlots,
        uint256 breedingCount,
        uint256 rarity
    ) {
        return (
            getLevel(stats),
            getXP(stats),
            getBreedingSlots(stats),
            getBreedingCount(stats),
            getRarity(stats)
        );
    }
} 