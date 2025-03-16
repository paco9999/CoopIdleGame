// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProfessionsManager {
    struct ArtisanInfo {
        address owner;
        uint256 level;
        uint256 availableCraftingSlots;
        uint256 tokenId;
    }

    /// @notice Blocca uno slot di crafting per un artigiano
    /// @param tokenId ID dell'artigiano
    /// @param duration Durata del blocco
    function lockCraftingSlot(uint256 tokenId, uint256 duration) external;

    /// @notice Ottiene tutti gli artigiani
    /// @return Array di informazioni sugli artigiani
    function getProfessionMembers() external view returns (ArtisanInfo[] memory);

    /// @notice Ottiene tutti i membri di una professione specifica
    /// @param professionId ID della professione
    /// @return Array di ID dei token con quella professione
    function getMembersByProfession(uint256 professionId) external view returns (uint256[] memory);

    /// @notice Attiva il cooldown per un medico
    /// @param tokenId ID del medico per cui attivare il cooldown
    function activateCooldown(uint256 tokenId) external;

    /// @notice Verifica se un medico è in cooldown
    /// @param tokenId ID del medico da verificare
    /// @return true se il medico è in cooldown, false altrimenti
    function isOnCooldown(uint256 tokenId) external view returns (bool);

    /// @notice Ottiene tutti i membri di una professione
    /// @param profession ID della professione
    /// @return array di ID dei token con quella professione
    function getProfessionMembers(uint256 profession) external view returns (uint256[] memory);
} 