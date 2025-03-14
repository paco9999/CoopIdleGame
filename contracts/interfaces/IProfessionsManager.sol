// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IProfessionsManager {
    struct ArtisanInfo {
        address owner;
        uint256 level;
        uint256 availableCraftingSlots;
    }

    function lockCraftingSlot(uint256 artisanIndex, uint256 duration) external;
    function getProfessionMembers() external view returns (ArtisanInfo[] memory);
} 