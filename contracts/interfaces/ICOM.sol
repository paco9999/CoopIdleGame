// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICOM
/// @notice Interfaccia per il token COM
interface ICOM {
    /// @notice Trasferisce token da un indirizzo a un altro
    /// @param from Indirizzo del mittente
    /// @param to Indirizzo del destinatario
    /// @param amount Quantità di token da trasferire
    /// @return success True se il trasferimento è avvenuto con successo
    function transferFrom(address from, address to, uint256 amount) external returns (bool success);
    
    /// @notice Verifica il saldo di un indirizzo
    /// @param account Indirizzo da verificare
    /// @return amount Saldo dell'indirizzo
    function balanceOf(address account) external view returns (uint256 amount);
    
    /// @notice Verifica l'allowance di un indirizzo verso un altro
    /// @param owner Proprietario dei token
    /// @param spender Indirizzo autorizzato a spendere
    /// @return amount Quantità di token autorizzata
    function allowance(address owner, address spender) external view returns (uint256 amount);
} 