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
    
    // Core Contract References
    IIdleProcioneNFT public nftContract;
    
    // General Profession Management
    uint256[16] private professionLimits;
    mapping(uint256 => uint256[]) private professionMembers;
    mapping(uint256 => mapping(uint256 => uint256)) private memberIndex;
    mapping(uint256 => mapping(uint256 => uint256)) private professionLevels;
    uint256 public professionBaseStep;

    // Profession Level Limits
    mapping(uint256 => uint256) private professionMaxLevels;
    uint256 private constant DEFAULT_MAX_LEVEL = 100;

    // Artisan Specific Variables
    address public craftingManager;
    mapping(uint256 => uint256) private artisanLockedSlots;
    mapping(uint256 => mapping(uint256 => uint256)) private artisanSlotUnlockTime;

    // Medic Specific Variables
    address public medicManager;
    mapping(uint256 => uint256) private medicCooldowns; // tokenId => timestamp di fine cooldown

    // Thief Specific Variables
    address public thiefManager;
    mapping(uint256 => uint256) private thiefAbilityCooldowns; // tokenId => timestamp di fine cooldown

    // Constants
    uint256 private constant MIN_LEVEL_FOR_PROFESSION = 5;
    uint256 private constant MIN_BREEDING_FOR_PROFESSION = 2;
    uint256 private constant INITIAL_PROFESSION_LEVEL = 1;
    uint256 private constant INITIAL_PROFESSION_EXP = 0;
    uint256 private constant HOURS_TO_SECONDS = 3600;

    // ========== Events ==========
    // General Events
    event ProfessionAssigned(uint256 indexed tokenId, StatsLib.Professions profession);
    event ProfessionRemoved(uint256 indexed tokenId, StatsLib.Professions profession);
    event ProfessionLimitUpdated(StatsLib.Professions indexed profession, uint256 newLimit);
    event NFTContractUpdated(address indexed oldContract, address indexed newContract);
    event ProfessionExpAdded(uint256 indexed tokenId, uint256 expAdded);
    event ProfessionLevelUp(uint256 indexed tokenId, uint256 newLevel);
    event ProfessionBaseStepUpdated(uint256 oldValue, uint256 newValue);
    event ProfessionMaxLevelUpdated(StatsLib.Professions indexed profession, uint256 maxLevel);

    // Artisan Specific Events
    event CraftingManagerUpdated(address indexed oldManager, address indexed newManager);
    event CraftingSlotLocked(uint256 indexed tokenId, uint256 slotIndex, uint256 unlockTime);
    event CraftingSlotUnlocked(uint256 indexed tokenId, uint256 slotIndex);
    event CraftingSlotsUpdated(uint256 indexed tokenId, uint256 slots);
    event ArtisanLevelUpdated(uint256 indexed tokenId, uint256 level);

    // Medic Specific Events
    event MedicManagerUpdated(address indexed oldManager, address indexed newManager);
    event MedicCooldownActivated(uint256 indexed tokenId, uint256 cooldownEnd);
    event MedicCooldownExpired(uint256 indexed tokenId);

    // Thief Specific Events
    event ThiefManagerUpdated(address indexed oldManager, address indexed newManager);
    event ThiefAbilityCooldownActivated(uint256 indexed tokenId, uint256 cooldownEnd);
    event ThiefAbilityCooldownExpired(uint256 indexed tokenId);

    // ========== Custom Errors ==========
    // General Errors
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

    // Artisan Specific Errors
    error UnauthorizedCaller();
    error NoFreeCraftingSlots();
    error InvalidProfession();
    error InvalidSlotIndex();
    error SlotAlreadyUnlocked();
    error InvalidSlotCount();
    error InvalidLevel();

    // Medic Specific Errors
    error NotMedicManager();
    error NotMedic();
    error MedicOnCooldown();

    // Thief Specific Errors
    error NotThiefManager();
    error NotThief();
    error ThiefOnCooldown();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ========== Initializer ==========
    function initialize(address _nftContract) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_nftContract == address(0)) revert InvalidAddress();
        nftContract = IIdleProcioneNFT(_nftContract);
        
        professionBaseStep = 100;
        
        professionLimits[0] = type(uint256).max;
        for(uint256 i = 1; i < 16; i++) {
            professionLimits[i] = 1000;
        }

        // Imposta il livello massimo per il Thief a 20
        professionMaxLevels[uint256(StatsLib.Professions.THIEF)] = 20;
        emit ProfessionMaxLevelUpdated(StatsLib.Professions.THIEF, 20);
    }

    // ========== General Profession Functions ==========

    function assignProfession(uint256 tokenId, StatsLib.Professions profession) external whenNotPaused nonReentrant {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        
        (StatsLib.Professions currentProfession,,) = nftContract.getProfessionInfo(tokenId);
        if (currentProfession != StatsLib.Professions.NONE) revert ProfessionAlreadyAssigned();
        
        uint256 professionId = uint256(profession);
        if (professionMembers[professionId].length >= professionLimits[professionId]) {
            revert ProfessionLimitReached();
        }
        
        nftContract.setProfession(tokenId, profession);
        
        professionMembers[professionId].push(tokenId);
        memberIndex[professionId][tokenId] = professionMembers[professionId].length - 1;
        professionLevels[professionId][tokenId] = 1;
        
        emit ProfessionAssigned(tokenId, profession);
    }

    function removeProfession(uint256 tokenId) external onlyOwner {
        (StatsLib.Professions currentProfession,,) = nftContract.getProfessionInfo(tokenId);
        if (currentProfession == StatsLib.Professions.NONE) revert ProfessionNotFound();
        
        uint256 professionId = uint256(currentProfession);
        
        uint256 index = memberIndex[professionId][tokenId];
        uint256 lastTokenId = professionMembers[professionId][professionMembers[professionId].length - 1];
        
        professionMembers[professionId][index] = lastTokenId;
        memberIndex[professionId][lastTokenId] = index;
        professionMembers[professionId].pop();
        
        delete memberIndex[professionId][tokenId];
        delete professionLevels[professionId][tokenId];
        
        nftContract.setProfession(tokenId, StatsLib.Professions.NONE);
        
        emit ProfessionRemoved(tokenId, currentProfession);
    }

    function addProfessionExp(uint256 tokenId, uint256 expToAdd) external whenNotPaused {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        
        (StatsLib.Professions profession,, uint256 currentExp) = nftContract.getProfessionInfo(tokenId);
        if (profession == StatsLib.Professions.NONE) revert ProfessionNotFound();
        
        uint256 newExp = currentExp + expToAdd;
        if (newExp > 65535) newExp = 65535;
        
        uint256 data = nftContract.getProcioneData(tokenId);
        data = StatsLib.setProfessionExp(data, newExp);
        nftContract.updateProcioneData(tokenId, data);
        
        emit ProfessionExpAdded(tokenId, expToAdd);
    }

    function professionLevelUp(uint256 tokenId) external whenNotPaused {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        
        (StatsLib.Professions profession, uint256 currentLevel, uint256 currentExp) = nftContract.getProfessionInfo(tokenId);
        if (profession == StatsLib.Professions.NONE) revert ProfessionNotFound();
        
        // Check if next level would exceed max level
        if (!isValidProfessionLevel(profession, currentLevel + 1)) revert InvalidLevel();
        
        uint256 requiredExp = _calculateRequiredExp(currentLevel);
        if (currentExp < requiredExp) revert InsufficientExp();
        
        uint256 data = nftContract.getProcioneData(tokenId);
        data = StatsLib.setProfessionLevel(data, currentLevel + 1);
        data = StatsLib.setProfessionExp(data, INITIAL_PROFESSION_EXP);
        nftContract.updateProcioneData(tokenId, data);
        
        uint256 professionId = uint256(profession);
        professionLevels[professionId][tokenId] = currentLevel + 1;
        
        emit ProfessionLevelUp(tokenId, currentLevel + 1);
    }

    // ========== Artisan Specific Functions ==========

    function _getArtisanTotalSlots(uint256 level) internal pure returns (uint256) {
        if (level == 1) return 1;
        if (level == 2) return 2;
        if (level == 3) return 4;
        if (level == 4) return 6;
        if (level == 5) return 10;
        return 0;
    }

    function getFreeCraftingSlots(uint256 tokenId) external view returns (uint256) {
        (StatsLib.Professions profession, uint256 level,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.ARTISAN) revert InvalidProfession();
        
        uint256 totalSlots = _getArtisanTotalSlots(level);
        uint256 lockedSlots = artisanLockedSlots[tokenId];
        
        uint256 currentLockedSlots = lockedSlots;
        for (uint256 i = 0; i < lockedSlots; i++) {
            if (artisanSlotUnlockTime[tokenId][i] <= block.timestamp) {
                currentLockedSlots--;
            }
        }
        
        return totalSlots - currentLockedSlots;
    }

    function lockCraftingSlot(uint256 tokenId, uint256 duration) external {
        if (msg.sender != craftingManager) revert UnauthorizedCaller();
        
        (StatsLib.Professions profession, uint256 level,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.ARTISAN) revert InvalidProfession();
        
        uint256 totalSlots = _getArtisanTotalSlots(level);
        uint256 lockedSlots = artisanLockedSlots[tokenId];
        
        uint256 currentLockedSlots = lockedSlots;
        uint256 firstFreeSlotIndex = lockedSlots;
        
        for (uint256 i = 0; i < lockedSlots; i++) {
            if (artisanSlotUnlockTime[tokenId][i] <= block.timestamp) {
                currentLockedSlots--;
                if (i < firstFreeSlotIndex) {
                    firstFreeSlotIndex = i;
                }
            }
        }
        
        if (currentLockedSlots >= totalSlots) revert NoFreeCraftingSlots();
        
        artisanLockedSlots[tokenId] = currentLockedSlots + 1;
        artisanSlotUnlockTime[tokenId][firstFreeSlotIndex] = block.timestamp + duration;
        
        emit CraftingSlotLocked(tokenId, firstFreeSlotIndex, block.timestamp + duration);
    }

    /// @notice Sblocca uno slot di crafting di un artigiano
    /// @param tokenId ID del token dell'artigiano
    /// @param slotIndex Indice dello slot da sbloccare
    function unlockCraftingSlot(uint256 tokenId, uint256 slotIndex) external {
        if (msg.sender != craftingManager) revert UnauthorizedCaller();
        
        (StatsLib.Professions profession,,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.ARTISAN) revert InvalidProfession();
        
        if (slotIndex >= artisanLockedSlots[tokenId]) revert InvalidSlotIndex();
        if (artisanSlotUnlockTime[tokenId][slotIndex] == 0) revert SlotAlreadyUnlocked();
        
        artisanLockedSlots[tokenId]--;
        artisanSlotUnlockTime[tokenId][slotIndex] = 0;
        
        emit CraftingSlotUnlocked(tokenId, slotIndex);
    }

    /// @notice Imposta il numero di slot disponibili per un artigiano
    /// @param tokenId ID del token dell'artigiano
    /// @param slots Numero di slot da impostare
    function setAvailableCraftingSlots(uint256 tokenId, uint256 slots) external {
        if (msg.sender != craftingManager) revert UnauthorizedCaller();
        
        (StatsLib.Professions profession, uint256 level,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.ARTISAN) revert InvalidProfession();
        
        uint256 maxSlots = _getArtisanTotalSlots(level);
        if (slots > maxSlots) revert InvalidSlotCount();
        
        // Resetta gli slot bloccati
        artisanLockedSlots[tokenId] = maxSlots - slots;
        for (uint256 i = 0; i < maxSlots; i++) {
            artisanSlotUnlockTime[tokenId][i] = 0;
        }
        
        emit CraftingSlotsUpdated(tokenId, slots);
    }

    /// @notice Ottiene il livello di un artigiano
    /// @param tokenId ID del token dell'artigiano
    /// @return Livello dell'artigiano
    function getArtisanLevel(uint256 tokenId) external view returns (uint256) {
        (StatsLib.Professions profession, uint256 level,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.ARTISAN) revert InvalidProfession();
        return level;
    }

    /// @notice Imposta il livello di un artigiano
    /// @param tokenId ID del token dell'artigiano
    /// @param level Nuovo livello
    function setArtisanLevel(uint256 tokenId, uint256 level) external {
        if (msg.sender != craftingManager) revert UnauthorizedCaller();
        
        (StatsLib.Professions profession,,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.ARTISAN) revert InvalidProfession();
        if (level == 0 || level > 5) revert InvalidLevel();
        
        uint256 data = nftContract.getProcioneData(tokenId);
        data = StatsLib.setProfessionLevel(data, level);
        nftContract.updateProcioneData(tokenId, data);
        
        emit ArtisanLevelUpdated(tokenId, level);
    }

    // ========== View Functions ==========

    function getProfessionMembers(StatsLib.Professions profession) external view returns (uint256[] memory) {
        uint256 professionId = uint256(profession);
        uint256[] memory tokenIds = professionMembers[professionId];
        uint256 length = tokenIds.length;
        
        if (length == 0) {
            return new uint256[](0);
        }
        
        uint256[] memory sortedTokenIds = new uint256[](length);
        for(uint256 i = 0; i < length; i++) {
            sortedTokenIds[i] = tokenIds[i];
        }
        
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

    function getProfessionLimit(StatsLib.Professions profession) external view returns (uint256) {
        return professionLimits[uint256(profession)];
    }

    function getProfessionMemberCount(StatsLib.Professions profession) external view returns (uint256) {
        return professionMembers[uint256(profession)].length;
    }

    // ========== Level Limit Functions ==========

    /// @notice Imposta il limite massimo di livello per una professione
    /// @param profession La professione per cui impostare il limite
    /// @param maxLevel Il nuovo limite massimo di livello
    function setProfessionMaxLevel(StatsLib.Professions profession, uint256 maxLevel) external onlyOwner {
        if (maxLevel == 0) revert InvalidLevel();
        professionMaxLevels[uint256(profession)] = maxLevel;
        emit ProfessionMaxLevelUpdated(profession, maxLevel);
    }

    /// @notice Ottiene il limite massimo di livello per una professione
    /// @param profession La professione di cui ottenere il limite
    /// @return Il limite massimo di livello per la professione
    function getProfessionMaxLevel(StatsLib.Professions profession) public view returns (uint256) {
        uint256 maxLevel = professionMaxLevels[uint256(profession)];
        return maxLevel == 0 ? DEFAULT_MAX_LEVEL : maxLevel;
    }

    /// @notice Verifica se un livello è valido per una professione
    /// @param profession La professione da verificare
    /// @param level Il livello da verificare
    /// @return true se il livello è valido, false altrimenti
    function isValidProfessionLevel(StatsLib.Professions profession, uint256 level) public view returns (bool) {
        if (profession == StatsLib.Professions.ARTISAN) {
            return level > 0 && level <= 5;
        }
        return level > 0 && level <= getProfessionMaxLevel(profession);
    }

    // ========== Admin Functions ==========

    function setProfessionLimit(StatsLib.Professions profession, uint256 newLimit) external onlyOwner {
        uint256 professionId = uint256(profession);
        if (professionId == 0) revert InvalidProfessionLimit();
        if (newLimit < professionMembers[professionId].length) revert InvalidProfessionLimit();
        
        professionLimits[professionId] = newLimit;
        emit ProfessionLimitUpdated(profession, newLimit);
    }

    function setNFTContract(address _newContract) external onlyOwner {
        if (_newContract == address(0)) revert InvalidAddress();
        address oldContract = address(nftContract);
        nftContract = IIdleProcioneNFT(_newContract);
        emit NFTContractUpdated(oldContract, _newContract);
    }

    function setCraftingManager(address _newManager) external onlyOwner {
        if (_newManager == address(0)) revert InvalidAddress();
        address oldManager = craftingManager;
        craftingManager = _newManager;
        emit CraftingManagerUpdated(oldManager, _newManager);
    }

    function setProfessionBaseStep(uint256 _newValue) external onlyOwner {
        uint256 oldValue = professionBaseStep;
        professionBaseStep = _newValue;
        emit ProfessionBaseStepUpdated(oldValue, _newValue);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========== Medic Specific Functions ==========

    /// @notice Ottiene il cooldown in secondi per un medico in base al suo livello
    /// @param level Il livello del medico
    /// @return Il cooldown in secondi
    function getMedicCooldown(uint256 level) public pure returns (uint256) {
        if (level == 1) return 12 * HOURS_TO_SECONDS;
        if (level == 2) return 10 * HOURS_TO_SECONDS;
        if (level == 3) return 8 * HOURS_TO_SECONDS;
        if (level == 4) return 6 * HOURS_TO_SECONDS;
        if (level == 5) return 5 * HOURS_TO_SECONDS;
        if (level == 6) return 4 * HOURS_TO_SECONDS;
        if (level == 7) return 3 * HOURS_TO_SECONDS;
        if (level == 8) return 2 * HOURS_TO_SECONDS;
        if (level == 9) return 90 minutes;
        if (level == 10) return 1 * HOURS_TO_SECONDS;
        return 12 * HOURS_TO_SECONDS; // Default al cooldown massimo
    }

    /// @notice Attiva il cooldown per un medico
    /// @param tokenId L'ID del token del medico
    function activateCooldown(uint256 tokenId) external {
        if (msg.sender != medicManager) revert NotMedicManager();
        
        (StatsLib.Professions profession, uint256 level,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.MEDIC) revert NotMedic();
        
        uint256 cooldownDuration = getMedicCooldown(level);
        uint256 cooldownEnd = block.timestamp + cooldownDuration;
        medicCooldowns[tokenId] = cooldownEnd;
        
        emit MedicCooldownActivated(tokenId, cooldownEnd);
    }

    /// @notice Verifica se un medico è in cooldown
    /// @param tokenId L'ID del token del medico
    /// @return true se il medico è in cooldown, false altrimenti
    function isOnCooldown(uint256 tokenId) public view returns (bool) {
        (StatsLib.Professions profession,,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.MEDIC) revert NotMedic();
        
        uint256 cooldownEnd = medicCooldowns[tokenId];
        if (cooldownEnd == 0) return false;
        
        if (block.timestamp >= cooldownEnd) {
            return false;
        }
        
        return true;
    }

    /// @notice Imposta l'indirizzo del MedicManager
    /// @param _newManager Il nuovo indirizzo del MedicManager
    function setMedicManager(address _newManager) external onlyOwner {
        if (_newManager == address(0)) revert InvalidAddress();
        address oldManager = medicManager;
        medicManager = _newManager;
        emit MedicManagerUpdated(oldManager, _newManager);
    }

    // ========== Thief Specific Functions ==========

    /// @notice Imposta l'indirizzo del ThiefManager
    /// @param _newManager Il nuovo indirizzo del ThiefManager
    function setThiefManager(address _newManager) external onlyOwner {
        if (_newManager == address(0)) revert InvalidAddress();
        address oldManager = thiefManager;
        thiefManager = _newManager;
        emit ThiefManagerUpdated(oldManager, _newManager);
    }

    /// @notice Attiva il cooldown per un ladro
    /// @param tokenId L'ID del token del ladro
    function activateThiefCooldown(uint256 tokenId) external {
        if (msg.sender != thiefManager) revert NotThiefManager();
        
        (StatsLib.Professions profession, uint256 level,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.THIEF) revert NotThief();
        
        uint256 cooldownDuration = getThiefCooldown(level);
        uint256 cooldownEnd = block.timestamp + cooldownDuration;
        thiefAbilityCooldowns[tokenId] = cooldownEnd;
        
        emit ThiefAbilityCooldownActivated(tokenId, cooldownEnd);
    }

    /// @notice Verifica se un ladro è in cooldown
    /// @param tokenId L'ID del token del ladro
    /// @return true se il ladro è in cooldown, false altrimenti
    function isThiefOnCooldown(uint256 tokenId) public view returns (bool) {
        (StatsLib.Professions profession,,) = nftContract.getProfessionInfo(tokenId);
        if (profession != StatsLib.Professions.THIEF) revert NotThief();
        
        uint256 cooldownEnd = thiefAbilityCooldowns[tokenId];
        if (cooldownEnd == 0) return false;
        
        if (block.timestamp >= cooldownEnd) {
            return false;
        }
        
        return true;
    }

    /// @notice Ottiene il cooldown in secondi per un ladro in base al suo livello
    /// @param level Il livello del ladro
    /// @return Il cooldown in secondi
    function getThiefCooldown(uint256 level) public pure returns (uint256) {
        if (level <= 4) return 24 * HOURS_TO_SECONDS;
        if (level <= 9) return 20 * HOURS_TO_SECONDS;
        if (level <= 14) return 16 * HOURS_TO_SECONDS;
        if (level <= 19) return 12 * HOURS_TO_SECONDS;
        if (level == 20) return 6 * HOURS_TO_SECONDS;
        return 24 * HOURS_TO_SECONDS; // Default al cooldown massimo
    }

    // ========== Internal Functions ==========

    function _calculateRequiredExp(uint256 currentLevel) internal view returns (uint256) {
        return professionBaseStep * ((currentLevel + 1) ** 2);
    }

    function _checkProfessionRequirements(uint256 tokenId) internal view {
        uint256 data = nftContract.getProcioneData(tokenId);
        
        if (StatsLib.getProfession(data) != StatsLib.Professions.NONE) revert ProfessionAlreadyAssigned();
        if (StatsLib.getLevel(data) < MIN_LEVEL_FOR_PROFESSION) revert InsufficientLevel();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 