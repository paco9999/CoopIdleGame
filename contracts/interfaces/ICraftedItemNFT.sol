// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICraftedItemNFT
/// @notice Interfaccia per il contratto che gestisce gli oggetti craftati come NFT
interface ICraftedItemNFT {
    /// @notice Minta un nuovo oggetto craftato per un giocatore
    /// @param to Indirizzo del giocatore che riceverà l'NFT
    /// @param recipeId ID della ricetta usata per craftare l'oggetto
    /// @param uri URI dell'oggetto craftato
    /// @return tokenId ID del nuovo NFT mintato
    function mintCraftedItem(address to, uint256 recipeId, string memory uri) external returns (uint256 tokenId);
} 