// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StatsLib
/// @notice Libreria per la gestione delle statistiche dei procioni
/// @dev Implementa un sistema di bit-packing per ottimizzare lo storage delle statistiche
library StatsLib {
    // ========== Constants ==========
    // Maschere per i campi delle statistiche (ogni campo usa 8 bit)
    uint256 constant XP_MASK = 0xFF;           // 0-7
    uint256 constant LEVEL_MASK = 0xFF;        // 8-15
    uint256 constant HEALTH_MASK = 0xFF;       // 16-23
    uint256 constant STRENGTH_MASK = 0xFF;     // 24-31
    uint256 constant SPEED_MASK = 0xFF;        // 32-39
    uint256 constant INTELLIGENCE_MASK = 0xFF; // 40-47
    uint256 constant ACCURACY_MASK = 0xFF;     // 48-55
    uint256 constant BREEDING_MASK = 0xFF;     // 56-63
    uint256 constant GENETICS_MASK = 0xFFFFFFFFFFFFFFFF; // 64-127
    uint256 constant CLASS_MASK = 0xFF;        // 128-135
    uint256 constant FACTION_MASK = 0xFF;      // 136-143

    // Posizioni dei campi nel valore a 256 bit
    uint256 constant XP_POSITION = 0;
    uint256 constant LEVEL_POSITION = 8;
    uint256 constant HEALTH_POSITION = 16;
    uint256 constant STRENGTH_POSITION = 24;
    uint256 constant SPEED_POSITION = 32;
    uint256 constant INTELLIGENCE_POSITION = 40;
    uint256 constant ACCURACY_POSITION = 48;
    uint256 constant BREEDING_POSITION = 56;
    uint256 constant GENETICS_POSITION = 64;
    uint256 constant CLASS_POSITION = 128;
    uint256 constant FACTION_POSITION = 136;

    // Valori iniziali delle statistiche
    uint256 constant INITIAL_XP = 0;
    uint256 constant INITIAL_LEVEL = 1;
    uint256 constant INITIAL_HEALTH = 100;
    uint256 constant INITIAL_STATS = 10;
    uint256 constant INITIAL_BREEDING = 0;

    // ========== Public Functions ==========
    /// @notice Crea i dati iniziali per un nuovo procione
    /// @return uint256 Dati iniziali impacchettati
    function createInitialData() internal pure returns (uint256) {
        uint256 data = 0;
        
        // Imposta i valori iniziali per ogni campo
        data = updateField(data, INITIAL_XP, XP_MASK, XP_POSITION);
        data = updateField(data, INITIAL_LEVEL, LEVEL_MASK, LEVEL_POSITION);
        data = updateField(data, INITIAL_HEALTH, HEALTH_MASK, HEALTH_POSITION);
        data = updateField(data, INITIAL_STATS, STRENGTH_MASK, STRENGTH_POSITION);
        data = updateField(data, INITIAL_STATS, SPEED_MASK, SPEED_POSITION);
        data = updateField(data, INITIAL_STATS, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
        data = updateField(data, INITIAL_STATS, ACCURACY_MASK, ACCURACY_POSITION);
        data = updateField(data, INITIAL_BREEDING, BREEDING_MASK, BREEDING_POSITION);
        
        return data;
    }

    /// @notice Estrae tutte le statistiche da un valore impacchettato
    /// @param data Dati impacchettati
    /// @return xp Punti esperienza
    /// @return level Livello
    /// @return health Salute
    /// @return strength Forza
    /// @return speed Velocità
    /// @return intelligence Intelligenza
    /// @return accuracy Precisione
    /// @return breeding Slots di breeding
    function extractStats(uint256 data) internal pure returns (
        uint256 xp,
        uint256 level,
        uint256 health,
        uint256 strength,
        uint256 speed,
        uint256 intelligence,
        uint256 accuracy,
        uint256 breeding
    ) {
        xp = extractField(data, XP_MASK, XP_POSITION);
        level = extractField(data, LEVEL_MASK, LEVEL_POSITION);
        health = extractField(data, HEALTH_MASK, HEALTH_POSITION);
        strength = extractField(data, STRENGTH_MASK, STRENGTH_POSITION);
        speed = extractField(data, SPEED_MASK, SPEED_POSITION);
        intelligence = extractField(data, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
        accuracy = extractField(data, ACCURACY_MASK, ACCURACY_POSITION);
        breeding = extractField(data, BREEDING_MASK, BREEDING_POSITION);
    }

    /// @notice Estrae un campo specifico da un valore impacchettato
    /// @param data Dati impacchettati
    /// @param mask Maschera per il campo
    /// @param position Posizione del campo
    /// @return uint256 Valore estratto
    function extractField(
        uint256 data,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        return (data >> position) & mask;
    }

    /// @notice Aggiorna un campo specifico in un valore impacchettato
    /// @param data Dati originali
    /// @param value Nuovo valore
    /// @param mask Maschera per il campo
    /// @param position Posizione del campo
    /// @return uint256 Dati aggiornati
    function updateField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        return (data & ~(mask << position)) | ((value & mask) << position);
    }
} 