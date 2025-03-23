// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GameConstants
/// @notice Libreria centralizzata di costanti per il sistema Procione
/// @dev Contiene tutte le costanti condivise tra le diverse librerie del sistema
library GameConstants {
    // ========== Maschere ==========
    uint256 constant XP_MASK = 0x1FFFF;
    uint256 constant LEVEL_MASK = 0xFF;
    uint256 constant HEALTH_MASK = 0xFF;
    uint256 constant STRENGTH_MASK = 0xFF;
    uint256 constant SPEED_MASK = 0xFF;
    uint256 constant INTELLIGENCE_MASK = 0xFF;
    uint256 constant ACCURACY_MASK = 0xFF;
    uint256 constant CURRENT_HEALTH_MASK = 0xFF;
    uint256 constant BREEDING_MASK = 0xFF;
    uint256 constant GENETICS_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint256 constant CLASS_MASK = 0xFF;
    uint256 constant FACTION_MASK = 0xFF;
    uint256 constant PROFESSION_MASK = 0xF;
    uint256 constant PROFESSIONLVL_MASK = 0x1F;
    uint256 constant PROFESSIONEXP_MASK = 0xFFFF;
    uint256 constant DUNGEON_STATUS_MASK = 0x1;

    // ========== Posizioni ==========
    uint8 constant XP_POSITION = 0;
    uint8 constant LEVEL_POSITION = 17;
    uint8 constant HEALTH_POSITION = 25;
    uint8 constant STRENGTH_POSITION = 33;
    uint8 constant SPEED_POSITION = 41;
    uint8 constant INTELLIGENCE_POSITION = 49;
    uint8 constant ACCURACY_POSITION = 57;
    uint8 constant CURRENT_HEALTH_POSITION = 65;
    uint8 constant BREEDING_POSITION = 80;
    uint8 constant GENETICS_POSITION = 64;
    uint8 constant CLASS_POSITION = 128;
    uint8 constant FACTION_POSITION = 136;
    uint8 constant PROFESSION_POSITION = 144;
    uint8 constant PROFESSIONLVL_POSITION = 148;
    uint8 constant PROFESSIONEXP_POSITION = 153;
    uint8 constant DUNGEON_STATUS_POSITION = 169;

    // ========== Valori Iniziali ==========
    uint8 constant INITIAL_XP = 0;
    uint8 constant INITIAL_LEVEL = 1;
    uint8 constant INITIAL_HEALTH = 100;
    uint8 constant INITIAL_STATS = 5;
    uint8 constant INITIAL_BREEDING = 0;

    // ========== Limiti ==========
    uint8 constant MAX_LEVEL = 100;
    uint256 constant MAX_XP = 90000;
    uint8 constant MAX_BREEDING_SLOTS = 5;
    uint8 constant MAX_BREEDING_COUNT = 10;
    uint8 constant MAX_RARITY = 5;
} 