// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICraftedItemNFT
/// @notice Interfaccia per il contratto che gestisce gli oggetti craftati come NFT
interface ICraftedItemNFT {
    // ========== Structs ==========
    struct CraftedItemAttributes {
        uint256 recipeId;
        uint256 craftedAt;
        address crafter;
        string name;
        string description;
        string[] traits;
    }

    // ========== Events ==========
    event CraftedItemMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed recipeId,
        string uri
    );

    event CraftedItemBurned(
        address indexed owner,
        uint256 indexed tokenId
    );

    event CraftedItemAttributesUpdated(
        uint256 indexed tokenId
    );

    // ========== Functions ==========
    /// @notice Minta un nuovo oggetto craftato per un giocatore
    /// @param to Indirizzo del giocatore che riceverà l'NFT
    /// @param recipeId ID della ricetta usata per craftare l'oggetto
    /// @param uri URI dell'oggetto craftato
    /// @return tokenId ID del nuovo NFT mintato
    function mintCraftedItem(address to, uint256 recipeId, string memory uri) external returns (uint256 tokenId);

    /// @notice Brucia un oggetto craftato
    /// @param tokenId ID del token da bruciare
    function burnCraftedItem(uint256 tokenId) external;

    /// @notice Imposta gli attributi di un oggetto craftato
    /// @param tokenId ID del token
    /// @param attributes Attributi da impostare
    function setCraftedItemAttributes(uint256 tokenId, CraftedItemAttributes memory attributes) external;

    /// @notice Ottiene l'ID della ricetta usata per craftare un token
    /// @param tokenId ID del token
    /// @return ID della ricetta
    function getRecipeId(uint256 tokenId) external view returns (uint256);

    /// @notice Ottiene gli attributi di un oggetto craftato
    /// @param tokenId ID del token
    /// @return Attributi dell'oggetto craftato
    function getCraftedItemAttributes(uint256 tokenId) external view returns (CraftedItemAttributes memory);

    /// @notice Ottiene l'URI di un token
    /// @param tokenId ID del token
    /// @return URI del token
    function tokenURI(uint256 tokenId) external view returns (string memory);
} 