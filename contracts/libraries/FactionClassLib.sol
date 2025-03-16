// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FactionClassLib
/// @notice Libreria per la gestione delle fazioni e delle classi dei procioni
/// @dev Implementa un sistema di generazione e validazione per fazioni e classi
library FactionClassLib {
    // ========== Enums ==========
    /// @notice Enumerazione delle possibili fazioni
    enum Faction {
        NONE,
        GUARDIAN,
        SHADOW,
        MYSTIC,
        WILD
    }

    /// @notice Enumerazione delle possibili classi
    enum Class {
        NONE,
        WARRIOR,
        EXPLORER,
        MAGE,
        RANGER,
        TANK
    }

    // ========== Structs ==========
    /// @notice Struttura per gestire i dati delle fazioni e classi
    struct FactionClassData {
        // Limiti massimi di generazione per fazioni e classi
        uint256 maxFactionGen;
        uint256 maxClassGen;
        
        // Contatori per la generazione di fazioni e classi
        uint256 facGen;
        uint256 classGen;
        
        // Mapping per tracciare le fazioni e classi generate
        mapping(uint256 => uint256) factionCount;
        mapping(uint256 => uint256) classCount;
    }

    // ========== Events ==========
    /// @notice Evento emesso quando vengono aggiornati i limiti massimi
    event MaxGenLimitsUpdated(uint256 newMaxFactionGen, uint256 newMaxClassGen);

    // ========== Public Functions ==========
    /// @notice Imposta i limiti massimi di generazione per fazioni e classi
    /// @param data Struttura dei dati da aggiornare
    /// @param maxFactionGen Nuovo limite massimo per le fazioni
    /// @param maxClassGen Nuovo limite massimo per le classi
    function setMaxGenLimits(
        FactionClassData storage data,
        uint256 maxFactionGen,
        uint256 maxClassGen
    ) internal {
        require(maxFactionGen > 0 && maxClassGen > 0, "Limiti non validi");
        data.maxFactionGen = maxFactionGen;
        data.maxClassGen = maxClassGen;
        emit MaxGenLimitsUpdated(maxFactionGen, maxClassGen);
    }

    /// @notice Verifica se ci sono slot disponibili per la generazione
    /// @param data Struttura dei dati da verificare
    /// @return bool Indica se ci sono slot disponibili
    function hasAvailableSlots(FactionClassData storage data) internal view returns (bool) {
        return data.facGen < data.maxFactionGen && data.classGen < data.maxClassGen;
    }

    /// @notice Genera una fazione valida
    /// @param randomValue Numero random per la generazione
    /// @param attempt Numero del tentativo
    /// @param data Struttura dei dati per la validazione
    /// @return Faction Fazione generata
    function generateValidFaction(
        uint256 randomValue,
        uint256 attempt,
        FactionClassData storage data
    ) internal returns (Faction) {
        if (data.facGen >= data.maxFactionGen) {
            revert("Limite fazioni raggiunto");
        }
        
        bytes32 seed = keccak256(abi.encodePacked(randomValue, attempt, "faction"));
        uint256 maxPerFaction = data.maxFactionGen / 4;
        if (maxPerFaction == 0) maxPerFaction = 1;

        // Trova la fazione con il minor numero di generazioni
        uint256 minCount = type(uint256).max;
        uint256 minFaction = 0;
        for (uint256 i = 1; i <= 4; i++) {
            if (data.factionCount[i] < minCount) {
                minCount = data.factionCount[i];
                minFaction = i;
            }
        }

        // Se la fazione con il minor numero di generazioni ha raggiunto il limite,
        // usa il valore casuale
        if (minCount >= maxPerFaction) {
            uint256 factionValue = (uint256(seed) % 4) + 1;
            Faction faction = Faction(factionValue);
            if (data.factionCount[uint256(faction)] >= maxPerFaction) {
                revert("Distribuzione fazioni non bilanciata");
            }
            data.factionCount[uint256(faction)]++;
            data.facGen++;
            return faction;
        }

        // Altrimenti, usa la fazione con il minor numero di generazioni
        data.factionCount[minFaction]++;
        data.facGen++;
        return Faction(minFaction);
    }

    /// @notice Genera una classe valida
    /// @param randomValue Numero random per la generazione
    /// @param attempt Numero del tentativo
    /// @param data Struttura dei dati per la validazione
    /// @return Class Classe generata
    function generateValidClass(
        uint256 randomValue,
        uint256 attempt,
        FactionClassData storage data
    ) internal returns (Class) {
        if (data.classGen >= data.maxClassGen) {
            revert("Limite classi raggiunto");
        }
        
        bytes32 seed = keccak256(abi.encodePacked(randomValue, attempt, "class"));
        uint256 maxPerClass = data.maxClassGen / 5;
        if (maxPerClass == 0) maxPerClass = 1;

        // Trova la classe con il minor numero di generazioni
        uint256 minCount = type(uint256).max;
        uint256 minClass = 0;
        for (uint256 i = 1; i <= 5; i++) {
            if (data.classCount[i] < minCount) {
                minCount = data.classCount[i];
                minClass = i;
            }
        }

        // Se la classe con il minor numero di generazioni ha raggiunto il limite,
        // usa il valore casuale
        if (minCount >= maxPerClass) {
            uint256 classValue = (uint256(seed) % 5) + 1;
            Class class_ = Class(classValue);
            if (data.classCount[uint256(class_)] >= maxPerClass) {
                revert("Distribuzione classi non bilanciata");
            }
            data.classCount[uint256(class_)]++;
            data.classGen++;
            return class_;
        }

        // Altrimenti, usa la classe con il minor numero di generazioni
        data.classCount[minClass]++;
        data.classGen++;
        return Class(minClass);
    }

    /// @notice Ottiene le fazioni disponibili
    /// @param data Struttura dei dati da verificare
    /// @return uint256[5] Array con il conteggio delle fazioni disponibili
    function getAvailableFactions(FactionClassData storage data) internal view returns (uint256[5] memory) {
        uint256[5] memory available;
        for (uint256 i = 0; i < 5; i++) {
            available[i] = data.maxFactionGen / 4 - data.factionCount[i];
        }
        return available;
    }

    /// @notice Ottiene le classi disponibili
    /// @param data Struttura dei dati da verificare
    /// @return uint256[6] Array con il conteggio delle classi disponibili
    function getAvailableClasses(FactionClassData storage data) internal view returns (uint256[6] memory) {
        uint256[6] memory available;
        for (uint256 i = 0; i < 6; i++) {
            available[i] = data.maxClassGen / 5 - data.classCount[i];
        }
        return available;
    }

    /// @notice Ottiene i limiti massimi di generazione
    /// @param data Struttura dei dati da verificare
    /// @return maxFactionGen Limite massimo per le fazioni
    /// @return maxClassGen Limite massimo per le classi
    function getMaxGenLimits(FactionClassData storage data) internal view returns (uint256 maxFactionGen, uint256 maxClassGen) {
        return (data.maxFactionGen, data.maxClassGen);
    }
} 