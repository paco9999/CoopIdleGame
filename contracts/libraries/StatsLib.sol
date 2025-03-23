// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GameConstants.sol";

/// @title StatsLib
/// @notice Libreria per la gestione delle statistiche dei procioni
/// @dev Implementa un sistema di bit-packing per ottimizzare lo storage delle statistiche
library StatsLib {
    // ========== Enums ==========
    enum Professions {
        NONE,           // 0
        ARTISAN,        // 1
        MEDIC,          // 2
        THIEF,          // 3
        GATHERER,       // 4
        PALADIN        //  5
    }

    // ========== Utilizzo di costanti da GameConstants ==========
    using GameConstants for uint256;

    // ========== Public Functions ==========
    /// @notice Crea i dati iniziali per un nuovo procione
    /// @return uint256 Dati iniziali impacchettati
    function createInitialData() internal pure returns (uint256) {
        uint256 data = 0;
        
        // Imposta i valori iniziali per ogni campo
        data = updateField(data, GameConstants.INITIAL_XP, GameConstants.XP_MASK, GameConstants.XP_POSITION);
        data = updateField(data, GameConstants.INITIAL_LEVEL, GameConstants.LEVEL_MASK, GameConstants.LEVEL_POSITION);
        data = updateField(data, GameConstants.INITIAL_HEALTH, GameConstants.HEALTH_MASK, GameConstants.HEALTH_POSITION);
        data = updateField(data, GameConstants.INITIAL_HEALTH, GameConstants.CURRENT_HEALTH_MASK, GameConstants.CURRENT_HEALTH_POSITION);
        data = updateField(data, GameConstants.INITIAL_STATS, GameConstants.STRENGTH_MASK, GameConstants.STRENGTH_POSITION);
        data = updateField(data, GameConstants.INITIAL_STATS, GameConstants.SPEED_MASK, GameConstants.SPEED_POSITION);
        data = updateField(data, GameConstants.INITIAL_STATS, GameConstants.INTELLIGENCE_MASK, GameConstants.INTELLIGENCE_POSITION);
        data = updateField(data, GameConstants.INITIAL_STATS, GameConstants.ACCURACY_MASK, GameConstants.ACCURACY_POSITION);
        data = updateField(data, GameConstants.INITIAL_BREEDING, GameConstants.BREEDING_MASK, GameConstants.BREEDING_POSITION);
        data = updateField(data, 0, GameConstants.DUNGEON_STATUS_MASK, GameConstants.DUNGEON_STATUS_POSITION);
        
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
        xp = extractField(data, GameConstants.XP_MASK, GameConstants.XP_POSITION);
        level = extractField(data, GameConstants.LEVEL_MASK, GameConstants.LEVEL_POSITION);
        health = extractField(data, GameConstants.HEALTH_MASK, GameConstants.HEALTH_POSITION);
        strength = extractField(data, GameConstants.STRENGTH_MASK, GameConstants.STRENGTH_POSITION);
        speed = extractField(data, GameConstants.SPEED_MASK, GameConstants.SPEED_POSITION);
        intelligence = extractField(data, GameConstants.INTELLIGENCE_MASK, GameConstants.INTELLIGENCE_POSITION);
        accuracy = extractField(data, GameConstants.ACCURACY_MASK, GameConstants.ACCURACY_POSITION);
        breeding = extractField(data, GameConstants.BREEDING_MASK, GameConstants.BREEDING_POSITION);
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
        require(level <= GameConstants.MAX_LEVEL, "Level too high");
        return updateField(stats, level, GameConstants.LEVEL_MASK, GameConstants.LEVEL_POSITION);
    }

    function setXP(uint256 stats, uint256 xp) internal pure returns (uint256) {
        require(xp <= GameConstants.MAX_XP, "XP too high");
        return updateField(stats, xp, GameConstants.XP_MASK, GameConstants.XP_POSITION);
    }

    function setBreedingSlots(uint256 stats, uint256 slots) internal pure returns (uint256) {
        require(slots <= GameConstants.MAX_BREEDING_SLOTS, "Too many breeding slots");
        return updateField(stats, slots, GameConstants.BREEDING_MASK, GameConstants.BREEDING_POSITION);
    }

    function setBreedingCount(uint256 stats, uint256 count) internal pure returns (uint256) {
        require(count <= GameConstants.MAX_BREEDING_COUNT, "Breeding count too high");
        return updateField(stats, count, GameConstants.BREEDING_MASK, GameConstants.BREEDING_POSITION);
    }

    function setRarity(uint256 stats, uint256 rarity) internal pure returns (uint256) {
        require(rarity <= GameConstants.MAX_RARITY, "Rarity too high");
        return updateField(stats, rarity, GameConstants.GENETICS_MASK, GameConstants.GENETICS_POSITION);
    }

    function getLevel(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.LEVEL_MASK, GameConstants.LEVEL_POSITION);
    }

    function getXP(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.XP_MASK, GameConstants.XP_POSITION);
    }

    function getBreedingSlots(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.BREEDING_MASK, GameConstants.BREEDING_POSITION);
    }

    function getBreedingCount(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.BREEDING_MASK, GameConstants.BREEDING_POSITION);
    }

    function getRarity(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.GENETICS_MASK, GameConstants.GENETICS_POSITION);
    }

    /// @notice Ottiene lo stato del dungeon del procione
    /// @param stats I dati dell'NFT
    /// @return Lo stato del dungeon (0 = non in dungeon, 1 = in dungeon)
    function getDungeonStatus(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.DUNGEON_STATUS_MASK, GameConstants.DUNGEON_STATUS_POSITION);
    }

    /// @notice Imposta lo stato del dungeon del procione
    /// @param stats I dati dell'NFT
    /// @param status Il nuovo stato (0 = non in dungeon, 1 = in dungeon)
    /// @return I dati aggiornati
    function setDungeonStatus(uint256 stats, uint256 status) internal pure returns (uint256) {
        require(status <= 1, "Invalid dungeon status");
        return updateField(stats, status, GameConstants.DUNGEON_STATUS_MASK, GameConstants.DUNGEON_STATUS_POSITION);
    }

    /// @notice Ottiene tutte le statistiche incluso lo stato del dungeon
    /// @param stats I dati dell'NFT
    function getAllStats(uint256 stats) internal pure returns (
        uint256 xp,
        uint256 level,
        uint256 breedingSlots,
        uint256 breedingCount,
        uint256 rarity,
        uint256 dungeonStatus
    ) {
        xp = getXP(stats);
        level = getLevel(stats);
        breedingSlots = getBreedingSlots(stats);
        breedingCount = getBreedingCount(stats);
        rarity = getRarity(stats);
        dungeonStatus = getDungeonStatus(stats);
    }

    // Funzioni per le professioni
    function getProfession(uint256 stats) internal pure returns (Professions) {
        return Professions(extractField(stats, GameConstants.PROFESSION_MASK, GameConstants.PROFESSION_POSITION));
    }

    function getProfessionLevel(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.PROFESSIONLVL_MASK, GameConstants.PROFESSIONLVL_POSITION);
    }

    function getProfessionExp(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.PROFESSIONEXP_MASK, GameConstants.PROFESSIONEXP_POSITION);
    }

    function setProfession(uint256 stats, Professions profession) internal pure returns (uint256) {
        require(uint256(profession) <= 15, "Profession value too high");
        return updateField(stats, uint256(profession), GameConstants.PROFESSION_MASK, GameConstants.PROFESSION_POSITION);
    }

    function setProfessionLevel(uint256 stats, uint256 level) internal pure returns (uint256) {
        require(level <= 20, "Profession level too high");
        return updateField(stats, level, GameConstants.PROFESSIONLVL_MASK, GameConstants.PROFESSIONLVL_POSITION);
    }

    function setProfessionExp(uint256 stats, uint256 exp) internal pure returns (uint256) {
        require(exp <= 65535, "Profession exp too high");
        return updateField(stats, exp, GameConstants.PROFESSIONEXP_MASK, GameConstants.PROFESSIONEXP_POSITION);
    }

    /// @notice Ottiene il valore corrente della salute
    /// @param stats I dati dell'NFT
    /// @return Il valore corrente della salute
    function getCurrentHealth(uint256 stats) internal pure returns (uint256) {
        return extractField(stats, GameConstants.CURRENT_HEALTH_MASK, GameConstants.CURRENT_HEALTH_POSITION);
    }

    /// @notice Modifica il valore corrente della salute
    /// @param stats I dati dell'NFT
    /// @param newHealth Il nuovo valore della salute
    /// @return I dati aggiornati
    function setCurrentHealth(uint256 stats, uint256 newHealth) internal pure returns (uint256) {
        uint256 maxHealth = extractField(stats, GameConstants.HEALTH_MASK, GameConstants.HEALTH_POSITION);
        
        // Applica i limiti
        if (newHealth > maxHealth) {
            newHealth = maxHealth;
        }
        // Non serve controllare < 0 perché uint256 non può essere negativo
        
        return updateField(stats, newHealth, GameConstants.CURRENT_HEALTH_MASK, GameConstants.CURRENT_HEALTH_POSITION);
    }

    /// @notice Modifica il valore corrente della salute aggiungendo o sottraendo un valore
    /// @param stats I dati dell'NFT
    /// @param delta Il valore da aggiungere (positivo) o sottrarre (negativo)
    /// @param isAddition True se il delta va aggiunto, False se va sottratto
    /// @return I dati aggiornati
    function modifyCurrentHealth(uint256 stats, uint256 delta, bool isAddition) internal pure returns (uint256) {
        uint256 currentHealth = getCurrentHealth(stats);
        uint256 maxHealth = extractField(stats, GameConstants.HEALTH_MASK, GameConstants.HEALTH_POSITION);
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
        
        return updateField(stats, newHealth, GameConstants.CURRENT_HEALTH_MASK, GameConstants.CURRENT_HEALTH_POSITION);
    }
} 