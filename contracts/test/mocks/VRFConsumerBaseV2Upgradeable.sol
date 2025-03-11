// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title VRFConsumerBaseV2Upgradeable
/// @notice Versione upgradeable del contratto VRFConsumerBaseV2
abstract contract VRFConsumerBaseV2Upgradeable is Initializable {
    error OnlyCoordinatorCanFulfill();

    address private vrfCoordinator;

    /**
     * @notice Costruttore che imposta l'indirizzo del coordinatore
     * @dev Deve essere chiamato dall'implementazione
     */
    function __VRFConsumerBaseV2_init(address _vrfCoordinator) internal onlyInitializing {
        vrfCoordinator = _vrfCoordinator;
    }

    /**
     * @notice Funzione di callback chiamata dal VRF Coordinator
     * @dev Deve essere implementata dal contratto che eredita
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal virtual;

    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        if (msg.sender != vrfCoordinator) {
            revert OnlyCoordinatorCanFulfill();
        }
        fulfillRandomWords(requestId, randomWords);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     */
    uint256[49] private __gap;
} 