// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title WhitelistLibTestLib
/// @notice Versione della libreria WhitelistLib per i test
/// @dev Implementa le stesse funzionalità ma con visibilità public
library WhitelistLibTestLib {
    // ========== Structs ==========
    struct WhitelistData {
        // Mapping per le whitelist
        mapping(address => bool) phase1Whitelist;
        mapping(address => bool) phase2Whitelist;
        
        // Mapping per il conteggio dei mint
        mapping(address => uint256) mintCount;
        
        // Prezzi per fase
        uint256 phase1Price;
        uint256 phase2Price;
        
        // Limiti per fase
        uint256 phase1MaxMint;
        uint256 phase2MaxMint;
        
        // Stato delle fasi
        bool phase1Active;
        bool phase2Active;
    }

    // ========== Events ==========
    event WhitelistUpdated(address indexed account, uint8 phase, bool status);
    event PhaseStatusUpdated(uint8 phase, bool status);
    event PriceUpdated(uint8 phase, uint256 newPrice);
    event MaxMintUpdated(uint8 phase, uint256 newMaxMint);
    event MintCountIncremented(address indexed account);

    // ========== Errors ==========
    error InvalidPhase();
    error InvalidPrice();
    error InvalidMaxMint();
    error NotWhitelisted();
    error MaxMintReached();
    error PhaseNotActive();

    // ========== Public Functions ==========
    /// @notice Aggiunge un account alla whitelist di una fase
    /// @param data Struttura dei dati da aggiornare
    /// @param account Indirizzo da aggiungere
    /// @param phase Fase della whitelist (1 o 2)
    function addToWhitelist(
        WhitelistData storage data,
        address account,
        uint8 phase
    ) public {
        if (phase == 1) {
            data.phase1Whitelist[account] = true;
        } else if (phase == 2) {
            data.phase2Whitelist[account] = true;
        } else {
            revert InvalidPhase();
        }
        emit WhitelistUpdated(account, phase, true);
    }

    /// @notice Rimuove un account dalla whitelist di una fase
    /// @param data Struttura dei dati da aggiornare
    /// @param account Indirizzo da rimuovere
    /// @param phase Fase della whitelist (1 o 2)
    function removeFromWhitelist(
        WhitelistData storage data,
        address account,
        uint8 phase
    ) public {
        if (phase == 1) {
            data.phase1Whitelist[account] = false;
        } else if (phase == 2) {
            data.phase2Whitelist[account] = false;
        } else {
            revert InvalidPhase();
        }
        emit WhitelistUpdated(account, phase, false);
    }

    /// @notice Imposta lo stato di una fase
    /// @param data Struttura dei dati da aggiornare
    /// @param phase Fase da aggiornare (1 o 2)
    /// @param status Nuovo stato della fase
    function setPhaseStatus(
        WhitelistData storage data,
        uint8 phase,
        bool status
    ) public {
        if (phase == 1) {
            data.phase1Active = status;
        } else if (phase == 2) {
            data.phase2Active = status;
        } else {
            revert InvalidPhase();
        }
        emit PhaseStatusUpdated(phase, status);
    }

    /// @notice Imposta il prezzo per una fase
    /// @param data Struttura dei dati da aggiornare
    /// @param phase Fase da aggiornare (1 o 2)
    /// @param price Nuovo prezzo
    function setPrice(
        WhitelistData storage data,
        uint8 phase,
        uint256 price
    ) public {
        if (price == 0) revert InvalidPrice();
        
        if (phase == 1) {
            data.phase1Price = price;
        } else if (phase == 2) {
            data.phase2Price = price;
        } else {
            revert InvalidPhase();
        }
        emit PriceUpdated(phase, price);
    }

    /// @notice Imposta il numero massimo di mint per una fase
    /// @param data Struttura dei dati da aggiornare
    /// @param phase Fase da aggiornare (1 o 2)
    /// @param maxMint Nuovo limite massimo
    function setMaxMint(
        WhitelistData storage data,
        uint8 phase,
        uint256 maxMint
    ) public {
        if (maxMint == 0) revert InvalidMaxMint();
        
        if (phase == 1) {
            data.phase1MaxMint = maxMint;
        } else if (phase == 2) {
            data.phase2MaxMint = maxMint;
        } else {
            revert InvalidPhase();
        }
        emit MaxMintUpdated(phase, maxMint);
    }

    /// @notice Verifica se un account è nella whitelist di una fase
    /// @param data Struttura dei dati da verificare
    /// @param account Indirizzo da verificare
    /// @param phase Fase da verificare (1 o 2)
    /// @return bool True se l'account è nella whitelist
    function isWhitelisted(
        WhitelistData storage data,
        address account,
        uint8 phase
    ) public view returns (bool) {
        if (phase == 1) {
            return data.phase1Whitelist[account];
        } else if (phase == 2) {
            return data.phase2Whitelist[account];
        } else {
            revert InvalidPhase();
        }
    }

    /// @notice Verifica se una fase è attiva
    /// @param data Struttura dei dati da verificare
    /// @param phase Fase da verificare (1 o 2)
    /// @return bool True se la fase è attiva
    function isPhaseActive(
        WhitelistData storage data,
        uint8 phase
    ) public view returns (bool) {
        if (phase == 1) {
            return data.phase1Active;
        } else if (phase == 2) {
            return data.phase2Active;
        } else {
            revert InvalidPhase();
        }
    }

    /// @notice Ottiene il prezzo per una fase
    /// @param data Struttura dei dati da verificare
    /// @param phase Fase da verificare (1 o 2)
    /// @return uint256 Prezzo della fase
    function getPrice(
        WhitelistData storage data,
        uint8 phase
    ) public view returns (uint256) {
        if (phase == 1) {
            return data.phase1Price;
        } else if (phase == 2) {
            return data.phase2Price;
        } else {
            revert InvalidPhase();
        }
    }

    /// @notice Ottiene il numero massimo di mint per una fase
    /// @param data Struttura dei dati da verificare
    /// @param phase Fase da verificare (1 o 2)
    /// @return uint256 Limite massimo di mint
    function getMaxMint(
        WhitelistData storage data,
        uint8 phase
    ) public view returns (uint256) {
        if (phase == 1) {
            return data.phase1MaxMint;
        } else if (phase == 2) {
            return data.phase2MaxMint;
        } else {
            revert InvalidPhase();
        }
    }

    /// @notice Ottiene il numero di mint effettuati da un account
    /// @param data Struttura dei dati da verificare
    /// @param account Indirizzo da verificare
    /// @return uint256 Numero di mint effettuati
    function getMintCount(
        WhitelistData storage data,
        address account
    ) public view returns (uint256) {
        return data.mintCount[account];
    }

    /// @notice Incrementa il contatore dei mint per un account
    /// @param data Struttura dei dati da aggiornare
    /// @param account Indirizzo da aggiornare
    function incrementMintCount(
        WhitelistData storage data,
        address account
    ) public {
        data.mintCount[account]++;
        emit MintCountIncremented(account);
    }

    /// @notice Verifica le condizioni per il mint
    /// @param data Struttura dei dati da verificare
    /// @param account Indirizzo che vuole effettuare il mint
    /// @return uint256 Prezzo del mint
    function checkMintConditions(
        WhitelistData storage data,
        address account
    ) public view returns (uint256) {
        if (data.phase1Active && data.phase1Whitelist[account]) {
            if (data.mintCount[account] >= data.phase1MaxMint) revert MaxMintReached();
            return data.phase1Price;
        } else if (data.phase2Active && data.phase2Whitelist[account]) {
            if (data.mintCount[account] >= data.phase2MaxMint) revert MaxMintReached();
            return data.phase2Price;
        }
        revert NotWhitelisted();
    }

    /// @notice Ottiene le informazioni sul mint per un account
    /// @param data Struttura dei dati da verificare
    /// @param account Indirizzo da verificare
    /// @return bool Indica se l'account può effettuare il mint
    /// @return uint256 Prezzo del mint
    /// @return uint256 Numero di mint rimanenti
    function getMintInfo(
        WhitelistData storage data,
        address account
    ) public view returns (bool, uint256, uint256) {
        bool canMint;
        uint256 price;
        uint256 remainingMints;

        if (data.phase1Active && data.phase1Whitelist[account]) {
            canMint = data.mintCount[account] < data.phase1MaxMint;
            price = data.phase1Price;
            remainingMints = data.phase1MaxMint - data.mintCount[account];
        } else if (data.phase2Active && data.phase2Whitelist[account]) {
            canMint = data.mintCount[account] < data.phase2MaxMint;
            price = data.phase2Price;
            remainingMints = data.phase2MaxMint - data.mintCount[account];
        }

        return (canMint, price, remainingMints);
    }
} 