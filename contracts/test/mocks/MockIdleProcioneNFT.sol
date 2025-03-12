// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../../libraries/StatsLib.sol";

/// @title MockIdleProcioneNFT
/// @notice Contratto mock per i test dell'NFT
contract MockIdleProcioneNFT is ERC721 {
    using StatsLib for uint256;

    mapping(uint256 => uint256) private _procioneData;
    uint256 private _tokenIdCounter;

    constructor() ERC721("MockIdleProcioneNFT", "MNFT") {}

    function simpleMint(address to) external returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(to, tokenId);
        _procioneData[tokenId] = StatsLib.createInitialData();
        return tokenId;
    }

    function updateProcioneData(uint256 tokenId, uint256 newData) external {
        require(_exists(tokenId), "Token does not exist");
        _procioneData[tokenId] = newData;
    }

    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Token does not exist");
        return _procioneData[tokenId];
    }

    function setLevel(uint256 data, uint256 level) external pure returns (uint256) {
        return StatsLib.setLevel(data, level);
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        return super.ownerOf(tokenId);
    }

    /// @notice Verifica se un token esiste
    /// @param tokenId ID del token da verificare
    /// @return bool True se il token esiste
    function _exists(uint256 tokenId) internal view returns (bool) {
        try this.ownerOf(tokenId) returns (address) {
            return true;
        } catch {
            return false;
        }
    }
} 