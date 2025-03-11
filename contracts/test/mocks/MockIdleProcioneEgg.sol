// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockIdleProcioneEgg is ERC721 {
    struct EggData {
        uint256 parentId1;
        uint256 parentId2;
        uint256 genetics;
        uint256 hatchTime;
        bool hatched;
    }

    mapping(uint256 => EggData) private _eggData;
    uint256 private _nextTokenId;

    constructor() ERC721("Mock Idle Procione Egg", "MIPE") {}

    function mint(
        address to,
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 hatchTime
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _eggData[tokenId] = EggData({
            parentId1: parentId1,
            parentId2: parentId2,
            genetics: genetics,
            hatchTime: hatchTime,
            hatched: false
        });
        return tokenId;
    }

    function getEggData(uint256 tokenId) external view returns (EggData memory) {
        return _eggData[tokenId];
    }

    function setHatched(uint256 tokenId) external {
        _eggData[tokenId].hatched = true;
    }

    function canHatch(uint256 tokenId) external view returns (bool) {
        return block.timestamp >= _eggData[tokenId].hatchTime && !_eggData[tokenId].hatched;
    }
} 