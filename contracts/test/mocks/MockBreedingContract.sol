// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/IIdleProcioneBreeding.sol";
import "../../interfaces/IIdleProcioneNFT.sol";
import "../../libraries/GeneticsLib.sol";

/// @title MockBreedingContract
/// @notice Contratto mock per i test del breeding
contract MockBreedingContract is IIdleProcioneBreeding {
    mapping(uint256 => uint256) private breedCounts;
    uint256 public constant BASE_COST = 100 ether;
    uint256 public constant GOV_COST = 10 ether;
    bool private canBreedValue = true;
    address public idleProcioneNFT;

    constructor(address _nftContract) {
        idleProcioneNFT = _nftContract;
    }

    /// @notice Imposta il numero di breeding per un token
    /// @param tokenId ID del token
    /// @param count Numero di breeding da impostare
    function setBreedCount(uint256 tokenId, uint256 count) external {
        breedCounts[tokenId] = count;
    }

    /// @notice Ottiene il numero di breeding effettuati per un token
    /// @param tokenId ID del token
    /// @return Numero di breeding effettuati
    function getBreedCount(uint256 tokenId) external view returns (uint256) {
        return breedCounts[tokenId];
    }

    /// @notice Verifica se un procione può effettuare breeding
    /// @param tokenId ID del token
    /// @return True se il procione può effettuare breeding
    function canBreed(uint256 tokenId) external view returns (bool) {
        return canBreedValue;
    }

    /// @notice Imposta se il breeding è possibile (solo per test)
    /// @param value True se il breeding deve essere possibile
    function setCanBreed(bool value) external {
        canBreedValue = value;
    }

    /// @notice Ottiene il costo di breeding per un procione
    /// @param tokenId ID del token
    /// @return baseCost Costo base in reward token
    /// @return govCost Costo in governance token
    function getBreedingCost(uint256 tokenId) external pure returns (uint256 baseCost, uint256 govCost) {
        return (BASE_COST, GOV_COST);
    }

    /// @notice Funzione mock per il breeding
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    function breed(uint256 parent1Id, uint256 parent2Id) external {
        // Incrementa il contatore di breeding per entrambi i genitori
        breedCounts[parent1Id]++;
        breedCounts[parent2Id]++;

        // Emette l'evento con valori mock
        emit BreedingInitiated(
            parent1Id,
            parent2Id,
            0, // eggId mock
            0, // genetics mock
            block.timestamp + 5 days // hatchTime mock
        );
    }

    /// @notice Combina la genetica dei genitori per l'uovo (mock)
    /// @param parent1Data Dati del primo genitore
    /// @param parent2Data Dati del secondo genitore
    /// @return La genetica combinata
    function combineParentGenetics(uint256 parent1Data, uint256 parent2Data) external pure returns (uint256) {
        // Implementazione mock: media semplice dei dati dei genitori
        return (parent1Data + parent2Data) / 2;
    }

    /// @notice Funzione mock per modificare la salute di un procione
    /// @param nftContract Indirizzo del contratto NFT
    /// @param tokenId ID del token
    /// @param amount Quantità di salute da modificare
    /// @param isAddition True se aggiungere salute, False se sottrarre
    function modifyHealth(address nftContract, uint256 tokenId, uint256 amount, bool isAddition) external {
        IIdleProcioneNFT(nftContract).modifyCurrentHealth(tokenId, amount, isAddition);
    }
    
    /// @notice Funzione di test per mintare un NFT usando mintFromEgg
    /// @param to Indirizzo destinatario del mint
    /// @return ID del token creato
    function testMintFromEgg(address to) external returns (uint256) {
        // Crea genetica mock per i test
        uint256 genetics = createTestGenetics();
        
        // Definisce classe e fazione test
        uint256 class = 1; // Classe test
        uint256 faction = 2; // Fazione test
        
        // Chiama la funzione mintFromEgg del NFT
        return IIdleProcioneNFT(idleProcioneNFT).mintFromEgg(to, genetics, class, faction);
    }
    
    /// @notice Crea una genetica di test controllata per i test del fenotipo
    /// @return La genetica generata
    function createTestGenetics() internal pure returns (uint256) {
        uint256 genetics = 0;
        
        // Creiamo una genetica con tratti dominanti e recessivi
        
        // HEAD: tipo dominante (0) con ID 3, tipo recessivo (1) con ID 5
        uint256 head1 = (0 << 4) | 3;
        uint256 head2 = (1 << 4) | 5;
        
        // FUR: tipo recessivo (1) con ID 2, tipo dominante (0) con ID 7
        uint256 fur1 = (1 << 4) | 2;
        uint256 fur2 = (0 << 4) | 7;
        
        // Altri alleli con mix di tipi per i test
        uint256 star1 = (0 << 4) | 1;
        uint256 star2 = (0 << 4) | 9;
        uint256 weapon1 = (1 << 4) | 6;
        uint256 weapon2 = (2 << 4) | 4;
        uint256 acc1 = (2 << 4) | 8;
        uint256 acc2 = (1 << 4) | 3;
        
        // Imposta la genetica
        genetics = updateField(genetics, head1, 0x3F, 0);
        genetics = updateField(genetics, head2, 0x3F, 6);
        genetics = updateField(genetics, fur1, 0x3F, 12);
        genetics = updateField(genetics, fur2, 0x3F, 18);
        genetics = updateField(genetics, star1, 0x3F, 24);
        genetics = updateField(genetics, star2, 0x3F, 30);
        genetics = updateField(genetics, weapon1, 0x3F, 36);
        genetics = updateField(genetics, weapon2, 0x3F, 42);
        genetics = updateField(genetics, acc1, 0x3F, 48);
        genetics = updateField(genetics, acc2, 0x3F, 54);
        
        return genetics;
    }
    
    /// @notice Helper per aggiornare un campo nella genetica
    /// @param data I dati originali
    /// @param value Il nuovo valore
    /// @param mask La maschera per il campo
    /// @param position La posizione del campo
    /// @return I dati aggiornati
    function updateField(uint256 data, uint256 value, uint256 mask, uint256 position) internal pure returns (uint256) {
        uint256 clearedData = data & ~(mask << position);
        return clearedData | ((value & mask) << position);
    }
} 