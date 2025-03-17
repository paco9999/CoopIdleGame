// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../libraries/TraitStatsLib.sol";
import "../libraries/StatsLib.sol";

/**
 * @title TraitStatsLibTest
 * @dev Contratto di test per la libreria TraitStatsLib, espone le funzioni della libreria per i test
 */
contract TraitStatsLibTest {
    using TraitStatsLib for TraitStatsLib.TraitStats;
    using StatsLib for uint256;

    // Struttura per esporre i modificatori di classe nei test
    struct ClassModifiers {
        int healthModPct;
        int strengthModPct;
        int speedModPct;
        int intelligenceModPct;
        int accuracyModPct;
    }

    // Istanza della libreria, permette di testare l'intero stato
    TraitStatsLib.TraitStats private _traitStats;
    
    // Inizializza la libreria con valori di test
    function initialize() external {
        _traitStats.initialize();
    }
    
    // Verifica se la libreria è stata inizializzata
    function isInitialized() external view returns (bool) {
        return _traitStats.initialized;
    }
    
    // Wrapper per la funzione di creazione dati iniziali con tratti
    function createInitialDataWithTraits(uint8 classe, uint256[5] calldata fenotipo) external view returns (uint256) {
        return _traitStats.createInitialDataWithTraits(classe, fenotipo);
    }
    
    // Wrapper per la funzione di aggiornamento statistiche nel level up
    function updateStatsOnLevelUp(uint256 data, uint256[5] calldata fenotipo, uint8 newLevel) external view returns (uint256) {
        return _traitStats.updateStatsOnLevelUp(data, fenotipo, newLevel);
    }
    
    // Wrapper per le funzioni di aggiornamento dei modificatori di classe
    function updateClassModifiers(
        uint8 classId,
        int healthModPct,
        int strengthModPct,
        int speedModPct,
        int intelligenceModPct,
        int accuracyModPct
    ) external {
        _traitStats.updateClassModifiers(
            classId,
            healthModPct,
            strengthModPct,
            speedModPct,
            intelligenceModPct,
            accuracyModPct
        );
    }
    
    // Wrapper per le funzioni di aggiornamento dei modificatori dei tratti fur
    function updateFurModifiers(
        uint8 traitId,
        uint8 healthBonus,
        uint8 strengthBonus,
        uint8 speedBonus,
        uint8 intelligenceBonus,
        uint8 accuracyBonus
    ) external {
        _traitStats.updateFurModifiers(
            traitId,
            healthBonus,
            strengthBonus,
            speedBonus,
            intelligenceBonus,
            accuracyBonus
        );
    }
    
    // Funzioni getter per i dati dei tratti
    function getFurTraitName(uint8 traitId) external view returns (string memory) {
        return _traitStats.furTraits[traitId].name;
    }
    
    function getHeadTraitName(uint8 traitId) external view returns (string memory) {
        return _traitStats.headTraits[traitId].name;
    }
    
    function getStarTraitName(uint8 traitId) external view returns (string memory) {
        return _traitStats.starTraits[traitId].name;
    }
    
    function getWeaponTraitName(uint8 traitId) external view returns (string memory) {
        return _traitStats.weaponTraits[traitId].name;
    }
    
    // Funzione per ottenere i modificatori di una classe
    function getClassModifiers(uint8 classId) external view returns (ClassModifiers memory) {
        TraitStatsLib.ClassTrait memory trait = _traitStats.classTraits[classId];
        return ClassModifiers({
            healthModPct: trait.healthModPct,
            strengthModPct: trait.strengthModPct,
            speedModPct: trait.speedModPct,
            intelligenceModPct: trait.intelligenceModPct,
            accuracyModPct: trait.accuracyModPct
        });
    }
    
    // Funzioni di utilità per manipolare i dati nei test
    function updateField(uint256 data, uint256 value, uint256 mask, uint8 position) external pure returns (uint256) {
        return StatsLib.updateField(data, value, mask, position);
    }
    
    function extractField(uint256 data, uint256 mask, uint8 position) external pure returns (uint256) {
        return StatsLib.extractField(data, mask, position);
    }
} 