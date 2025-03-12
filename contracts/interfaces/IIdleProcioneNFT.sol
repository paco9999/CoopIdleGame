// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdleProcioneNFT
/// @notice Interfaccia per il contratto principale degli NFT Procione
interface IIdleProcioneNFT {
    /// @notice Restituisce il proprietario di un token
    /// @param tokenId ID del token
    /// @return address Indirizzo del proprietario
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Restituisce i dati di un procione
    /// @param tokenId ID del token
    /// @return uint256 Dati del procione in formato packed
    function getProcioneData(uint256 tokenId) external view returns (uint256);

    /// @notice Aggiorna i dati di un procione
    /// @param tokenId ID del token
    /// @param newData Nuovi dati del procione
    function updateProcioneData(uint256 tokenId, uint256 newData) external;

    /// @notice Crea un nuovo procione da un uovo
    /// @param to Indirizzo del destinatario
    /// @param genetics Genetica del procione
    /// @param class Classe del procione
    /// @param faction Fazione del procione
    /// @return uint256 ID del nuovo procione
    function mintFromEgg(address to, uint256 genetics, uint256 class, uint256 faction) external returns (uint256);

    /// @notice Esegue il breeding di due procioni
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    /// @return uint256 ID del nuovo procione
    function breed(uint256 parent1Id, uint256 parent2Id) external returns (uint256);
} 