// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title VRFConsumerBaseV2Upgradeable
/// @notice Versione upgradeable del contratto VRFConsumerBaseV2
abstract contract VRFConsumerBaseV2Upgradeable is Initializable {
    address private vrfCoordinator;

    /**
     * @notice Inizializza il contratto
     * @param _vrfCoordinator - address of VRFCoordinator contract
     */
    function __VRFConsumerBaseV2_init(address _vrfCoordinator) internal onlyInitializing {
        vrfCoordinator = _vrfCoordinator;
    }

    /**
     * @notice Funzione di callback chiamata dal VRF Coordinator
     * @param requestId - id della richiesta
     * @param randomWords - array di numeri casuali
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        require(msg.sender == vrfCoordinator, "Only VRFCoordinator can fulfill");
        fulfillRandomWords(requestId, randomWords);
    }

    /**
     * @notice Funzione da implementare per gestire i numeri casuali
     * @param requestId - id della richiesta
     * @param randomWords - array di numeri casuali
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;

    uint256[49] private __gap;
} 