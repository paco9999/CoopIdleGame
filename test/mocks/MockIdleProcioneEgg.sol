// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockIdleProcioneEgg is ERC20 {
    uint256 private _nextTokenId = 1;
    mapping(uint256 => uint256) private _genetics;
    mapping(uint256 => uint256) private _hatchTime;
    mapping(uint256 => uint256) private _parent1;
    mapping(uint256 => uint256) private _parent2;

    constructor() ERC20("Mock Idle Procione Egg", "MIPE") {}

    function mint(
        address to,
        uint256 parent1Id,
        uint256 parent2Id,
        uint256 genetics,
        uint256 timestamp
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, 1);
        _genetics[tokenId] = genetics;
        _hatchTime[tokenId] = timestamp;
        _parent1[tokenId] = parent1Id;
        _parent2[tokenId] = parent2Id;
        return tokenId;
    }

    function getGenetics(uint256 tokenId) external view returns (uint256) {
        return _genetics[tokenId];
    }

    function getHatchTime(uint256 tokenId) external view returns (uint256) {
        return _hatchTime[tokenId];
    }

    function getParents(uint256 tokenId) external view returns (uint256, uint256) {
        return (_parent1[tokenId], _parent2[tokenId]);
    }
} 