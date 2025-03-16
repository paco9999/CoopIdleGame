// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICraftingManager {
    function areRecipesValid(uint256[] calldata recipeIds) external view returns (bool);
} 