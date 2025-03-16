// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IMaterialsNFT
/// @notice Interfaccia per il contratto dei materiali NFT
interface IMaterialsNFT {
    /// @notice Restituisce il nome della collezione
    function name() external view returns (string memory);

    /// @notice Restituisce il simbolo della collezione
    function symbol() external view returns (string memory);

    /// @notice Restituisce il bilancio di un account per un determinato token
    /// @param account Indirizzo dell'account
    /// @param id ID del token
    /// @return uint256 Bilancio dell'account
    function balanceOf(address account, uint256 id) external view returns (uint256);

    /// @notice Brucia un batch di token
    /// @param from Indirizzo da cui bruciare i token
    /// @param ids Array degli ID dei token
    /// @param amounts Array delle quantità da bruciare
    function burnBatch(address from, uint256[] memory ids, uint256[] memory amounts) external;

    /// @notice Imposta l'approvazione per tutti i token
    /// @param operator Indirizzo dell'operatore
    /// @param approved True per approvare, false per revocare
    function setApprovalForAll(address operator, bool approved) external;

    /// @notice Verifica se un operatore è approvato per un account
    /// @param account Indirizzo dell'account
    /// @param operator Indirizzo dell'operatore
    /// @return bool True se l'operatore è approvato
    function isApprovedForAll(address account, address operator) external view returns (bool);

    /// @notice Crea un nuovo materiale
    /// @param to Indirizzo del destinatario
    /// @param id ID del materiale da creare
    function mint(address to, uint256 id) external;

    /// @notice Restituisce l'URI dei metadata di un token
    /// @param id ID del token
    /// @return string URI dei metadata
    function tokenURI(uint256 id) external view returns (string memory);

    /// @notice Restituisce i dettagli di un materiale
    /// @param id ID del materiale
    /// @return uint256 Dettagli del materiale
    function getMaterial(uint256 id) external view returns (uint256);

    /// @notice Restituisce la rarità di un materiale
    /// @param id ID del materiale
    /// @return uint256 Rarità del materiale
    function getRarity(uint256 id) external view returns (uint256);

    /// @notice Imposta l'URI base per i metadata
    /// @param baseURI Nuovo URI base
    function setBaseURI(string memory baseURI) external;
} 