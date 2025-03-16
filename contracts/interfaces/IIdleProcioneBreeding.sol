// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdleProcioneBreeding
/// @notice Interfaccia per il contratto di breeding dei Procioni
interface IIdleProcioneBreeding {
    // ========== Events ==========
    event BreedingInitiated(
        uint256 indexed parent1Id,
        uint256 indexed parent2Id,
        uint256 indexed eggId,
        uint256 genetics,
        uint256 hatchTime
    );

    event CostsUpdated(uint256 newBaseCost, uint256 newGovBaseCost);
    
    // ========== View Functions ==========
    /// @notice Ottiene il numero di breeding effettuati per un token
    /// @param tokenId ID del token
    /// @return Numero di breeding effettuati
    function getBreedCount(uint256 tokenId) external view returns (uint256);

    /// @notice Verifica se un procione può effettuare breeding
    /// @param tokenId ID del token
    /// @return True se il procione può effettuare breeding
    function canBreed(uint256 tokenId) external view returns (bool);

    /// @notice Ottiene il costo di breeding per un procione
    /// @param tokenId ID del token
    /// @return baseCost Costo base in reward token
    /// @return govCost Costo in governance token
    function getBreedingCost(uint256 tokenId) external view returns (uint256 baseCost, uint256 govCost);

    // ========== Mutative Functions ==========
    /// @notice Esegue il breeding tra due procioni
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    function breed(uint256 parent1Id, uint256 parent2Id) external;

    /// @notice Combina la genetica dei genitori per l'uovo
    /// @param parent1Data Dati del primo genitore
    /// @param parent2Data Dati del secondo genitore
    /// @return La genetica combinata
    function combineParentGenetics(uint256 parent1Data, uint256 parent2Data) external view returns (uint256);
} 