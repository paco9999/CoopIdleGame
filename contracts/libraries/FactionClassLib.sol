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
        ROGUE,
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
        require(data.facGen < data.maxFactionGen, "Limite fazioni raggiunto");
        
        uint256 factionValue = uint256(keccak256(abi.encode(randomValue, attempt, "faction"))) % 4 + 1;
        Faction faction = Faction(factionValue);
        
        if (data.factionCount[uint256(faction)] < data.maxFactionGen / 4) {
            data.factionCount[uint256(faction)]++;
            data.facGen++;
            return faction;
        }
        
        revert("Nessuna fazione disponibile");
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
        require(data.classGen < data.maxClassGen, "Limite classi raggiunto");
        
        uint256 classValue = uint256(keccak256(abi.encode(randomValue, attempt, "class"))) % 5 + 1;
        Class class = Class(classValue);
        
        if (data.classCount[uint256(class)] < data.maxClassGen / 5) {
            data.classCount[uint256(class)]++;
            data.classGen++;
            return class;
        }
        
        revert("Nessuna classe disponibile");
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