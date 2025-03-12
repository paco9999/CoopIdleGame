// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MaterialsLib
/// @notice Libreria per la gestione dei materiali e delle loro rarità
library MaterialsLib {
    // Enum per i tipi di rarità
    enum Rarity {
        COMMON,     // 0
        RARE,       // 1
        EPIC,       // 2
        LEGENDARY   // 3
    }

    // Enum per tutti i materiali disponibili
    enum Material {
        // Materiali Comuni (0-4)
        WOOD,           // 0
        STONE,          // 1
        IRON_ORE,       // 2
        COPPER_ORE,     // 3
        LEATHER,        // 4

        // Materiali Rari (5-9)
        SILVER_ORE,     // 5
        GOLD_ORE,       // 6
        MITHRIL_ORE,    // 7
        MOONSTONE,      // 8
        STARDUST,       // 9

        // Materiali Epici (10-14)
        DRAGON_SCALE,   // 10
        PHOENIX_FEATHER,// 11
        VOID_CRYSTAL,   // 12
        ANCIENT_WOOD,   // 13
        CELESTIAL_ORE,  // 14

        // Materiali Leggendari (15-19)
        ETERNAL_FLAME,  // 15
        COSMIC_DUST,    // 16
        DIVINE_METAL,   // 17
        CHAOS_ESSENCE,  // 18
        INFINITY_STONE  // 19
    }

    // Struttura per i range di rarità
    struct RarityRange {
        uint256 start;
        uint256 end;
    }

    /// @notice Ottiene l'URI di un materiale specifico
    /// @param material Il materiale di cui ottenere l'URI
    /// @return L'URI del materiale
    function getMaterialURI(Material material) internal pure returns (string memory) {
        string memory rarityPath;
        if (uint256(material) <= 4) {
            rarityPath = "materials/common/";
        } else if (uint256(material) <= 9) {
            rarityPath = "materials/rare/";
        } else if (uint256(material) <= 14) {
            rarityPath = "materials/epic/";
        } else {
            rarityPath = "materials/legendary/";
        }

        return string(abi.encodePacked(
            rarityPath,
            getMaterialSlug(material)
        ));
    }

    /// @notice Ottiene lo slug del materiale per l'URI
    /// @param material Il materiale di cui ottenere lo slug
    /// @return Lo slug del materiale
    function getMaterialSlug(Material material) internal pure returns (string memory) {
        if (material == Material.WOOD) return "wood";
        if (material == Material.STONE) return "stone";
        if (material == Material.IRON_ORE) return "iron_ore";
        if (material == Material.COPPER_ORE) return "copper_ore";
        if (material == Material.LEATHER) return "leather";
        if (material == Material.SILVER_ORE) return "silver_ore";
        if (material == Material.GOLD_ORE) return "gold_ore";
        if (material == Material.MITHRIL_ORE) return "mithril_ore";
        if (material == Material.MOONSTONE) return "moonstone";
        if (material == Material.STARDUST) return "stardust";
        if (material == Material.DRAGON_SCALE) return "dragon_scale";
        if (material == Material.PHOENIX_FEATHER) return "phoenix_feather";
        if (material == Material.VOID_CRYSTAL) return "void_crystal";
        if (material == Material.ANCIENT_WOOD) return "ancient_wood";
        if (material == Material.CELESTIAL_ORE) return "celestial_ore";
        if (material == Material.ETERNAL_FLAME) return "eternal_flame";
        if (material == Material.COSMIC_DUST) return "cosmic_dust";
        if (material == Material.DIVINE_METAL) return "divine_metal";
        if (material == Material.CHAOS_ESSENCE) return "chaos_essence";
        if (material == Material.INFINITY_STONE) return "infinity_stone";
        return "unknown";
    }

    // Mapping per i range di rarità
    function getRarityRange(Rarity rarity) internal pure returns (RarityRange memory) {
        if (rarity == Rarity.COMMON) {
            return RarityRange(0, 4);
        } else if (rarity == Rarity.RARE) {
            return RarityRange(5, 9);
        } else if (rarity == Rarity.EPIC) {
            return RarityRange(10, 14);
        } else {
            return RarityRange(15, 19);
        }
    }

    // Funzione per ottenere la rarità di un materiale
    function getMaterialRarity(Material material) internal pure returns (Rarity) {
        uint256 id = uint256(material);
        if (id <= 4) {
            return Rarity.COMMON;
        } else if (id <= 9) {
            return Rarity.RARE;
        } else if (id <= 14) {
            return Rarity.EPIC;
        } else {
            return Rarity.LEGENDARY;
        }
    }

    // Funzione per ottenere il nome del materiale
    function getMaterialName(Material material) internal pure returns (string memory) {
        if (material == Material.WOOD) return "Wood";
        if (material == Material.STONE) return "Stone";
        if (material == Material.IRON_ORE) return "Iron Ore";
        if (material == Material.COPPER_ORE) return "Copper Ore";
        if (material == Material.LEATHER) return "Leather";
        if (material == Material.SILVER_ORE) return "Silver Ore";
        if (material == Material.GOLD_ORE) return "Gold Ore";
        if (material == Material.MITHRIL_ORE) return "Mithril Ore";
        if (material == Material.MOONSTONE) return "Moonstone";
        if (material == Material.STARDUST) return "Stardust";
        if (material == Material.DRAGON_SCALE) return "Dragon Scale";
        if (material == Material.PHOENIX_FEATHER) return "Phoenix Feather";
        if (material == Material.VOID_CRYSTAL) return "Void Crystal";
        if (material == Material.ANCIENT_WOOD) return "Ancient Wood";
        if (material == Material.CELESTIAL_ORE) return "Celestial Ore";
        if (material == Material.ETERNAL_FLAME) return "Eternal Flame";
        if (material == Material.COSMIC_DUST) return "Cosmic Dust";
        if (material == Material.DIVINE_METAL) return "Divine Metal";
        if (material == Material.CHAOS_ESSENCE) return "Chaos Essence";
        if (material == Material.INFINITY_STONE) return "Infinity Stone";
        return "Unknown";
    }
} 