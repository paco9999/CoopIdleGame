// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/TraitStatsLib.sol";
import "../libraries/GeneticsLib.sol";
import "../libraries/GameConstants.sol";
import "../libraries/StatsLib.sol";

/**
 * @title MockTraitStatsProcessor
 * @dev Contract di mock per l'elaborazione dei tratti e delle statistiche dei procioni
 * Utilizza le librerie TraitStatsLib, GameConstants e GeneticsLib
 */
contract MockTraitStatsProcessor {
    using TraitStatsLib for TraitStatsLib.TraitStats;
    using GameConstants for uint256;
    using GeneticsLib for uint256;

    TraitStatsLib.TraitStats private traitStats;
    GeneticsLib.TraitLimits private traitLimits;
    GeneticsLib.TraitCounts private traitCounts;
    
    constructor() {
        traitStats.initialize();
        GeneticsLib.initializeTraitLimits(traitLimits);
    }
    
    /**
     * @dev Genera una genetica casuale per un procione
     * @param seed Un valore casuale per la generazione
     * @return La genetica generata
     */
    function generateRandomGenetics(uint256 seed) public returns (uint256) {
        uint256 genetics = 0;
        
        // Genera alleli per tutte le parti (testa, pelliccia, stellare, arma, accessorio)
        for (uint256 partType = 0; partType < 5; partType++) {
            uint256 motherAllele = GeneticsLib.generateAllele(
                seed + partType, 
                0, 
                partType, 
                traitCounts, 
                traitLimits
            );
            
            uint256 fatherAllele = GeneticsLib.generateAllele(
                seed + partType + 5, 
                1, 
                partType, 
                traitCounts, 
                traitLimits
            );
            
            // Posizioni per gli alleli materni e paterni
            uint256 motherPos;
            uint256 fatherPos;
            
            if (partType == 0) {
                motherPos = GeneticsLib.HEAD_MOTHER_POSITION;
                fatherPos = GeneticsLib.HEAD_FATHER_POSITION;
            } else if (partType == 1) {
                motherPos = GeneticsLib.FUR_MOTHER_POSITION;
                fatherPos = GeneticsLib.FUR_FATHER_POSITION;
            } else if (partType == 2) {
                motherPos = GeneticsLib.STAR_MOTHER_POSITION;
                fatherPos = GeneticsLib.STAR_FATHER_POSITION;
            } else if (partType == 3) {
                motherPos = GeneticsLib.WEAPON_MOTHER_POSITION;
                fatherPos = GeneticsLib.WEAPON_FATHER_POSITION;
            } else {
                motherPos = GeneticsLib.ACC_MOTHER_POSITION;
                fatherPos = GeneticsLib.ACC_FATHER_POSITION;
            }
            
            genetics = GeneticsLib.updateField(
                genetics, 
                motherAllele, 
                GeneticsLib.ALLELE_MASK, 
                motherPos
            );
            
            genetics = GeneticsLib.updateField(
                genetics, 
                fatherAllele, 
                GeneticsLib.ALLELE_MASK, 
                fatherPos
            );
        }
        
        return genetics;
    }
    
    /**
     * @dev Determina il fenotipo visibile di un procione dalla sua genetica
     * @param genetics La genetica completa del procione
     * @return Il fenotipo visibile come array di 5 valori
     */
    function determineFenotipo(uint256 genetics) public returns (uint256[5] memory) {
        return GeneticsLib.determineFenotipo(genetics);
    }
    
    /**
     * @dev Crea i dati iniziali per un procione basati sui tratti
     * @param classe La classe del procione (1-8)
     * @param fenotipo I tratti visibili del procione
     * @return I dati del procione
     */
    function createInitialDataWithTraits(
        uint8 classe, 
        uint256[5] memory fenotipo
    ) public view returns (uint256) {
        return traitStats.createInitialDataWithTraits(classe, fenotipo);
    }
    
    /**
     * @dev Aggiorna le statistiche di un procione durante il level up
     * @param data I dati attuali del procione
     * @param fenotipo I tratti visibili del procione
     * @param newLevel Il nuovo livello del procione
     * @return I dati aggiornati del procione
     */
    function updateStatsOnLevelUp(
        uint256 data, 
        uint256[5] memory fenotipo, 
        uint8 newLevel
    ) public view returns (uint256) {
        return traitStats.updateStatsOnLevelUp(data, fenotipo, newLevel);
    }
    
    /**
     * @dev Calcola le statistiche per un procione di livello specifico
     * @param classe La classe del procione
     * @param fenotipo I tratti visibili del procione
     * @param level Il livello desiderato
     * @return health La salute calcolata
     * @return strength La forza calcolata
     * @return speed La velocità calcolata
     * @return intelligence L'intelligenza calcolata
     * @return accuracy La precisione calcolata
     */
    function calculateStats(
        uint8 classe, 
        uint256[5] memory fenotipo, 
        uint8 level
    ) public view returns (
        uint8 health,
        uint8 strength,
        uint8 speed,
        uint8 intelligence,
        uint8 accuracy
    ) {
        require(level > 0, "Il livello deve essere maggiore di zero");
        
        // Crea dati iniziali
        uint256 data = traitStats.createInitialDataWithTraits(classe, fenotipo);
        
        // Se il livello è maggiore di 1, aggiorna le statistiche per ogni livello
        if (level > 1) {
            for (uint8 i = 2; i <= level; i++) {
                data = traitStats.updateStatsOnLevelUp(data, fenotipo, i);
            }
        }
        
        // Estrai e restituisci le statistiche
        health = uint8(StatsLib.extractField(data, GameConstants.HEALTH_MASK, GameConstants.HEALTH_POSITION));
        strength = uint8(StatsLib.extractField(data, GameConstants.STRENGTH_MASK, GameConstants.STRENGTH_POSITION));
        speed = uint8(StatsLib.extractField(data, GameConstants.SPEED_MASK, GameConstants.SPEED_POSITION));
        intelligence = uint8(StatsLib.extractField(data, GameConstants.INTELLIGENCE_MASK, GameConstants.INTELLIGENCE_POSITION));
        accuracy = uint8(StatsLib.extractField(data, GameConstants.ACCURACY_MASK, GameConstants.ACCURACY_POSITION));
    }
    
    /**
     * @dev Calcola e restituisce le statistiche di un procione generato casualmente
     * @param seed Un valore casuale per la generazione
     * @param level Il livello desiderato
     * @param classe La classe desiderata (1-8)
     * @return fenotipo I tratti visibili generati
     * @return health La salute calcolata
     * @return strength La forza calcolata
     * @return speed La velocità calcolata
     * @return intelligence L'intelligenza calcolata
     * @return accuracy La precisione calcolata
     */
    function generateRandomProcione(
        uint256 seed, 
        uint8 level, 
        uint8 classe
    ) public returns (
        uint256[5] memory fenotipo,
        uint8 health, 
        uint8 strength, 
        uint8 speed, 
        uint8 intelligence, 
        uint8 accuracy
    ) {
        // Genera genetica casuale
        uint256 genetics = generateRandomGenetics(seed);
        
        // Determina il fenotipo
        fenotipo = determineFenotipo(genetics);
        
        // Calcola le statistiche
        (health, strength, speed, intelligence, accuracy) = calculateStats(classe, fenotipo, level);
        
        return (fenotipo, health, strength, speed, intelligence, accuracy);
    }
} 