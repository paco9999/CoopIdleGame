// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockProfessionsManager {
    struct ArtisanInfo {
        address owner;
        uint256 level;
        uint256 availableCraftingSlots;
    }

    mapping(address => uint256) private artisanLevels;
    mapping(uint256 => uint256) private lockedSlots;
    ArtisanInfo[] private members;

    function setArtisanLevel(address artisan, uint256 level) external {
        artisanLevels[artisan] = level;
        bool found = false;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i].owner == artisan) {
                members[i].level = level;
                found = true;
                break;
            }
        }
        if (!found && level > 0) {
            members.push(ArtisanInfo({
                owner: artisan,
                level: level,
                availableCraftingSlots: 5
            }));
        }
    }

    function getArtisanLevel(address artisan) external view returns (uint256) {
        return artisanLevels[artisan];
    }

    function lockCraftingSlot(uint256 artisanIndex, uint256 duration) external {
        require(artisanIndex < members.length, "Invalid artisan index");
        require(members[artisanIndex].availableCraftingSlots > 0, "No slots available");
        members[artisanIndex].availableCraftingSlots--;
        lockedSlots[artisanIndex]++;
    }

    function unlockCraftingSlot(uint256 artisanIndex) external {
        require(artisanIndex < members.length, "Invalid artisan index");
        require(lockedSlots[artisanIndex] > 0, "No locked slots");
        members[artisanIndex].availableCraftingSlots++;
        lockedSlots[artisanIndex]--;
    }

    function setAvailableCraftingSlots(address artisan, uint256 slots) external {
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i].owner == artisan) {
                members[i].availableCraftingSlots = slots;
                break;
            }
        }
    }

    function getProfessionMembers() external view returns (ArtisanInfo[] memory) {
        return members;
    }
} 