// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../interfaces/IIdleProcioneBreeding.sol";
import "../../interfaces/IIdleProcioneNFT.sol";

/// @title MockBreedingContract
/// @notice Contratto mock per i test del breeding
contract MockBreedingContract is IIdleProcioneBreeding {
    mapping(uint256 => uint256) private breedCounts;

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

    /// @notice Funzione mock per il breeding
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    function breed(uint256 parent1Id, uint256 parent2Id) external {
        // Mock implementation - non fa nulla
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