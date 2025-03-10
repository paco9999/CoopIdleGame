// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library FactionClassLib {
    enum Faction { FOREST, MOUNTAIN, RIVER, CITY, DUMP }
    enum Class { WARRIOR, RANGER, MAGE, ROGUE, HEALER, TANK }

    struct FactionClassData {
        uint256 maxFacGen;
        uint256 maxClassGen;
        uint256[5] facGen;  // FacGen0 to FacGen4
        uint256[6] classGen; // ClassGen0 to ClassGen5
    }

    event MaxGenLimitsUpdated(uint256 maxFacGen, uint256 maxClassGen);

    function setMaxGenLimits(
        FactionClassData storage self,
        uint256 _maxFacGen,
        uint256 _maxClassGen
    ) internal returns (bool) {
        self.maxFacGen = _maxFacGen;
        self.maxClassGen = _maxClassGen;
        emit MaxGenLimitsUpdated(_maxFacGen, _maxClassGen);
        return true;
    }

    function hasAvailableSlots(FactionClassData storage self) internal view returns (bool) {
        // Verifica se almeno una fazione ha spazio
        bool hasFactionSlot = false;
        for (uint256 i = 0; i < 5; i++) {
            if (self.facGen[i] < self.maxFacGen) {
                hasFactionSlot = true;
                break;
            }
        }
        
        // Verifica se almeno una classe ha spazio
        bool hasClassSlot = false;
        for (uint256 i = 0; i < 6; i++) {
            if (self.classGen[i] < self.maxClassGen) {
                hasClassSlot = true;
                break;
            }
        }
        
        return hasFactionSlot && hasClassSlot;
    }

    function generateValidFaction(
        FactionClassData storage self,
        uint256 randomNumber
    ) internal view returns (Faction) {
        uint256 attempts = 0;
        while (attempts < 10) {
            Faction faction = Faction(uint256(keccak256(abi.encode(randomNumber, attempts, "faction"))) % 5);
            if (self.facGen[uint256(faction)] < self.maxFacGen) {
                return faction;
            }
            attempts++;
        }
        revert("Impossibile trovare una fazione valida");
    }

    function generateValidClass(
        FactionClassData storage self,
        uint256 randomNumber
    ) internal view returns (uint256) {
        uint256 attempts = 0;
        while (attempts < 10) {
            uint256 class = uint256(keccak256(abi.encode(randomNumber, attempts, "class"))) % 6;
            if (self.classGen[class] < self.maxClassGen) {
                return class;
            }
            attempts++;
        }
        revert("Impossibile trovare una classe valida");
    }

    function getAvailableFactions(
        FactionClassData storage self
    ) internal view returns (uint256[5] memory availableSlots) {
        for (uint256 i = 0; i < 5; i++) {
            availableSlots[i] = self.maxFacGen - self.facGen[i];
        }
    }

    function getAvailableClasses(
        FactionClassData storage self
    ) internal view returns (uint256[6] memory availableSlots) {
        for (uint256 i = 0; i < 6; i++) {
            availableSlots[i] = self.maxClassGen - self.classGen[i];
        }
    }
} 