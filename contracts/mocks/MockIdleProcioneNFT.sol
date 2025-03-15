// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockIdleProcioneNFT is ERC721 {
    uint256 private _nextTokenId;
    mapping(uint256 => uint256) private _health; // 0-100
    uint256 constant MAX_HEALTH = 100;

    constructor() ERC721("MockIdleProcioneNFT", "MNFT") {}

    function safeMint(address to) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _health[tokenId] = 50; // Inizializza con 50% di salute
        return tokenId;
    }

    function getHealth(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return _health[tokenId];
    }

    function setHealth(uint256 tokenId, uint256 health) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        require(health <= MAX_HEALTH, "Health must be between 0 and 100");
        _health[tokenId] = health;
    }

    function setFullHealth(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        _health[tokenId] = MAX_HEALTH;
    }

    function isFullHealth(uint256 tokenId) public view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return _health[tokenId] == MAX_HEALTH;
    }

    function getProcioneData(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        // maxHealth è sempre 100 (primi 8 bit)
        // currentHealth è il valore attuale (secondi 8 bit)
        return (MAX_HEALTH << 248) | (_health[tokenId] << 240);
    }

    function modifyCurrentHealth(uint256 tokenId, uint256 amount, bool increase) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        if (increase) {
            _health[tokenId] = _health[tokenId] + amount > MAX_HEALTH ? MAX_HEALTH : _health[tokenId] + amount;
        } else {
            _health[tokenId] = amount > _health[tokenId] ? 0 : _health[tokenId] - amount;
        }
    }
} 