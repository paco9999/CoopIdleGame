// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockVRFCoordinator
/// @notice Mock semplice per il VRFCoordinator per i test
contract MockVRFCoordinator {
    uint256 private nextRequestId = 1;
    mapping(uint256 => address) private s_consumers;

    function getLastRequestId() external view returns (uint256) {
        return nextRequestId - 1;
    }

    function fulfillRandomWordsWithDefaultValue(uint256 requestId) external {
        // Funzione mock per simulare il completamento di una richiesta di randomness
    }
} 