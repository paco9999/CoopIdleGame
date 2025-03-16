// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../libraries/StatsLib.sol";

contract MockIdleProcioneNFT is ERC721 {
    uint256 private _nextTokenId;
    mapping(uint256 => uint256) private _procioneData;
    uint256 constant MAX_HEALTH = 100;

    constructor() ERC721("MockIdleProcioneNFT", "MNFT") {}

    function safeMint(address to) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        // Inizializza con salute massima e salute corrente al massimo
        uint256 data = 0;
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
        return tokenId;
    }

    function getHealth(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return StatsLib.getCurrentHealth(_procioneData[tokenId]);
    }

    function setHealth(uint256 tokenId, uint256 health) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        require(health <= MAX_HEALTH, "Health must be between 0 and 100");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.updateField(data, health, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
    }

    function setFullHealth(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
    }

    function isFullHealth(uint256 tokenId) public view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        uint256 data = _procioneData[tokenId];
        uint256 currentHealth = StatsLib.getCurrentHealth(data);
        uint256 maxHealth = StatsLib.extractField(data, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        return currentHealth >= maxHealth;
    }

    function getProcioneData(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return _procioneData[tokenId];
    }

    function modifyCurrentHealth(uint256 tokenId, uint256 amount, bool increase) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.modifyCurrentHealth(data, amount, increase);
        _procioneData[tokenId] = data;
    }
} 