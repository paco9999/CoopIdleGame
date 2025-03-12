// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./libraries/StatsLib.sol";
import "./interfaces/IIdleProcioneNFT.sol";

/// @title ProfessionsManager
/// @author Il tuo nome
/// @notice Contratto per la gestione delle professioni dei Procioni
/// @dev Implementa un sistema modulare per la gestione delle professioni
contract ProfessionsManager is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // ========== State Variables ==========
    IIdleProcioneNFT public nftContract;
    
    // Limiti per professione (0-15, dove 0 è NONE)
    uint256[16] private professionLimits;
    
    // Tracking degli iscritti per professione
    mapping(uint256 => uint256[]) private professionMembers; // professionId => tokenIds[]
    mapping(uint256 => mapping(uint256 => uint256)) private memberIndex; // professionId => tokenId => index
    
    // Tracking dei livelli per professione
    mapping(uint256 => mapping(uint256 => uint256)) private professionLevels; // professionId => tokenId => level

    // Costanti per le professioni
    uint256 private constant MIN_LEVEL_FOR_PROFESSION = 5;
    uint256 private constant MIN_BREEDING_FOR_PROFESSION = 2;
    uint256 private constant INITIAL_PROFESSION_LEVEL = 1;
    uint256 private constant INITIAL_PROFESSION_EXP = 0;
    uint256 public professionBaseStep;

    // ========== Events ==========
    event ProfessionAssigned(uint256 indexed tokenId, StatsLib.Professions profession);
    event ProfessionRemoved(uint256 indexed tokenId, StatsLib.Professions profession);
    event ProfessionLimitUpdated(StatsLib.Professions indexed profession, uint256 newLimit);
    event NFTContractUpdated(address indexed oldContract, address indexed newContract);
    event ProfessionExpAdded(uint256 indexed tokenId, uint256 expAdded);
    event ProfessionLevelUp(uint256 indexed tokenId, uint256 newLevel);
    event ProfessionBaseStepUpdated(uint256 oldValue, uint256 newValue);

    // ========== Custom Errors ==========
    error InvalidAddress();
    error ProfessionLimitReached();
    error TokenNotExists();
    error NotTokenOwner();
    error ProfessionAlreadyAssigned();
    error InvalidProfessionLimit();
    error ProfessionNotFound();
    error InsufficientLevel();
    error InsufficientBreeding();
    error InsufficientExp();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _nftContract) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_nftContract == address(0)) revert InvalidAddress();
        nftContract = IIdleProcioneNFT(_nftContract);
        
        // Inizializza professionBaseStep
        professionBaseStep = 100;
        
        // Inizializza i limiti di default per ogni professione
        // 0 (NONE) non ha limite
        professionLimits[0] = type(uint256).max;
        for(uint256 i = 1; i < 16; i++) {
            professionLimits[i] = 1000; // Limite di default per ogni professione
        }
    }

    // ========== External Functions ==========
    /// @notice Assegna una professione ad un NFT
    /// @param tokenId ID del token a cui assegnare la professione
    /// @param profession Professione da assegnare
    function assignProfession(uint256 tokenId, StatsLib.Professions profession) external whenNotPaused nonReentrant {
        // Verifica proprietà del token
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        
        // Verifica che il token non abbia già una professione
        (StatsLib.Professions currentProfession,,) = nftContract.getProfessionInfo(tokenId);
        if (currentProfession != StatsLib.Professions.NONE) revert ProfessionAlreadyAssigned();
        
        // Verifica il limite della professione
        uint256 professionId = uint256(profession);
        if (professionMembers[professionId].length >= professionLimits[professionId]) {
            revert ProfessionLimitReached();
        }
        
        // Assegna la professione tramite il contratto NFT
        nftContract.setProfession(tokenId, profession);
        
        // Aggiorna i tracking
        professionMembers[professionId].push(tokenId);
        memberIndex[professionId][tokenId] = professionMembers[professionId].length - 1;
        professionLevels[professionId][tokenId] = 1; // Livello iniziale
        
        emit ProfessionAssigned(tokenId, profession);
    }

    /// @notice Rimuove una professione da un NFT
    /// @param tokenId ID del token da cui rimuovere la professione
    function removeProfession(uint256 tokenId) external onlyOwner {
        // Ottieni la professione attuale
        (StatsLib.Professions currentProfession,,) = nftContract.getProfessionInfo(tokenId);
        if (currentProfession == StatsLib.Professions.NONE) revert ProfessionNotFound();
        
        uint256 professionId = uint256(currentProfession);
        
        // Rimuovi il token dal tracking
        uint256 index = memberIndex[professionId][tokenId];
        uint256 lastTokenId = professionMembers[professionId][professionMembers[professionId].length - 1];
        
        professionMembers[professionId][index] = lastTokenId;
        memberIndex[professionId][lastTokenId] = index;
        professionMembers[professionId].pop();
        
        delete memberIndex[professionId][tokenId];
        delete professionLevels[professionId][tokenId];
        
        // Imposta la professione a NONE nel contratto NFT
        nftContract.setProfession(tokenId, StatsLib.Professions.NONE);
        
        emit ProfessionRemoved(tokenId, currentProfession);
    }

    /// @notice Aggiunge esperienza alla professione di un NFT
    /// @param tokenId ID del token
    /// @param expToAdd Quantità di esperienza da aggiungere
    function addProfessionExp(uint256 tokenId, uint256 expToAdd) external whenNotPaused {
        // Verifica proprietà del token
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        
        // Ottieni i dati attuali
        (StatsLib.Professions profession,, uint256 currentExp) = nftContract.getProfessionInfo(tokenId);
        if (profession == StatsLib.Professions.NONE) revert ProfessionNotFound();
        
        // Calcola la nuova esperienza
        uint256 newExp = currentExp + expToAdd;
        if (newExp > 65535) newExp = 65535; // Limite massimo per 16 bit
        
        // Aggiorna i dati nel contratto NFT
        uint256 data = nftContract.getProcioneData(tokenId);
        data = StatsLib.setProfessionExp(data, newExp);
        nftContract.updateProcioneData(tokenId, data);
        
        emit ProfessionExpAdded(tokenId, expToAdd);
    }

    /// @notice Aumenta di livello la professione di un NFT
    /// @param tokenId ID del token
    function professionLevelUp(uint256 tokenId) external whenNotPaused {
        // Verifica proprietà del token
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        
        // Ottieni i dati attuali
        (StatsLib.Professions profession, uint256 currentLevel, uint256 currentExp) = nftContract.getProfessionInfo(tokenId);
        if (profession == StatsLib.Professions.NONE) revert ProfessionNotFound();
        
        // Calcola exp necessaria per il prossimo livello
        uint256 requiredExp = _calculateRequiredExp(currentLevel);
        if (currentExp < requiredExp) revert InsufficientExp();
        
        // Aggiorna i dati nel contratto NFT
        uint256 data = nftContract.getProcioneData(tokenId);
        data = StatsLib.setProfessionLevel(data, currentLevel + 1);
        data = StatsLib.setProfessionExp(data, INITIAL_PROFESSION_EXP);
        nftContract.updateProcioneData(tokenId, data);
        
        // Aggiorna il tracking dei livelli
        uint256 professionId = uint256(profession);
        professionLevels[professionId][tokenId] = currentLevel + 1;
        
        emit ProfessionLevelUp(tokenId, currentLevel + 1);
    }

    /// @notice Imposta il base step per il calcolo dell'esperienza richiesta
    /// @param _newValue Nuovo valore del base step
    function setProfessionBaseStep(uint256 _newValue) external onlyOwner {
        uint256 oldValue = professionBaseStep;
        professionBaseStep = _newValue;
        emit ProfessionBaseStepUpdated(oldValue, _newValue);
    }

    /// @notice Calcola l'esperienza richiesta per il prossimo livello
    /// @param currentLevel Livello corrente della professione
    /// @return uint256 Esperienza richiesta per il prossimo livello
    function _calculateRequiredExp(uint256 currentLevel) internal view returns (uint256) {
        return professionBaseStep * ((currentLevel + 1) ** 2);
    }

    /// @notice Verifica i requisiti per ottenere una professione
    /// @param tokenId ID del token da verificare
    function _checkProfessionRequirements(uint256 tokenId) internal view {
        uint256 data = nftContract.getProcioneData(tokenId);
        
        // Verifica che il procione non abbia già una professione
        if (StatsLib.getProfession(data) != StatsLib.Professions.NONE) revert ProfessionAlreadyAssigned();
        
        // Verifica il livello minimo
        if (StatsLib.getLevel(data) < MIN_LEVEL_FOR_PROFESSION) revert InsufficientLevel();
        
        // Verifica il numero minimo di breeding
        // TODO: Implementare la verifica del breeding quando sarà disponibile l'interfaccia
    }

    // ========== View Functions ==========
    /// @notice Ottiene tutti i token assegnati ad una professione
    /// @param profession Professione di cui ottenere i membri
    /// @return tokenIds Array di token ID ordinati per livello decrescente
    function getProfessionMembers(StatsLib.Professions profession) external view returns (uint256[] memory) {
        uint256 professionId = uint256(profession);
        uint256[] memory tokenIds = professionMembers[professionId];
        uint256 length = tokenIds.length;
        
        if (length == 0) {
            return new uint256[](0);
        }
        
        // Crea una copia dell'array per l'ordinamento
        uint256[] memory sortedTokenIds = new uint256[](length);
        for(uint256 i = 0; i < length; i++) {
            sortedTokenIds[i] = tokenIds[i];
        }
        
        // Ordina per livello decrescente
        for(uint256 i = 0; i < length - 1; i++) {
            for(uint256 j = 0; j < length - i - 1; j++) {
                if (professionLevels[professionId][sortedTokenIds[j]] < professionLevels[professionId][sortedTokenIds[j + 1]]) {
                    uint256 temp = sortedTokenIds[j];
                    sortedTokenIds[j] = sortedTokenIds[j + 1];
                    sortedTokenIds[j + 1] = temp;
                }
            }
        }
        
        return sortedTokenIds;
    }

    /// @notice Ottiene il limite attuale per una professione
    /// @param profession Professione di cui ottenere il limite
    /// @return limit Limite attuale della professione
    function getProfessionLimit(StatsLib.Professions profession) external view returns (uint256) {
        return professionLimits[uint256(profession)];
    }

    /// @notice Ottiene il numero attuale di membri di una professione
    /// @param profession Professione di cui ottenere il conteggio
    /// @return count Numero di membri attuali
    function getProfessionMemberCount(StatsLib.Professions profession) external view returns (uint256) {
        return professionMembers[uint256(profession)].length;
    }

    // ========== Admin Functions ==========
    /// @notice Imposta il limite per una professione
    /// @param profession Professione di cui impostare il limite
    /// @param newLimit Nuovo limite da impostare
    function setProfessionLimit(StatsLib.Professions profession, uint256 newLimit) external onlyOwner {
        uint256 professionId = uint256(profession);
        if (professionId == 0) revert InvalidProfessionLimit(); // Non si può limitare NONE
        if (newLimit < professionMembers[professionId].length) revert InvalidProfessionLimit();
        
        professionLimits[professionId] = newLimit;
        emit ProfessionLimitUpdated(profession, newLimit);
    }

    /// @notice Aggiorna l'indirizzo del contratto NFT
    /// @param _newContract Nuovo indirizzo del contratto
    function setNFTContract(address _newContract) external onlyOwner {
        if (_newContract == address(0)) revert InvalidAddress();
        address oldContract = address(nftContract);
        nftContract = IIdleProcioneNFT(_newContract);
        emit NFTContractUpdated(oldContract, _newContract);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========== Internal Functions ==========
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 