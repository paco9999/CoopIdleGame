// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockIdleProcioneEgg is ERC721, Ownable {
    uint256 private _counter;

    constructor() ERC721("MockIdleProcioneEgg", "MEGG") Ownable(msg.sender) {}

    function mint(
        address to,
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 hatchTime
    ) external returns (uint256) {
        uint256 tokenId = _counter++;
        _safeMint(to, tokenId);
        return tokenId;
    }
} 