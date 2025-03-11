// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockLinkToken
/// @notice Mock del token LINK per i test
contract MockLinkToken is ERC20 {
    constructor() ERC20("ChainLink Token", "LINK") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
} 