// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../libraries/StatsLib.sol";

interface IIdleProcioneNFT {
    function mint(address to, uint256 genetics, uint256 class, uint256 faction) external returns (uint256);
    function mintFromEgg(address to, uint256 genetics, uint256 class, uint256 faction) external returns (uint256);
    function getProcioneData(uint256 procioneId) external view returns (uint256);
}

contract MockIdleProcioneNFT is ERC721, IIdleProcioneNFT {
    mapping(uint256 => uint256) private _procioneData;
    uint256 private _tokenIdCounter;
    
    error TokenNotExists();
    
    constructor() ERC721("Mock Idle Procione", "MIP") {}
    
    function _checkTokenExists(uint256 tokenId) internal view {
        try this.ownerOf(tokenId) returns (address) {
            // Il token esiste
        } catch {
            revert TokenNotExists();
        }
    }
    
    // Funzione mint semplice per i test
    function simpleMint(address to) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _procioneData[tokenId] = 1;  // Dati di default
        return tokenId;
    }

    // Funzione mint per l'interfaccia
    function mint(address to, uint256 genetics, uint256 class, uint256 faction) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _procioneData[tokenId] = genetics | (class << 128) | (faction << 192);
        return tokenId;
    }

    function mintFromEgg(address to, uint256 genetics, uint256 class, uint256 faction) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _procioneData[tokenId] = genetics | (class << 128) | (faction << 192);
        return tokenId;
    }
    
    function ownerOf(uint256 tokenId) public view override returns (address) {
        return super.ownerOf(tokenId);
    }
    
    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        _checkTokenExists(tokenId);
        return _procioneData[tokenId];
    }
    
    function updateProcioneData(uint256 tokenId, uint256 data) external {
        _checkTokenExists(tokenId);
        _procioneData[tokenId] = data;
    }
    
    function breed(uint256 parent1Id, uint256 parent2Id) external returns (uint256) {
        // Questo è solo un mock, quindi ritorniamo un nuovo tokenId incrementale
        uint256 newTokenId = parent1Id + parent2Id;
        _safeMint(msg.sender, newTokenId);
        return newTokenId;
    }
} 