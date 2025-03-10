// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StatsLib
/// @notice Libreria per la gestione delle statistiche dei procioni
/// @dev Implementa funzioni per manipolare e leggere i dati dei procioni
library StatsLib {
    // Costanti per il bit-packing
    uint256 private constant XP_MASK = (1 << 20) - 1;
    uint256 private constant LEVEL_MASK = (1 << 7) - 1;
    uint256 private constant HEALTH_MASK = (1 << 10) - 1;
    uint256 private constant STAT_MASK = (1 << 7) - 1;
    uint256 private constant GENETICS_MASK = (1 << 60) - 1;
    uint256 private constant CLASS_MASK = (1 << 3) - 1;
    uint256 private constant FACTION_MASK = (1 << 3) - 1;
    uint256 private constant BREEDING_MASK = (1 << 3) - 1;

    // Posizioni dei bit per ogni attributo
    uint256 private constant XP_POSITION = 0;
    uint256 private constant LEVEL_POSITION = 20;
    uint256 private constant HEALTH_POSITION = 27;
    uint256 private constant STRENGTH_POSITION = 37;
    uint256 private constant SPEED_POSITION = 44;
    uint256 private constant INTELLIGENCE_POSITION = 51;
    uint256 private constant PRECISION_POSITION = 58;
    uint256 private constant GENETICS_POSITION = 65;
    uint256 private constant CLASS_POSITION = 125;
    uint256 private constant FACTION_POSITION = 128;
    uint256 private constant BREEDING_POSITION = 131;

    // Struttura per le statistiche
    struct Stats {
        uint256 xp;
        uint256 level;
        uint256 health;
        uint256 strength;
        uint256 speed;
        uint256 intelligence;
        uint256 precision;
        uint256 genetics;
        uint256 class;
        uint256 faction;
        uint256 breeding;
    }

    /// @notice Aggiorna un campo specifico nei dati
    /// @param data I dati correnti
    /// @param value Il nuovo valore
    /// @param mask La maschera per il campo
    /// @param position La posizione del campo
    /// @return Il nuovo valore dei dati
    function updateField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        return (data & ~(mask << position)) | ((value & mask) << position);
    }

    /// @notice Estrae un campo specifico dai dati
    /// @param data I dati da cui estrarre
    /// @param mask La maschera per il campo
    /// @param position La posizione del campo
    /// @return Il valore estratto
    function extractField(
        uint256 data,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        return (data >> position) & mask;
    }

    /// @notice Crea i dati iniziali per un nuovo procione
    /// @param genetics La genetica del procione
    /// @param class La classe del procione
    /// @param faction La fazione del procione
    /// @return I dati iniziali completi
    function createInitialData(
        uint256 genetics,
        uint256 class,
        uint256 faction
    ) internal pure returns (uint256 data) {
        data = updateField(data, 0, XP_MASK, XP_POSITION);
        data = updateField(data, 1, LEVEL_MASK, LEVEL_POSITION);
        data = updateField(data, 100, HEALTH_MASK, HEALTH_POSITION);
        data = updateField(data, 10, STAT_MASK, STRENGTH_POSITION);
        data = updateField(data, 10, STAT_MASK, SPEED_POSITION);
        data = updateField(data, 10, STAT_MASK, INTELLIGENCE_POSITION);
        data = updateField(data, 10, STAT_MASK, PRECISION_POSITION);
        data = updateField(data, genetics, GENETICS_MASK, GENETICS_POSITION);
        data = updateField(data, class, CLASS_MASK, CLASS_POSITION);
        data = updateField(data, faction, FACTION_MASK, FACTION_POSITION);
        data = updateField(data, 0, BREEDING_MASK, BREEDING_POSITION);
    }

    /// @notice Estrae tutte le statistiche dai dati
    /// @param data I dati da cui estrarre le statistiche
    /// @return stats Le statistiche complete
    function extractStats(uint256 data) internal pure returns (Stats memory stats) {
        stats.xp = extractField(data, XP_MASK, XP_POSITION);
        stats.level = extractField(data, LEVEL_MASK, LEVEL_POSITION);
        stats.health = extractField(data, HEALTH_MASK, HEALTH_POSITION);
        stats.strength = extractField(data, STAT_MASK, STRENGTH_POSITION);
        stats.speed = extractField(data, STAT_MASK, SPEED_POSITION);
        stats.intelligence = extractField(data, STAT_MASK, INTELLIGENCE_POSITION);
        stats.precision = extractField(data, STAT_MASK, PRECISION_POSITION);
        stats.genetics = extractField(data, GENETICS_MASK, GENETICS_POSITION);
        stats.class = extractField(data, CLASS_MASK, CLASS_POSITION);
        stats.faction = extractField(data, FACTION_MASK, FACTION_POSITION);
        stats.breeding = extractField(data, BREEDING_MASK, BREEDING_POSITION);
    }
} 