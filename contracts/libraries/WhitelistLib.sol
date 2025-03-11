// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WhitelistLib
/// @notice Libreria per la gestione della whitelist dei procioni
/// @dev Implementa un sistema di whitelist a due fasi con gestione dei prezzi
library WhitelistLib {
    // ========== Custom Errors ==========
    error WalletLimitReached();
    error NotWhitelisted();
    error FreePhase();
    error InsufficientPayment();
    error NoActivePhase();
    error BatchTooLarge();
    error ArrayLengthMismatch();

    // ========== Structs ==========
    /// @notice Struttura per gestire i dati della whitelist
    struct WhitelistData {
        // Mapping per le fasi della whitelist
        mapping(address => bool) whitelistPhase1;
        mapping(address => bool) whitelistPhase2;
        
        // Mapping per tracciare i mint per wallet
        mapping(address => uint256) mintedPerWallet;
        
        // Stato delle fasi
        bool isPhase1Active;
        bool isPhase2Active;
        
        // Prezzo per il mint in fase 2
        uint256 price;
    }

    // ========== Events ==========
    /// @notice Evento emesso quando viene aggiornato il prezzo
    event PriceUpdated(uint256 newPrice);

    /// @notice Evento emesso quando viene aggiornato lo stato di una fase
    event PhaseStatusUpdated(uint256 phase, bool isActive);

    // ========== Public Functions ==========
    /// @notice Imposta lo stato degli indirizzi nella whitelist fase 1
    /// @param self Struttura dei dati della whitelist
    /// @param addresses Array di indirizzi da aggiornare
    /// @param status Nuovo stato da impostare
    function setWhitelistPhase1(
        WhitelistData storage self,
        address[] calldata addresses,
        bool status
    ) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            self.whitelistPhase1[addresses[i]] = status;
        }
    }

    /// @notice Imposta lo stato degli indirizzi nella whitelist fase 2
    /// @param self Struttura dei dati della whitelist
    /// @param addresses Array di indirizzi da aggiornare
    /// @param status Nuovo stato da impostare
    function setWhitelistPhase2(
        WhitelistData storage self,
        address[] calldata addresses,
        bool status
    ) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            self.whitelistPhase2[addresses[i]] = status;
        }
    }

    /// @notice Imposta lo stato di una fase specifica
    /// @param self Struttura dei dati della whitelist
    /// @param phase Numero della fase (1 o 2)
    /// @param status Nuovo stato da impostare
    /// @return bool Indica se l'operazione è riuscita
    function setPhaseStatus(
        WhitelistData storage self,
        uint256 phase,
        bool status
    ) internal returns (bool) {
        if (phase == 1) {
            self.isPhase1Active = status;
            if (status) self.isPhase2Active = false;
        } else if (phase == 2) {
            self.isPhase2Active = status;
            if (status) self.isPhase1Active = false;
        }
        emit PhaseStatusUpdated(phase, status);
        return true;
    }

    /// @notice Imposta il prezzo per il mint in fase 2
    /// @param self Struttura dei dati della whitelist
    /// @param _price Nuovo prezzo da impostare
    /// @return bool Indica se l'operazione è riuscita
    function setPrice(WhitelistData storage self, uint256 _price) internal returns (bool) {
        self.price = _price;
        emit PriceUpdated(_price);
        return true;
    }

    /// @notice Imposta lo stato di più indirizzi in entrambe le fasi
    /// @param self Struttura dei dati della whitelist
    /// @param addresses Array di indirizzi da aggiornare
    /// @param phase1Status Array di stati per la fase 1
    /// @param phase2Status Array di stati per la fase 2
    function setWhitelistBatch(
        WhitelistData storage self,
        address[] calldata addresses,
        bool[] calldata phase1Status,
        bool[] calldata phase2Status
    ) internal {
        if (addresses.length > 1000) revert BatchTooLarge();
        if (addresses.length != phase1Status.length || addresses.length != phase2Status.length) {
            revert ArrayLengthMismatch();
        }
        
        for (uint256 i = 0; i < addresses.length; i++) {
            self.whitelistPhase1[addresses[i]] = phase1Status[i];
            self.whitelistPhase2[addresses[i]] = phase2Status[i];
        }
    }

    /// @notice Verifica le condizioni per il mint
    /// @param self Struttura dei dati della whitelist
    /// @param sender Indirizzo del mittente
    /// @param value Valore della transazione
    /// @param mintPerWallet Limite di mint per wallet
    /// @return bool Indica se il mint è possibile
    function checkMintConditions(
        WhitelistData storage self,
        address sender,
        uint256 value,
        uint256 mintPerWallet
    ) internal view returns (bool) {
        if (self.mintedPerWallet[sender] >= mintPerWallet) revert WalletLimitReached();

        if (self.isPhase1Active) {
            if (!self.whitelistPhase1[sender]) revert NotWhitelisted();
            if (value != 0) revert FreePhase();
        } else if (self.isPhase2Active) {
            if (!self.whitelistPhase2[sender]) revert NotWhitelisted();
            if (value < self.price) revert InsufficientPayment();
        } else {
            revert NoActivePhase();
        }

        return true;
    }

    /// @notice Ottiene le informazioni di mint per un wallet
    /// @param self Struttura dei dati della whitelist
    /// @param wallet Indirizzo del wallet
    /// @param mintPerWallet Limite di mint per wallet
    /// @return isWhitelistedPhase1 Indica se il wallet è nella whitelist fase 1
    /// @return isWhitelistedPhase2 Indica se il wallet è nella whitelist fase 2
    /// @return mintedAmount Numero di mint effettuati
    /// @return remainingMints Numero di mint rimanenti
    function getMintInfo(
        WhitelistData storage self,
        address wallet,
        uint256 mintPerWallet
    ) internal view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    ) {
        return (
            self.whitelistPhase1[wallet],
            self.whitelistPhase2[wallet],
            self.mintedPerWallet[wallet],
            mintPerWallet - self.mintedPerWallet[wallet]
        );
    }
} 