// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockIdleProcioneNFT
/// @notice Mock del contratto IdleProcioneNFT per i test
contract MockIdleProcioneNFT is ERC721 {
    // Storage
    mapping(uint256 => uint256) private _procioneData;

    constructor() ERC721("MockIdleProcioneNFT", "MPNFT") {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    function updateProcioneData(uint256 tokenId, uint256 data) external {
        require(_exists(tokenId), "Token non esistente");
        _procioneData[tokenId] = data;
    }

    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token non esistente");
        return _procioneData[tokenId];
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
} 