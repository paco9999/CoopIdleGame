// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockRandomnessConsumer
 * @dev Mock del contratto RandomnessConsumer per i test
 */
contract MockRandomnessConsumer {
    mapping(uint256 => bool) public usedRandomNumbers;
    
    // Per facilitare i test, ritorniamo semplicemente il randomNumber senza verifiche
    function consumeRandomness(
        uint256 randomNumber, 
        uint256 timestamp, 
        bytes calldata signature
    ) external returns (uint256) {
        // Marca il numero come utilizzato
        usedRandomNumbers[randomNumber] = true;
        return randomNumber;
    }
    
    // Verifica semplificata per i test
    function verifySignature(
        uint256 randomNumber,
        uint256 timestamp,
        bytes calldata signature
    ) public pure returns (bool) {
        return true; // Sempre valido per i test
    }
} 