// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/IIdleProcioneBreeding.sol";
import "../../interfaces/IIdleProcioneNFT.sol";

/// @title MockBreedingContract
/// @notice Contratto mock per i test del breeding
contract MockBreedingContract is IIdleProcioneBreeding {
    mapping(uint256 => uint256) private breedCounts;
    uint256 public constant BASE_COST = 100 ether;
    uint256 public constant GOV_COST = 10 ether;
    bool private canBreedValue = true;

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
} 