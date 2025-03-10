// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library GeneticsLib {
    // Costanti per il bit-packing della genetica
    uint256 private constant ALLELE_MASK = (1 << 6) - 1;  // 6 bit per allele
    uint256 private constant TRAIT_ID_MASK = (1 << 4) - 1;  // 4 bit per ID tratto
    uint256 private constant TRAIT_TYPE_MASK = (1 << 2) - 1;  // 2 bit per tipo carattere

    // Posizioni dei bit per gli alleli all'interno della genetica
    uint256 private constant HEAD_MOTHER_POSITION = 0;    // 0-5
    uint256 private constant HEAD_FATHER_POSITION = 6;    // 6-11
    uint256 private constant FUR_MOTHER_POSITION = 12;    // 12-17
    uint256 private constant FUR_FATHER_POSITION = 18;    // 18-23
    uint256 private constant STAR_MOTHER_POSITION = 24;   // 24-29
    uint256 private constant STAR_FATHER_POSITION = 30;   // 30-35
    uint256 private constant WEAPON_MOTHER_POSITION = 36; // 36-41
    uint256 private constant WEAPON_FATHER_POSITION = 42; // 42-47
    uint256 private constant ACC_MOTHER_POSITION = 48;    // 48-53
    uint256 private constant ACC_FATHER_POSITION = 54;    // 54-59

    // Limiti per i tipi di caratteri
    uint256 public constant MAX_DOMINANT = 4000;
    uint256 public constant MAX_RECESSIVE = 1334;
    uint256 public constant MAX_MINOR_RECESSIVE = 666;

    // Enums per i tipi di caratteri
    enum TraitType { DOMINANT, RECESSIVE, MINOR_RECESSIVE }

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

    /**
     * @dev Genera un tipo di carattere valido
     */
    function generateValidTraitType(
        uint256 randomValue,
        uint256 attempt,
        TraitCounts storage counts
    ) internal view returns (TraitType) {
        uint256 typeValue = uint256(keccak256(abi.encode(randomValue, attempt, "type"))) % 3;
        TraitType traitType = TraitType(typeValue);
        
        if (traitType == TraitType.DOMINANT && counts.dominantCount < MAX_DOMINANT) {
            return TraitType.DOMINANT;
        } else if (traitType == TraitType.RECESSIVE && counts.recessiveCount < MAX_RECESSIVE) {
            return TraitType.RECESSIVE;
        } else if (traitType == TraitType.MINOR_RECESSIVE && counts.minorRecessiveCount < MAX_MINOR_RECESSIVE) {
            return TraitType.MINOR_RECESSIVE;
        }
        
        revert("Nessun tipo di carattere disponibile");
    }

    /**
     * @dev Genera un ID tratto valido per una parte specifica
     */
    function generateValidTraitId(
        uint256 randomValue,
        uint256 attempt,
        uint256 partType,
        TraitCounts storage counts,
        TraitLimits storage limits
    ) internal view returns (uint256) {
        uint256 traitId = uint256(keccak256(abi.encode(randomValue, attempt, "trait"))) % 10;
        
        uint256 currentCount;
        uint256 maxCount;
        
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
        
        if (currentCount < maxCount) {
            return traitId;
        }
        
        revert("Nessun ID tratto disponibile per questa parte");
    }

    /**
     * @dev Genera un allele completo (tipo + ID)
     */
    function generateAllele(
        uint256 randomValue,
        uint256 attempt,
        uint256 partType,
        TraitCounts storage counts,
        TraitLimits storage limits
    ) internal returns (uint256) {
        TraitType traitType = generateValidTraitType(randomValue, attempt, counts);
        uint256 traitId = generateValidTraitId(randomValue, attempt, partType, counts, limits);
        
        // Incrementa i contatori appropriati
        if (traitType == TraitType.DOMINANT) {
            counts.dominantCount++;
        } else if (traitType == TraitType.RECESSIVE) {
            counts.recessiveCount++;
        } else {
            counts.minorRecessiveCount++;
        }
        
        // Incrementa il contatore del tratto
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
        
        // Combina tipo e ID in un allele
        return (uint256(traitType) << 4) | traitId;
    }

    /**
     * @dev Imposta un campo in un valore a 256 bit
     */
    function setField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        return (data & ~(mask << position)) | ((value & mask) << position);
    }

    /**
     * @dev Estrae un campo da un valore a 256 bit
     */
    function extractField(
        uint256 data,
        uint256 mask,
        uint256 position
    ) internal pure returns (uint256) {
        return (data >> position) & mask;
    }

    /**
     * @dev Inizializza i limiti dei tratti
     */
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
} 