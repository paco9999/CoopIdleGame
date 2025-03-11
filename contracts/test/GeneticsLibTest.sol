// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/GeneticsLib.sol";

/// @title GeneticsLibTest
/// @notice Contratto di test per GeneticsLib
/// @dev Espone tutte le funzionalità della libreria per i test
contract GeneticsLibTest {
    using GeneticsLib for GeneticsLib.TraitCounts;
    using GeneticsLib for GeneticsLib.TraitLimits;

    // Strutture dati per i test
    GeneticsLib.TraitCounts public counts;
    GeneticsLib.TraitLimits internal limits;

    constructor() {
        GeneticsLib.initializeTraitLimits(limits);
    }

    // Espone i valori degli enum per i test
    function TraitType_DOMINANT() public pure returns (uint256) { return uint256(GeneticsLib.TraitType.DOMINANT); }
    function TraitType_RECESSIVE() public pure returns (uint256) { return uint256(GeneticsLib.TraitType.RECESSIVE); }
    function TraitType_MINOR_RECESSIVE() public pure returns (uint256) { return uint256(GeneticsLib.TraitType.MINOR_RECESSIVE); }

    // Espone le costanti per i test
    function ALLELE_MASK() public pure returns (uint256) { return GeneticsLib.ALLELE_MASK; }
    function TRAIT_ID_MASK() public pure returns (uint256) { return GeneticsLib.TRAIT_ID_MASK; }
    function TRAIT_TYPE_MASK() public pure returns (uint256) { return GeneticsLib.TRAIT_TYPE_MASK; }

    function HEAD_MOTHER_POSITION() public pure returns (uint256) { return GeneticsLib.HEAD_MOTHER_POSITION; }
    function HEAD_FATHER_POSITION() public pure returns (uint256) { return GeneticsLib.HEAD_FATHER_POSITION; }
    function FUR_MOTHER_POSITION() public pure returns (uint256) { return GeneticsLib.FUR_MOTHER_POSITION; }
    function FUR_FATHER_POSITION() public pure returns (uint256) { return GeneticsLib.FUR_FATHER_POSITION; }
    function STAR_MOTHER_POSITION() public pure returns (uint256) { return GeneticsLib.STAR_MOTHER_POSITION; }
    function STAR_FATHER_POSITION() public pure returns (uint256) { return GeneticsLib.STAR_FATHER_POSITION; }
    function WEAPON_MOTHER_POSITION() public pure returns (uint256) { return GeneticsLib.WEAPON_MOTHER_POSITION; }
    function WEAPON_FATHER_POSITION() public pure returns (uint256) { return GeneticsLib.WEAPON_FATHER_POSITION; }
    function ACC_MOTHER_POSITION() public pure returns (uint256) { return GeneticsLib.ACC_MOTHER_POSITION; }
    function ACC_FATHER_POSITION() public pure returns (uint256) { return GeneticsLib.ACC_FATHER_POSITION; }

    function MAX_DOMINANT() public pure returns (uint256) { return GeneticsLib.MAX_DOMINANT; }
    function MAX_RECESSIVE() public pure returns (uint256) { return GeneticsLib.MAX_RECESSIVE; }
    function MAX_MINOR_RECESSIVE() public pure returns (uint256) { return GeneticsLib.MAX_MINOR_RECESSIVE; }

    // Eventi per i test
    event TraitTypeGenerated(uint256 traitType);
    event TraitIdGenerated(uint256 traitId);
    event AlleleGenerated(uint256 allele);

    // Espone le funzioni della libreria
    function generateValidTraitType(uint256 randomValue, uint256 attempt) public returns (uint256) {
        GeneticsLib.TraitType traitType = GeneticsLib.generateValidTraitType(randomValue, attempt, counts);
        if (traitType == GeneticsLib.TraitType.DOMINANT) counts.dominantCount++;
        if (traitType == GeneticsLib.TraitType.RECESSIVE) counts.recessiveCount++;
        if (traitType == GeneticsLib.TraitType.MINOR_RECESSIVE) counts.minorRecessiveCount++;
        uint256 result = uint256(traitType);
        emit TraitTypeGenerated(result);
        return result;
    }

    function generateValidTraitId(
        uint256 randomValue,
        uint256 attempt,
        uint256 partType
    ) public returns (uint256) {
        uint256 traitId = GeneticsLib.generateValidTraitId(randomValue, attempt, partType, counts, limits);
        emit TraitIdGenerated(traitId);
        return traitId;
    }

    function generateAllele(
        uint256 randomValue,
        uint256 attempt,
        uint256 partType
    ) public returns (uint256) {
        uint256 allele = GeneticsLib.generateAllele(randomValue, attempt, partType, counts, limits);
        uint256 traitType = (allele >> 4) & GeneticsLib.TRAIT_TYPE_MASK;
        if (traitType == uint256(GeneticsLib.TraitType.DOMINANT)) counts.dominantCount++;
        if (traitType == uint256(GeneticsLib.TraitType.RECESSIVE)) counts.recessiveCount++;
        if (traitType == uint256(GeneticsLib.TraitType.MINOR_RECESSIVE)) counts.minorRecessiveCount++;
        emit AlleleGenerated(allele);
        return allele;
    }

    function setField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) public pure returns (uint256) {
        // Verifica che il valore sia valido per la maschera
        require(value <= mask, "Valore troppo grande per la maschera");
        
        // Pulisci il campo esistente
        uint256 clearedData = data & ~(mask << position);
        
        // Inserisci il nuovo valore nella posizione corretta
        return clearedData | (value << position);
    }

    function extractField(
        uint256 data,
        uint256 mask,
        uint256 position
    ) public pure returns (uint256) {
        return GeneticsLib.extractField(data, mask, position);
    }

    function initializeTraitLimits() public {
        GeneticsLib.initializeTraitLimits(limits);
    }

    // Funzioni di utilità per i test
    function getDominantCount() public view returns (uint256) {
        return counts.dominantCount;
    }

    function getRecessiveCount() public view returns (uint256) {
        return counts.recessiveCount;
    }

    function getMinorRecessiveCount() public view returns (uint256) {
        return counts.minorRecessiveCount;
    }

    function getTraitCount(uint256 partType, uint256 traitId) public view returns (uint256) {
        if (partType == 0) return counts.headTraitCount[traitId];
        if (partType == 1) return counts.furTraitCount[traitId];
        if (partType == 2) return counts.starTraitCount[traitId];
        if (partType == 3) return counts.weapTraitCount[traitId];
        return counts.accTraitCount[traitId];
    }

    function getTraitLimit(uint256 partType, uint256 traitId) public view returns (uint256) {
        if (partType == 0) return limits.maxHeadRep[traitId];
        if (partType == 1) return limits.maxFurRep[traitId];
        if (partType == 2) return limits.maxStarRep[traitId];
        if (partType == 3) return limits.maxWeapRep[traitId];
        return limits.maxAccRep[traitId];
    }
} 