// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/StatsLib.sol";

contract MockStatsLib {
    using StatsLib for uint256;

    function updateField(uint256 data, uint256 value, uint256 mask, uint256 position) public pure returns (uint256) {
        return StatsLib.updateField(data, value, mask, position);
    }

    function extractField(uint256 data, uint256 mask, uint256 position) public pure returns (uint256) {
        return StatsLib.extractField(data, mask, position);
    }
} 