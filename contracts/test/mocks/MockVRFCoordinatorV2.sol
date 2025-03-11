// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockVRFCoordinatorV2
/// @notice Mock del VRFCoordinatorV2 di Chainlink per i test
contract MockVRFCoordinatorV2 {
    uint256 private constant DEFAULT_RANDOM_WORDS = 1;
    uint256 private nextRequestId = 1;
    mapping(uint256 => address) private s_consumers;
    mapping(uint256 => uint256[]) private s_randomWords;

    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 preSeed,
        uint64 subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address indexed sender
    );

    event RandomWordsFulfilled(
        uint256 indexed requestId,
        uint256 outputSeed,
        uint96 payment,
        bool success
    );

    function requestRandomWords(
        bytes32 keyHash,
        uint64 subId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords
    ) external returns (uint256) {
        uint256 requestId = nextRequestId++;
        s_consumers[requestId] = msg.sender;
        
        emit RandomWordsRequested(
            keyHash,
            requestId,
            uint256(blockhash(block.number - 1)),
            subId,
            requestConfirmations,
            callbackGasLimit,
            numWords,
            msg.sender
        );

        return requestId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        require(s_consumers[requestId] != address(0), "request not found");
        
        s_randomWords[requestId] = randomWords;
        
        // Chiamata alla funzione di callback del consumatore
        try VRFConsumerBaseV2(s_consumers[requestId]).rawFulfillRandomWords(
            requestId,
            randomWords
        ) {
            emit RandomWordsFulfilled(requestId, randomWords[0], 0, true);
        } catch {
            emit RandomWordsFulfilled(requestId, randomWords[0], 0, false);
        }
    }

    // Funzione helper per i test
    function fulfillRandomWordsWithDefaultValue(uint256 requestId) external {
        uint256[] memory randomWords = new uint256[](DEFAULT_RANDOM_WORDS);
        randomWords[0] = uint256(keccak256(abi.encode(requestId, block.timestamp)));
        this.fulfillRandomWords(requestId, randomWords);
    }

    // Funzione per ottenere l'ultimo requestId
    function getLastRequestId() external view returns (uint256) {
        return nextRequestId - 1;
    }
}

/// @title VRFConsumerBaseV2
/// @notice Interfaccia base per i consumatori di VRF
abstract contract VRFConsumerBaseV2 {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        external
        virtual;
} 