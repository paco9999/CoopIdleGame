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
    
    // Evento per mutation
    event MutationApplied(uint256 genetics);
    event FenotipoGenerated(uint256[5] fenotipo);

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
        emit AlleleGenerated(allele);
        return allele;
    }

    function setField(
        uint256 data,
        uint256 value,
        uint256 mask,
        uint256 position
    ) public pure returns (uint256) {
        return GeneticsLib.setField(data, value, mask, position);
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
    
    // Nuove funzioni per testare il fenotipo e la mutazione
    function determineFenotipo(uint256 genetics) public returns (uint256[5] memory) {
        uint256[5] memory fenotipo = GeneticsLib.determineFenotipo(genetics);
        emit FenotipoGenerated(fenotipo);
        return fenotipo;
    }
    
    function applyMutation(uint256 genetics, uint256 randomValue) public returns (uint256) {
        uint256 mutatedGenetics = GeneticsLib.applyMutation(genetics, randomValue);
        emit MutationApplied(mutatedGenetics);
        return mutatedGenetics;
    }
    
    // Funzione helper per creare una genetica di test controllata
    function createTestGenetics(
        uint256 head1, uint256 head2,
        uint256 fur1, uint256 fur2,
        uint256 star1, uint256 star2,
        uint256 weapon1, uint256 weapon2,
        uint256 acc1, uint256 acc2
    ) public pure returns (uint256) {
        uint256 genetics = 0;
        
        genetics = GeneticsLib.updateField(genetics, head1, GeneticsLib.ALLELE_MASK, GeneticsLib.HEAD_MOTHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, head2, GeneticsLib.ALLELE_MASK, GeneticsLib.HEAD_FATHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, fur1, GeneticsLib.ALLELE_MASK, GeneticsLib.FUR_MOTHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, fur2, GeneticsLib.ALLELE_MASK, GeneticsLib.FUR_FATHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, star1, GeneticsLib.ALLELE_MASK, GeneticsLib.STAR_MOTHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, star2, GeneticsLib.ALLELE_MASK, GeneticsLib.STAR_FATHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, weapon1, GeneticsLib.ALLELE_MASK, GeneticsLib.WEAPON_MOTHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, weapon2, GeneticsLib.ALLELE_MASK, GeneticsLib.WEAPON_FATHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, acc1, GeneticsLib.ALLELE_MASK, GeneticsLib.ACC_MOTHER_POSITION);
        genetics = GeneticsLib.updateField(genetics, acc2, GeneticsLib.ALLELE_MASK, GeneticsLib.ACC_FATHER_POSITION);
        
        return genetics;
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

    // Funzioni di test per la manipolazione dei tratti
    function extractTraitType(uint256 allele) public pure returns (uint256) {
        return (allele >> 4) & GeneticsLib.TRAIT_TYPE_MASK;
    }

    function extractTraitId(uint256 allele) public pure returns (uint256) {
        return allele & GeneticsLib.TRAIT_ID_MASK;
    }
} 