// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockIdleProcioneEgg is ERC20 {
    uint256 private _nextEggId;
    
    constructor() ERC20("Mock Idle Procione Egg", "MIPE") {}
    
    function mint(
        address to,
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 timestamp
    ) external returns (uint256) {
        _mint(to, 1);
        return _nextEggId++;
    }
} 