// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockProfessionsManager {
    struct ArtisanInfo {
        address owner;
        uint256 level;
        uint256 availableCraftingSlots;
        uint256 tokenId;
    }

    mapping(uint256 => uint256) private _professions; // tokenId => profession
    mapping(uint256 => bool) private _cooldowns; // tokenId => isOnCooldown
    mapping(uint256 => uint256) private _artisanLevels; // tokenId => artisan level
    mapping(uint256 => uint256) private _availableSlots; // tokenId => available slots
    mapping(uint256 => bool[]) private _craftingSlots; // tokenId => array of slot status (true = occupied)
    mapping(uint256 => address) private _tokenOwners; // tokenId => owner
    uint256[] private _medicIds; // Array di tutti i medici
    uint256[] private _artisanIds; // Array di tutti gli artigiani
    uint256[] private _paladinIds; // Array di tutti i paladin
    address public craftingManager;

    // Costanti per le professioni allineate con StatsLib
    uint256 public constant ARTISAN = 1;
    uint256 public constant MEDIC = 2;
    uint256 public constant THIEF = 3;
    uint256 public constant GATHERER = 4;
    uint256 public constant PALADIN = 5;

    function assignProfession(uint256 tokenId, uint256 profession) external {
        _professions[tokenId] = profession;
        if (profession == MEDIC) {
            _medicIds.push(tokenId);
        } else if (profession == ARTISAN) {
            _artisanIds.push(tokenId);
            _craftingSlots[tokenId] = new bool[](5); // Inizializza con 5 slot
            _availableSlots[tokenId] = 5;
        } else if (profession == PALADIN) {
            _paladinIds.push(tokenId);
        }
    }

    function setTokenOwner(uint256 tokenId, address owner) external {
        _tokenOwners[tokenId] = owner;
    }

    function getProfessionMembers() external view returns (ArtisanInfo[] memory) {
        ArtisanInfo[] memory artisans = new ArtisanInfo[](_artisanIds.length);
        
        for (uint256 i = 0; i < _artisanIds.length; i++) {
            uint256 tokenId = _artisanIds[i];
            artisans[i] = ArtisanInfo({
                owner: _tokenOwners[tokenId],
                level: _artisanLevels[tokenId],
                availableCraftingSlots: _availableSlots[tokenId],
                tokenId: tokenId
            });
        }
        
        return artisans;
    }

    function getProfession(uint256 tokenId) external view returns (uint256) {
        return _professions[tokenId];
    }

    function activateCooldown(uint256 tokenId) external {
        _cooldowns[tokenId] = true;
    }

    function deactivateCooldown(uint256 tokenId) external {
        _cooldowns[tokenId] = false;
    }

    function isOnCooldown(uint256 tokenId) external view returns (bool) {
        return _cooldowns[tokenId];
    }

    function getMembersByProfession(uint256 profession) external view returns (uint256[] memory) {
        if (profession == MEDIC) {
            return _medicIds;
        } else if (profession == PALADIN) {
            return _paladinIds;
        }
        return new uint256[](0);
    }

    function setAllMedicsOnCooldown() external {
        for (uint256 i = 0; i < _medicIds.length; i++) {
            _cooldowns[_medicIds[i]] = true;
        }
    }

    function setArtisanLevel(uint256 tokenId, uint256 level) external {
        require(_professions[tokenId] == ARTISAN, "Not an artisan");
        _artisanLevels[tokenId] = level;
    }

    function getArtisanLevel(uint256 tokenId) external view returns (uint256) {
        return _artisanLevels[tokenId];
    }

    function setAvailableCraftingSlots(uint256 tokenId, uint256 slots) external {
        require(_professions[tokenId] == ARTISAN, "Not an artisan");
        _availableSlots[tokenId] = slots;
        _craftingSlots[tokenId] = new bool[](slots);
    }

    function getAvailableCraftingSlots(uint256 tokenId) external view returns (uint256) {
        return _availableSlots[tokenId];
    }

    function lockCraftingSlot(uint256 tokenId, uint256 craftingTime) external returns (uint256) {
        require(_professions[tokenId] == ARTISAN, "Not an artisan");
        require(msg.sender == craftingManager, "Only CraftingManager");
        
        bool[] storage slots = _craftingSlots[tokenId];
        for (uint256 i = 0; i < slots.length; i++) {
            if (!slots[i]) {
                slots[i] = true;
                _availableSlots[tokenId]--;
                return i;
            }
        }
        revert("No available slots");
    }

    function unlockCraftingSlot(uint256 tokenId, uint256 slotIndex) external {
        require(_professions[tokenId] == ARTISAN, "Not an artisan");
        require(msg.sender == craftingManager, "Only CraftingManager");
        require(slotIndex < _craftingSlots[tokenId].length, "Invalid slot index");
        require(_craftingSlots[tokenId][slotIndex], "Slot already unlocked");
        
        _craftingSlots[tokenId][slotIndex] = false;
    }

    function setCraftingManager(address _craftingManager) external {
        craftingManager = _craftingManager;
    }

    // Funzioni specifiche per Paladin
    function isPaladinOnCooldown(uint256 tokenId) external view returns (bool) {
        require(_professions[tokenId] == PALADIN, "Not a paladin");
        return _cooldowns[tokenId];
    }

    function activatePaladinCooldown(uint256 tokenId) external {
        require(_professions[tokenId] == PALADIN, "Not a paladin");
        _cooldowns[tokenId] = true;
    }

    function getPaladinCooldown(uint256 level) external pure returns (uint256) {
        if (level <= 4) return 24 * 3600;  // 24 ore
        if (level <= 9) return 20 * 3600;  // 20 ore
        if (level <= 14) return 16 * 3600; // 16 ore
        if (level <= 19) return 12 * 3600; // 12 ore
        if (level == 20) return 6 * 3600;  // 6 ore
        return 24 * 3600; // Default: 24 ore
    }

    /**
     * @dev Forza l'assegnazione di una professione a un token per scopi di test
     * @param tokenId ID del token
     * @param professionId ID della professione
     */
    function forceSetProfession(uint256 tokenId, uint8 professionId) external {
        // Per scopi di test, forza l'assegnazione di una professione
        _professions[tokenId] = professionId;
    }
} 