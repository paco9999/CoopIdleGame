// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/MaterialsLib.sol";

/// @title MaterialsLibTester
/// @notice Contratto di test per la libreria MaterialsLib
/// @dev Questo contratto espone le funzioni della libreria per i test
contract MaterialsLibTester {
    using MaterialsLib for MaterialsLib.Material;
    using MaterialsLib for MaterialsLib.Rarity;

    function getRarityRange(MaterialsLib.Rarity rarity) external pure returns (MaterialsLib.RarityRange memory) {
        return MaterialsLib.getRarityRange(rarity);
    }

    function getMaterialRarity(MaterialsLib.Material material) external pure returns (MaterialsLib.Rarity) {
        return MaterialsLib.getMaterialRarity(material);
    }

    function getMaterialName(MaterialsLib.Material material) external pure returns (string memory) {
        return MaterialsLib.getMaterialName(material);
    }

    function getMaterialURI(MaterialsLib.Material material) external pure returns (string memory) {
        return MaterialsLib.getMaterialURI(material);
    }

    function getMaterialSlug(MaterialsLib.Material material) external pure returns (string memory) {
        return MaterialsLib.getMaterialSlug(material);
    }
} 