// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GeneticsLib
/// @notice Libreria per la gestione della genetica dei procioni
/// @dev Implementa un sistema di genetica basato su alleli dominanti e recessivi
library GeneticsLib {
    // ========== Constants ==========
    // Maschere per i campi
    uint256 public constant ALLELE_MASK = 0x3F; // 6 bit per allele
    uint256 constant TRAIT_ID_MASK = (1 << 4) - 1;    // 4 bit per ID tratto
    uint256 constant TRAIT_TYPE_MASK = (1 << 2) - 1;  // 2 bit per tipo carattere

    // Posizioni degli alleli nella genetica
    uint256 constant HEAD_MOTHER_POSITION = 0;     // 0-5
    uint256 constant HEAD_FATHER_POSITION = 6;     // 6-11
    uint256 constant FUR_MOTHER_POSITION = 12;     // 12-17
    uint256 constant FUR_FATHER_POSITION = 18;     // 18-23
    uint256 constant STAR_MOTHER_POSITION = 24;    // 24-29
    uint256 constant STAR_FATHER_POSITION = 30;    // 30-35
    uint256 constant WEAPON_MOTHER_POSITION = 36;  // 36-41
    uint256 constant WEAPON_FATHER_POSITION = 42;  // 42-47
    uint256 constant ACC_MOTHER_POSITION = 48;     // 48-53
    uint256 constant ACC_FATHER_POSITION = 54;     // 54-59

    // Limiti per i tipi di caratteri
    uint256 constant MAX_DOMINANT = 4000;
    uint256 constant MAX_RECESSIVE = 1334;
    uint256 constant MAX_MINOR_RECESSIVE = 666;

    // ========== Enums ==========
    enum TraitType {
        DOMINANT,
        RECESSIVE,
        MINOR_RECESSIVE
    }

    // ========== Structs ==========
    struct TraitCounts {
        uint256 dominantCount;
        uint256 recessiveCount;
        uint256 minorRecessiveCount;
        mapping(uint256 => uint256) headTraitCount;
        mapping(uint256 => uint256) furTraitCount;
        mapping(uint256 => uint256) starTraitCount;
        mapping(uint256 => uint256) weapTraitCount;
        mapping(uint256 => uint256) accTraitCount;
    }

    struct TraitLimits {
        uint256[10] maxHeadRep;
        uint256[10] maxFurRep;
        uint256[10] maxStarRep;
        uint256[10] maxWeapRep;
        uint256[10] maxAccRep;
    }

    // ========== Public Functions ==========
    /// @notice Imposta un campo in un valore a 256 bit
    /// @param data Dati originali
    /// @param value Nuovo valore
    /// @param mask Maschera per il campo
    /// @param position Posizione del campo
    /// @return Dati aggiornati
    function setField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        // Verifica che il valore sia valido per la maschera
        require(value <= mask, "Valore troppo grande per la maschera");
        
        // Pulisci il campo esistente
        uint256 clearedData = data & ~(mask << position);
        
        // Inserisci il nuovo valore nella posizione corretta
        return clearedData | (value << position);
    }

    /// @notice Estrae un campo da un valore a 256 bit
    /// @param data Dati da cui estrarre
    /// @param mask Maschera per il campo
    /// @param position Posizione del campo
    /// @return Valore estratto
    function extractField(
        uint256 data,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
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

    /// @notice Genera un tipo di carattere valido
    /// @param randomValue Numero random verificato
    /// @param attempt Numero del tentativo
    /// @param counts Contatori dei tratti
    /// @return Tipo di carattere generato
    function generateValidTraitType(
        uint256 randomValue,
        uint256 attempt,
        TraitCounts storage counts
    ) internal returns (TraitType) {
        uint256 typeValue = uint256(keccak256(abi.encode(randomValue, attempt, "type"))) % 3;
        
        if (typeValue == 0 && counts.dominantCount < MAX_DOMINANT) {
            counts.dominantCount++;
            return TraitType.DOMINANT;
        } else if (typeValue == 1 && counts.recessiveCount < MAX_RECESSIVE) {
            counts.recessiveCount++;
            return TraitType.RECESSIVE;
        } else if (typeValue == 2 && counts.minorRecessiveCount < MAX_MINOR_RECESSIVE) {
            counts.minorRecessiveCount++;
            return TraitType.MINOR_RECESSIVE;
        }
        
        revert("Nessun tipo di carattere disponibile");
    }

    /// @notice Genera un ID tratto valido per una parte specifica
    /// @param randomValue Numero random per la generazione
    /// @param attempt Numero del tentativo
    /// @param partType Tipo di parte
    /// @param counts Contatori dei tratti
    /// @param limits Limiti dei tratti
    /// @return ID tratto generato
    function generateValidTraitId(
        uint256 randomValue,
        uint256 attempt,
        uint256 partType,
        TraitCounts storage counts,
        TraitLimits storage limits
    ) internal returns (uint256) {
        // Prova tutti i possibili ID dei tratti
        for (uint256 i = 0; i < 10; i++) {
            uint256 traitId = (uint256(keccak256(abi.encode(randomValue, attempt, i, "trait"))) + i) % 10;
            
            (uint256 currentCount, uint256 maxCount) = getTraitCounts(
                partType,
                traitId,
                counts,
                limits
            );
            
            if (currentCount < maxCount) {
                if (partType == 0) counts.headTraitCount[traitId]++;
                else if (partType == 1) counts.furTraitCount[traitId]++;
                else if (partType == 2) counts.starTraitCount[traitId]++;
                else if (partType == 3) counts.weapTraitCount[traitId]++;
                else counts.accTraitCount[traitId]++;
                
                return traitId;
            }
        }
        
        revert("Nessun ID tratto disponibile per questa parte");
    }

    /// @notice Genera un allele completo (tipo + ID)
    /// @param randomValue Numero random per la generazione
    /// @param attempt Numero del tentativo
    /// @param partType Tipo di parte
    /// @param counts Contatori dei tratti
    /// @param limits Limiti dei tratti
    /// @return Allele generato
    function generateAllele(
        uint256 randomValue,
        uint256 attempt,
        uint256 partType,
        TraitCounts storage counts,
        TraitLimits storage limits
    ) internal returns (uint256) {
        TraitType traitType = generateValidTraitType(randomValue, attempt, counts);
        uint256 traitId = generateValidTraitId(randomValue, attempt, partType, counts, limits);
        return (uint256(traitType) << 4) | traitId;
    }

    /// @notice Inizializza i limiti dei tratti
    /// @param limits Struttura dei limiti da inizializzare
    function initializeTraitLimits(TraitLimits storage limits) internal {
        // Inizializza i limiti per i tratti comuni (0-3)
        for(uint256 i = 0; i < 4; i++) {
            limits.maxHeadRep[i] = 700;
            limits.maxFurRep[i] = 700;
            limits.maxStarRep[i] = 700;
            limits.maxWeapRep[i] = 700;
            limits.maxAccRep[i] = 700;
        }
        
        // Inizializza i limiti per i tratti rari (4-6)
        for(uint256 i = 4; i < 7; i++) {
            limits.maxHeadRep[i] = 600;
            limits.maxFurRep[i] = 600;
            limits.maxStarRep[i] = 600;
            limits.maxWeapRep[i] = 600;
            limits.maxAccRep[i] = 600;
        }
        
        // Inizializza i limiti per i tratti epici (7-8)
        for(uint256 i = 7; i < 9; i++) {
            limits.maxHeadRep[i] = 500;
            limits.maxFurRep[i] = 500;
            limits.maxStarRep[i] = 500;
            limits.maxWeapRep[i] = 500;
            limits.maxAccRep[i] = 500;
        }
        
        // Inizializza i limiti per i tratti leggendari (9)
        limits.maxHeadRep[9] = 400;
        limits.maxFurRep[9] = 400;
        limits.maxStarRep[9] = 400;
        limits.maxWeapRep[9] = 400;
        limits.maxAccRep[9] = 400;
    }

    // ========== Internal Functions ==========
    /// @notice Ottiene i contatori per un tratto specifico
    /// @param partType Tipo di parte
    /// @param traitId ID del tratto
    /// @param counts Contatori dei tratti
    /// @param limits Limiti dei tratti
    /// @return currentCount Contatore attuale
    /// @return maxCount Limite massimo
    function getTraitCounts(
        uint256 partType,
        uint256 traitId,
        TraitCounts storage counts,
        TraitLimits storage limits
    ) internal view returns (uint256 currentCount, uint256 maxCount) {
        if (partType == 0) {
            currentCount = counts.headTraitCount[traitId];
            maxCount = limits.maxHeadRep[traitId];
        } else if (partType == 1) {
            currentCount = counts.furTraitCount[traitId];
            maxCount = limits.maxFurRep[traitId];
        } else if (partType == 2) {
            currentCount = counts.starTraitCount[traitId];
            maxCount = limits.maxStarRep[traitId];
        } else if (partType == 3) {
            currentCount = counts.weapTraitCount[traitId];
            maxCount = limits.maxWeapRep[traitId];
        } else {
            currentCount = counts.accTraitCount[traitId];
            maxCount = limits.maxAccRep[traitId];
        }
    }

    /// @notice Aggiorna i contatori per un tratto
    /// @param partType Tipo di parte
    /// @param traitId ID del tratto
    /// @param traitType Tipo di carattere
    /// @param counts Contatori dei tratti
    function updateTraitCounts(
        uint256 partType,
        uint256 traitId,
        TraitType traitType,
        TraitCounts storage counts
    ) internal {
        // Aggiorna i contatori per tipo di carattere
        if (traitType == TraitType.DOMINANT) {
            counts.dominantCount++;
        } else if (traitType == TraitType.RECESSIVE) {
            counts.recessiveCount++;
        } else {
            counts.minorRecessiveCount++;
        }
        
        // Aggiorna i contatori per parte
        if (partType == 0) {
            counts.headTraitCount[traitId]++;
        } else if (partType == 1) {
            counts.furTraitCount[traitId]++;
        } else if (partType == 2) {
            counts.starTraitCount[traitId]++;
        } else if (partType == 3) {
            counts.weapTraitCount[traitId]++;
        } else {
            counts.accTraitCount[traitId]++;
        }
    }

    // ========== Fenotipo Functions ==========
    // Struttura per i nomi dei tratti
    struct TraitNames {
        string[10] headNames;
        string[10] furNames;
        string[10] starNames;
        string[10] weaponNames;
        string[10] accessoryNames;
    }

    // Evento per la mutazione
    event MutationOccurred(uint256 partType, string position, uint256 newAllele);

    /// @notice Determina il fenotipo visibile di un procione dalla sua genetica
    /// @param genetics La genetica completa del procione
    /// @return fenotipo Array di 5 valori che rappresenta i tratti visibili per ogni parte
    function determineFenotipo(uint256 genetics) internal pure returns (uint256[5] memory fenotipo) {
        for (uint256 i = 0; i < 5; i++) {
            uint256 motherPos = i * 12;
            uint256 fatherPos = motherPos + 6;
            
            // Estrai gli alleli materno e paterno
            uint256 motherAllele = extractField(genetics, ALLELE_MASK, motherPos);
            uint256 fatherAllele = extractField(genetics, ALLELE_MASK, fatherPos);
            
            // Estrai tipi e ID dei tratti
            uint256 motherType = (motherAllele >> 4) & TRAIT_TYPE_MASK;
            uint256 fatherType = (fatherAllele >> 4) & TRAIT_TYPE_MASK;
            uint256 motherId = motherAllele & TRAIT_ID_MASK;
            uint256 fatherId = fatherAllele & TRAIT_ID_MASK;
            
            // Regole di dominanza:
            // 1. Se un allele è dominante e l'altro non lo è, il dominante viene espresso
            // 2. Se entrambi sono dominanti, scegliamo casualmente (basato su hash deterministico)
            // 3. Se nessuno è dominante, ma uno è recessivo e l'altro recessivo minore, il recessivo viene espresso
            // 4. Se entrambi sono dello stesso tipo, scegliamo casualmente
            
            if (motherType == uint256(TraitType.DOMINANT) && fatherType != uint256(TraitType.DOMINANT)) {
                fenotipo[i] = motherId;
            } else if (fatherType == uint256(TraitType.DOMINANT) && motherType != uint256(TraitType.DOMINANT)) {
                fenotipo[i] = fatherId;
            } else if (motherType == uint256(TraitType.RECESSIVE) && fatherType == uint256(TraitType.MINOR_RECESSIVE)) {
                fenotipo[i] = motherId;
            } else if (fatherType == uint256(TraitType.RECESSIVE) && motherType == uint256(TraitType.MINOR_RECESSIVE)) {
                fenotipo[i] = fatherId;
            } else {
                // Se sono dello stesso tipo o in altri casi, usiamo un hash deterministico 
                // basato sulle combinazioni degli alleli per determinare quale viene espresso
                uint256 seed = uint256(keccak256(abi.encodePacked(motherAllele, fatherAllele)));
                fenotipo[i] = seed % 2 == 0 ? motherId : fatherId;
            }
        }
        
        return fenotipo;
    }

    /// @notice Calcola se avviene una mutazione genetica durante il breeding
    /// @param genetics La genetica originale
    /// @param randomValue Un valore casuale
    /// @return La genetica potenzialmente mutata
    function applyMutation(uint256 genetics, uint256 randomValue) internal returns (uint256) {
        // Probabilità molto bassa di mutazione (es. 1% per ogni parte)
        uint256 mutationChance = 100; // 1 su 100
        
        for (uint256 i = 0; i < 5; i++) {
            // Usiamo segmenti diversi del randomValue per ogni parte
            uint256 partRandomValue = uint256(keccak256(abi.encodePacked(randomValue, i)));
            
            // Verifica se avviene una mutazione
            if (partRandomValue % mutationChance == 0) {
                uint256 motherPos = i * 12;
                uint256 fatherPos = motherPos + 6;
                
                // Decidi quale allele mutare (materno o paterno)
                bool mutateMother = partRandomValue % 2 == 0;
                uint256 position = mutateMother ? motherPos : fatherPos;
                
                // Genera un nuovo allele (simulato qui, nella pratica dovresti usare la funzione generateAllele)
                uint256 newAllele = (partRandomValue % 3) << 4 | (partRandomValue % 10);
                
                // Applica la mutazione
                genetics = updateField(genetics, newAllele, ALLELE_MASK, position);
                
                // Emetti un evento per la mutazione
                emit MutationOccurred(i, mutateMother ? "MOTHER" : "FATHER", newAllele);
            }
        }
        
        return genetics;
    }
} 