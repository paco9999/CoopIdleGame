// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/StatsLib.sol";

/// @title IIdleProcioneNFT
/// @notice Interfaccia per il contratto principale degli NFT Procione
interface IIdleProcioneNFT {
    /// @notice Restituisce il proprietario di un token
    /// @param tokenId ID del token
    /// @return address Indirizzo del proprietario
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Restituisce i dati di un procione
    /// @param tokenId ID del token
    /// @return uint256 Dati del procione in formato packed
    function getProcioneData(uint256 tokenId) external view returns (uint256);

    /// @notice Aggiorna i dati di un procione
    /// @param tokenId ID del token
    /// @param newData Nuovi dati del procione
    function updateProcioneData(uint256 tokenId, uint256 newData) external;

    /// @notice Crea un nuovo procione da un uovo
    /// @param to Indirizzo del destinatario
    /// @param genetics Genetica del procione
    /// @param class Classe del procione
    /// @param faction Fazione del procione
    /// @return uint256 ID del nuovo procione
    function mintFromEgg(address to, uint256 genetics, uint256 class, uint256 faction) external returns (uint256);

    /// @notice Esegue il breeding di due procioni
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    /// @return uint256 ID del nuovo procione
    function breed(uint256 parent1Id, uint256 parent2Id) external returns (uint256);

    /// @notice Restituisce le informazioni di professione di un procione
    /// @param tokenId ID del token
    /// @return StatsLib.Professions Professione del procione
    /// @return uint256 Livello della professione
    /// @return uint256 XP accumulato per la professione
    function getProfessionInfo(uint256 tokenId) external view returns (StatsLib.Professions, uint256, uint256);

    /// @notice Aggiorna la professione di un procione
    /// @param tokenId ID del token
    /// @param profession Nuova professione del procione
    function setProfession(uint256 tokenId, StatsLib.Professions profession) external;

    /// @notice Modifica la salute corrente di un procione
    /// @param tokenId ID del token
    /// @param amount Quantità di salute da modificare
    /// @param isAddition True se aggiungere salute, False se sottrarre
    function modifyCurrentHealth(uint256 tokenId, uint256 amount, bool isAddition) external;

    /// @notice Helper function per impostare il livello di un procione
    /// @param data I dati attuali del procione
    /// @param level Il nuovo livello da impostare
    /// @return I dati aggiornati del procione
    function setLevel(uint256 data, uint256 level) external pure returns (uint256);

    /// @notice Restituisce tutte le statistiche di un procione
    /// @param tokenId ID del token
    /// @return xp Esperienza totale
    /// @return level Livello attuale
    /// @return health Salute massima
    /// @return strength Forza
    /// @return speed Velocità
    /// @return intelligence Intelligenza
    /// @return accuracy Precisione
    /// @return breeding Slot breeding disponibili
    function getProcioneStats(uint256 tokenId) external view returns (
        uint256 xp,
        uint256 level,
        uint256 health,
        uint256 strength,
        uint256 speed,
        uint256 intelligence,
        uint256 accuracy,
        uint256 breeding
    );

    /// @notice Restituisce le fazioni disponibili
    /// @return array Array delle fazioni disponibili
    function getAvailableFactions() external view returns (uint256[5] memory);

    /// @notice Restituisce le classi disponibili
    /// @return array Array delle classi disponibili
    function getAvailableClasses() external view returns (uint256[6] memory);

    /// @notice Restituisce le informazioni sul minting per un wallet
    /// @param wallet Indirizzo del wallet
    /// @return isWhitelistedPhase1 Se il wallet è in whitelist fase 1
    /// @return isWhitelistedPhase2 Se il wallet è in whitelist fase 2
    /// @return mintedAmount Numero di token mintati
    /// @return remainingMints Mint rimanenti disponibili
    function getMintInfo(address wallet) external view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    );

    /// @notice Restituisce il numero di mint casuali effettuati
    /// @return uint256 Numero di mint casuali
    function getRandomMintCount() external view returns (uint256);

    /// @notice Restituisce il totale dei token esistenti
    /// @return uint256 Totale dei token
    function getTotalSupply() external view returns (uint256);

    /// @notice Restituisce i limiti massimi di generazione
    /// @return maxFacGen Limite massimo generazione fazioni
    /// @return maxClassGen Limite massimo generazione classi
    function getMaxGenLimits() external view returns (uint256 maxFacGen, uint256 maxClassGen);

    /// @notice Mette in pausa il contratto
    function pause() external;

    /// @notice Riattiva il contratto
    function unpause() external;
} 