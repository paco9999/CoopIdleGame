// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockOracle
/// @notice Mock dell'Oracle per i test
contract MockOracle {
    event OracleRequest(
        bytes32 indexed requestId,
        address requester,
        bytes32 dataHash
    );

    event OracleResponse(
        bytes32 indexed requestId,
        uint256 response
    );

    mapping(bytes32 => bool) private requests;
    mapping(bytes32 => uint256) private responses;

    function requestData(bytes32 dataHash) external returns (bytes32) {
        bytes32 requestId = keccak256(abi.encodePacked(block.timestamp, msg.sender, dataHash));
        requests[requestId] = true;
        emit OracleRequest(requestId, msg.sender, dataHash);
        return requestId;
    }

    function fulfillRequest(bytes32 requestId, uint256 response) external {
        require(requests[requestId], "Request not found");
        responses[requestId] = response;
        emit OracleResponse(requestId, response);
    }

    function getResponse(bytes32 requestId) external view returns (uint256) {
        require(responses[requestId] != 0, "Response not available");
        return responses[requestId];
    }
} 