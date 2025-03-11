// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockIdleProcioneNFT is ERC721 {
    mapping(uint256 => uint256) private _procioneData;
    
    constructor() ERC721("Mock Idle Procione", "MIP") {}
    
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
    
    function ownerOf(uint256 tokenId) public view override returns (address) {
        return super.ownerOf(tokenId);
    }
    
    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        return _procioneData[tokenId];
    }
    
    function updateProcioneData(uint256 tokenId, uint256 newData) external {
        _procioneData[tokenId] = newData;
    }
    
    function setBreedingSlots(uint256 tokenId, uint256 slots) external {
        _procioneData[tokenId] = slots;
    }
} 