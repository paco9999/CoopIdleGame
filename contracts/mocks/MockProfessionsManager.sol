// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockProfessionsManager {
    mapping(uint256 => uint256) private _professions; // tokenId => profession
    mapping(uint256 => bool) private _cooldowns; // tokenId => isOnCooldown
    uint256[] private _medicIds; // Array di tutti i medici

    function assignProfession(uint256 tokenId, uint256 profession) external {
        _professions[tokenId] = profession;
        if (profession == 1) { // Se è un medico
            _medicIds.push(tokenId);
        }
    }

    function getProfession(uint256 tokenId) external view returns (uint256) {
        return _professions[tokenId];
    }

    function activateCooldown(uint256 tokenId) external {
        _cooldowns[tokenId] = true;
    }

    function isOnCooldown(uint256 tokenId) external view returns (bool) {
        return _cooldowns[tokenId];
    }

    function getMembersByProfession(uint256 profession) external view returns (uint256[] memory) {
        if (profession == 1) { // Se richiediamo i medici
            return _medicIds;
        }
        return new uint256[](0);
    }

    function setAllMedicsOnCooldown() external {
        for (uint256 i = 0; i < _medicIds.length; i++) {
            _cooldowns[_medicIds[i]] = true;
        }
    }
} 