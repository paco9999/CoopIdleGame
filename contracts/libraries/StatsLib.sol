// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StatsLib
/// @notice Libreria per la gestione delle statistiche dei procioni
/// @dev Implementa un sistema di bit-packing per ottimizzare lo storage delle statistiche
library StatsLib {
    // ========== Enums ==========
    enum Professions {
        NONE,           // 0
        ARTISAN,        // 1
        MEDIC           // 2
    }

    // ========== Constants ==========
    // Maschere per i campi delle statistiche
    uint256 constant XP_MASK = 0x1FFFF;        // 0-16 (17 bit)
    uint256 constant LEVEL_MASK = 0xFF;        // 17-24
    uint256 constant HEALTH_MASK = 0xFF;       // 25-32
    uint256 constant STRENGTH_MASK = 0xFF;     // 33-40
    uint256 constant SPEED_MASK = 0xFF;        // 41-48
    uint256 constant INTELLIGENCE_MASK = 0xFF; // 49-56
    uint256 constant ACCURACY_MASK = 0xFF;     // 57-64
    uint256 constant CURRENT_HEALTH_MASK = 0xFF; // 65-72
    uint256 constant BREEDING_MASK = 0xFF;     // 80-87
    uint256 public constant GENETICS_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint256 constant CLASS_MASK = 0xFF;        // 128-135
    uint256 constant FACTION_MASK = 0xFF;      // 136-143
    uint256 constant PROFESSION_MASK = 0xF;    // 144-147 (4 bit)
    uint256 constant PROFESSIONLVL_MASK = 0xF; // 148-151 (4 bit)
    uint256 constant PROFESSIONEXP_MASK = 0xFFFF; // 152-167 (16 bit)

    // Posizioni dei campi nel valore a 256 bit
    uint256 constant XP_POSITION = 0;
    uint256 constant LEVEL_POSITION = 17;
    uint256 constant HEALTH_POSITION = 25;
    uint256 constant STRENGTH_POSITION = 33;
    uint256 constant SPEED_POSITION = 41;
    uint256 constant INTELLIGENCE_POSITION = 49;
    uint256 constant ACCURACY_POSITION = 57;
    uint256 constant CURRENT_HEALTH_POSITION = 65;
    uint256 constant BREEDING_POSITION = 80;
    uint256 public constant GENETICS_POSITION = 64;
    uint256 constant CLASS_POSITION = 128;
    uint256 constant FACTION_POSITION = 136;
    uint256 constant PROFESSION_POSITION = 144;
    uint256 constant PROFESSIONLVL_POSITION = 148;
    uint256 constant PROFESSIONEXP_POSITION = 152;

    // Valori iniziali delle statistiche
    uint256 constant INITIAL_XP = 0;
    uint256 constant INITIAL_LEVEL = 1;
    uint256 constant INITIAL_HEALTH = 100;
    uint256 constant INITIAL_STATS = 10;
    uint256 constant INITIAL_BREEDING = 0;

    // Costanti per i limiti
    uint256 public constant MAX_LEVEL = 100;
    uint256 public constant MAX_XP = 90000;
    uint256 public constant MAX_BREEDING_SLOTS = 5;
    uint256 public constant MAX_BREEDING_COUNT = 10;
    uint256 public constant MAX_RARITY = 5;

    // ========== Public Functions ==========
    /// @notice Crea i dati iniziali per un nuovo procione
    /// @return uint256 Dati iniziali impacchettati
    function createInitialData() internal pure returns (uint256) {
        uint256 data = 0;
        
        // Imposta i valori iniziali per ogni campo
        data = updateField(data, INITIAL_XP, XP_MASK, XP_POSITION);
        data = updateField(data, INITIAL_LEVEL, LEVEL_MASK, LEVEL_POSITION);
        data = updateField(data, INITIAL_HEALTH, HEALTH_MASK, HEALTH_POSITION);
        data = updateField(data, INITIAL_HEALTH, CURRENT_HEALTH_MASK, CURRENT_HEALTH_POSITION); // Inizializza CURRENT_HEALTH allo stesso valore di HEALTH
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

    /// @notice Estrae un campo dai dati usando una maschera e una posizione
    /// @param data I dati da cui estrarre il campo
    /// @param mask La maschera da applicare
    /// @param position La posizione del campo
    /// @return Il valore del campo estratto
    function extractField(uint256 data, uint256 mask, uint256 position) internal pure returns (uint256) {
        return (data >> position) & mask;
    }

    /// @notice Aggiorna un campo nei dati usando una maschera e una posizione
    /// @param data I dati da aggiornare
    /// @param value Il nuovo valore del campo
    /// @param mask La maschera da applicare
    /// @param position La posizione del campo
    /// @return I dati aggiornati
    function updateField(uint256 data, uint256 value, uint256 mask, uint256 position) internal pure returns (uint256) {
        uint256 clearedData = data & ~(mask << position);
        return clearedData | ((value & mask) << position);
    }

    function setLevel(uint256 stats, uint256 level) internal pure returns (uint256) {
        require(level <= MAX_LEVEL, "Level too high");
        return updateField(stats, level, LEVEL_MASK, LEVEL_POSITION);
    }

    function setXP(uint256 stats, uint256 xp) internal pure returns (uint256) {
        require(xp <= MAX_XP, "XP too high");
        return updateField(stats, xp, XP_MASK, XP_POSITION);
    }

    function setBreedingSlots(uint256 stats, uint256 slots) internal pure returns (uint256) {
        require(slots <= MAX_BREEDING_SLOTS, "Too many breeding slots");
        return updateField(stats, slots, BREEDING_MASK, BREEDING_POSITION);
    }

    function setBreedingCount(uint256 stats, uint256 count) internal pure returns (uint256) {
        require(count <= MAX_BREEDING_COUNT, "Breeding count too high");
        return updateField(stats, count, BREEDING_MASK, BREEDING_POSITION);
    }

    function setRarity(uint256 stats, uint256 rarity) internal pure returns (uint256) {
        require(rarity <= MAX_RARITY, "Rarity too high");
        return updateField(stats, rarity, GENETICS_MASK, GENETICS_POSITION);
    }

    function getLevel(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, LEVEL_MASK, LEVEL_POSITION);
    }

    function getXP(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, XP_MASK, XP_POSITION);
    }

    function getBreedingSlots(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, BREEDING_MASK, BREEDING_POSITION);
    }

    function getBreedingCount(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, BREEDING_MASK, BREEDING_POSITION);
    }

    function getRarity(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GENETICS_MASK, GENETICS_POSITION);
    }

    function getAllStats(uint256 stats) internal pure returns (
        uint256 xp,
        uint256 level,
        uint256 breedingSlots,
        uint256 breedingCount,
        uint256 rarity
    ) {
        xp = getXP(stats);
        level = getLevel(stats);
        breedingSlots = getBreedingSlots(stats);
        breedingCount = getBreedingCount(stats);
        rarity = getRarity(stats);
    }

    // Funzioni per le professioni
    function getProfession(uint256 stats) internal pure returns (Professions) {
        return Professions(extractField(stats, PROFESSION_MASK, PROFESSION_POSITION));
    }

    function getProfessionLevel(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, PROFESSIONLVL_MASK, PROFESSIONLVL_POSITION);
    }

    function getProfessionExp(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, PROFESSIONEXP_MASK, PROFESSIONEXP_POSITION);
    }

    function setProfession(uint256 stats, Professions profession) internal pure returns (uint256) {
        require(uint256(profession) <= 15, "Profession value too high");
        return updateField(stats, uint256(profession), PROFESSION_MASK, PROFESSION_POSITION);
    }

    function setProfessionLevel(uint256 stats, uint256 level) internal pure returns (uint256) {
        require(level <= 15, "Profession level too high");
        return updateField(stats, level, PROFESSIONLVL_MASK, PROFESSIONLVL_POSITION);
    }

    function setProfessionExp(uint256 stats, uint256 exp) internal pure returns (uint256) {
        require(exp <= 65535, "Profession exp too high");
        return updateField(stats, exp, PROFESSIONEXP_MASK, PROFESSIONEXP_POSITION);
    }

    /// @notice Ottiene il valore corrente della salute
    /// @param stats I dati dell'NFT
    /// @return Il valore corrente della salute
    function getCurrentHealth(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, CURRENT_HEALTH_MASK, CURRENT_HEALTH_POSITION);
    }

    /// @notice Modifica il valore corrente della salute
    /// @param stats I dati dell'NFT
    /// @param newHealth Il nuovo valore della salute
    /// @return I dati aggiornati
    function setCurrentHealth(uint256 stats, uint256 newHealth) internal pure returns (uint256) {
        uint256 maxHealth = extractField(stats, HEALTH_MASK, HEALTH_POSITION);
        
        // Applica i limiti
        if (newHealth > maxHealth) {
            newHealth = maxHealth;
        }
        // Non serve controllare < 0 perché uint256 non può essere negativo
        
        return updateField(stats, newHealth, CURRENT_HEALTH_MASK, CURRENT_HEALTH_POSITION);
    }

    /// @notice Modifica il valore corrente della salute aggiungendo o sottraendo un valore
    /// @param stats I dati dell'NFT
    /// @param delta Il valore da aggiungere (positivo) o sottrarre (negativo)
    /// @param isAddition True se il delta va aggiunto, False se va sottratto
    /// @return I dati aggiornati
    function modifyCurrentHealth(uint256 stats, uint256 delta, bool isAddition) internal pure returns (uint256) {
        uint256 currentHealth = getCurrentHealth(stats);
        uint256 maxHealth = extractField(stats, HEALTH_MASK, HEALTH_POSITION);
        uint256 newHealth;
        
        if (isAddition) {
            unchecked {
                newHealth = currentHealth + delta;
                // Se c'è overflow o supera maxHealth, imposta a maxHealth
                if (newHealth < currentHealth || newHealth > maxHealth) {
                    newHealth = maxHealth;
                }
            }
        } else {
            // Sottrazione con controllo underflow
            if (delta >= currentHealth) {
                newHealth = 0;
            } else {
                newHealth = currentHealth - delta;
            }
        }
        
        return updateField(stats, newHealth, CURRENT_HEALTH_MASK, CURRENT_HEALTH_POSITION);
    }
} 