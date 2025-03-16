// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockCraftingManager {
    mapping(uint256 => bool) private validRecipes;
    mapping(uint256 => uint256) private lockedSlots;
    mapping(uint256 => mapping(uint256 => uint256)) private slotUnlockTimes;

    // Funzione richiesta da ICraftingManager per DungeonManager
    function areRecipesValid(uint256[] calldata recipeIds) external view returns (bool) {
        for (uint256 i = 0; i < recipeIds.length; i++) {
            if (!validRecipes[recipeIds[i]]) {
                return false;
            }
        }
        return true;
    }

    // Funzione di supporto per i test
    function setRecipeValidity(uint256 recipeId, bool isValid) external {
        validRecipes[recipeId] = isValid;
    }

    // Funzioni per la gestione degli slot di crafting
    function lockCraftingSlot(uint256 tokenId, uint256 duration) external {
        lockedSlots[tokenId]++;
        slotUnlockTimes[tokenId][lockedSlots[tokenId] - 1] = block.timestamp + duration;
    }

    function unlockCraftingSlot(uint256 tokenId, uint256 slotIndex) external {
        require(slotIndex < lockedSlots[tokenId], "Invalid slot index");
        slotUnlockTimes[tokenId][slotIndex] = 0;
        lockedSlots[tokenId]--;
    }

    function getLockedSlots(uint256 tokenId) external view returns (uint256) {
        uint256 currentLockedSlots = lockedSlots[tokenId];
        for(uint256 i = 0; i < lockedSlots[tokenId]; i++) {
            if(slotUnlockTimes[tokenId][i] <= block.timestamp) {
                currentLockedSlots--;
            }
        }
        return currentLockedSlots;
    }
} 