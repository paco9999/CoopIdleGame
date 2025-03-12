// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdleProcioneBreeding
/// @notice Interfaccia per il contratto di breeding dei Procioni
interface IIdleProcioneBreeding {
    /// @notice Ottiene il numero di breeding effettuati per un token
    /// @param tokenId ID del token
    /// @return Numero di breeding effettuati
    function getBreedCount(uint256 tokenId) external view returns (uint256);

    /// @notice Esegue il breeding tra due procioni
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    function breed(uint256 parent1Id, uint256 parent2Id) external;
} 