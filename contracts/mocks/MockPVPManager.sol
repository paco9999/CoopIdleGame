// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPVPManager {
    // Questo è un contratto mock vuoto che serve solo per i test
    // Non ha bisogno di implementare alcuna funzionalità specifica
    // poiché viene usato solo per verificare le autorizzazioni

    // Funzione receive per permettere al contratto di ricevere ETH
    receive() external payable {}

    // Funzione fallback per gestire chiamate non riconosciute
    fallback() external payable {}

    // Funzione per simulare una chiamata al DungeonManager
    function callDungeonManager(address dungeonManager, bytes calldata data) external returns (bool, bytes memory) {
        (bool success, bytes memory returnData) = dungeonManager.call(data);
        return (success, returnData);
    }
} 