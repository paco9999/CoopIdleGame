// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/StatsLib.sol";

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

    /// @notice Restituisce le informazioni di professione di un procione
    /// @param tokenId ID del token
    /// @return StatsLib.Professions Professione del procione
    /// @return uint256 Livello della professione
    /// @return uint256 XP accumulato per la professione
    function getProfessionInfo(uint256 tokenId) external view returns (StatsLib.Professions, uint256, uint256);

    /// @notice Aggiorna la professione di un procione
    /// @param tokenId ID del token
    /// @param profession Nuova professione del procione
    function setProfession(uint256 tokenId, StatsLib.Professions profession) external;

    /// @notice Modifica la salute corrente di un procione
    /// @param tokenId ID del token
    /// @param amount Quantità di salute da modificare
    /// @param isAddition True se aggiungere salute, False se sottrarre
    function modifyCurrentHealth(uint256 tokenId, uint256 amount, bool isAddition) external;
} 