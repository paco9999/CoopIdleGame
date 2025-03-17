// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Base64
/// @notice Libreria per la codifica in Base64
/// @dev Fornisce funzionalità per codificare bytes in stringhe Base64
library Base64 {
    bytes internal constant TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    /// @notice Codifica bytes in una stringa Base64
    /// @param data Dati da codificare
    /// @return Stringa contenente i dati codificati in Base64
    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        // Calcola la lunghezza dell'output
        uint256 outputLength = 4 * ((data.length + 2) / 3);
        bytes memory output = new bytes(outputLength);

        // Processa ogni blocco da 3 byte
        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 a = i < data.length ? uint8(data[i]) : 0;
            uint256 b = i + 1 < data.length ? uint8(data[i + 1]) : 0;
            uint256 c = i + 2 < data.length ? uint8(data[i + 2]) : 0;
            uint256 triple = (a << 16) | (b << 8) | c;

            // Converte il triplo in 4 caratteri base64
            uint j = 4 * (i / 3);
            output[j] = TABLE[triple >> 18 & 0x3F];
            output[j + 1] = TABLE[triple >> 12 & 0x3F];
            output[j + 2] = i + 1 < data.length ? TABLE[triple >> 6 & 0x3F] : bytes1('=');
            output[j + 3] = i + 2 < data.length ? TABLE[triple & 0x3F] : bytes1('=');
        }

        return string(output);
    }
} 