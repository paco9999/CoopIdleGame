// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICOM.sol";
import "./interfaces/IIdleProcioneNFT.sol";
import "./interfaces/IProfessionsManager.sol";
import "./libraries/StatsLib.sol";

/// @title MedicManager
/// @author Il tuo nome
/// @notice Contratto per la gestione delle funzionalità dei Medici
/// @dev Implementa un sistema di cura e gestione dei medici
contract MedicManager is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // ========== State Variables ==========
    
    // Core Contract References
    IERC20 public comToken;
    IIdleProcioneNFT public nftContract;
    IProfessionsManager public professionsManager;
    address public treasury;
    
    // Fee Management
    uint256 public healingFee;
    uint256 public medicFeePercentage;
    
    // Constants
    uint256 private constant PERCENTAGE_BASE = 100;

    // ========== Events ==========
    
    event HealingFeeUpdated(uint256 oldFee, uint256 newFee);
    event MedicFeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event NFTHealed(uint256 indexed tokenId, uint256 indexed medicId, uint256 fee);
    event BatchHealing(uint256[] tokenIds, uint256[] medicIds, uint256 totalFee);
    event ContractUpdated(string indexed contractType, address indexed oldContract, address indexed newContract);

    // ========== Custom Errors ==========
    
    error InvalidAddress();
    error InvalidPercentage();
    error NoAvailableMedic();
    error InsufficientCOMAllowance();
    error InsufficientCOMBalance();
    error NFTAlreadyAtFullHealth();
    error InvalidHealingFee();
    error InsufficientMedics();
    error EmptyBatch();
    error NotMedicManager();
    error NotMedic();
    error MedicOnCooldown();
    error InvalidBatchFeeIncrease();
    error InvalidFeePercentage();
    error InvalidTreasury();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ========== Initializer ==========

    function initialize(
        address _comToken,
        address _nftContract,
        address _professionsManager,
        address _treasury
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_comToken == address(0) || 
            _nftContract == address(0) || 
            _professionsManager == address(0) ||
            _treasury == address(0)) revert InvalidAddress();

        comToken = IERC20(_comToken);
        nftContract = IIdleProcioneNFT(_nftContract);
        professionsManager = IProfessionsManager(_professionsManager);
        treasury = _treasury;
        
        // Default values
        healingFee = 100 * 10**18; // 100 COM
        medicFeePercentage = 50; // 50% al medico, 50% alla tesoreria
    }

    // ========== External Functions ==========

    /// @notice Cura un NFT usando un medico disponibile
    /// @param tokenId ID dell'NFT da curare
    function heal(uint256 tokenId) external whenNotPaused {
        // Verifica COM
        if (comToken.allowance(msg.sender, address(this)) < healingFee) {
            revert InsufficientCOMAllowance();
        }

        // Ottiene i dati dell'NFT
        uint256 data = nftContract.getProcioneData(tokenId);
        uint256 maxHealth = StatsLib.extractField(data, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        uint256 currentHealth = StatsLib.getCurrentHealth(data);

        // Verifica se l'NFT è già al massimo della salute
        if (currentHealth >= maxHealth) {
            revert NFTAlreadyAtFullHealth();
        }

        // Trova un medico disponibile
        uint256 medicId = getAvailableMedic();
        if (medicId == 0) revert NoAvailableMedic();

        // Calcola fee
        uint256 medicFee = (healingFee * medicFeePercentage) / PERCENTAGE_BASE;
        uint256 treasuryFee = healingFee - medicFee;

        // Trasferisci COM
        comToken.transferFrom(msg.sender, nftContract.ownerOf(medicId), medicFee);
        comToken.transferFrom(msg.sender, treasury, treasuryFee);

        // Attiva cooldown
        professionsManager.activateCooldown(medicId);

        // Cura l'NFT
        uint256 healAmount = maxHealth - currentHealth;
        nftContract.modifyCurrentHealth(tokenId, healAmount, true);

        emit NFTHealed(tokenId, medicId, healingFee);
    }

    /// @notice Cura multipli NFT usando medici disponibili
    /// @param tokenIds Array degli ID degli NFT da curare
    function healBatch(uint256[] calldata tokenIds) external whenNotPaused {
        if (tokenIds.length == 0) revert EmptyBatch();

        uint256[] memory medicIds = new uint256[](tokenIds.length);
        uint256[] memory healAmounts = new uint256[](tokenIds.length);
        uint256 totalFee = 0;

        // Verifica salute e trova medici disponibili
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Verifica salute dell'NFT
            uint256 data = nftContract.getProcioneData(tokenIds[i]);
            uint256 maxHealth = StatsLib.extractField(data, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
            uint256 currentHealth = StatsLib.getCurrentHealth(data);

            if (currentHealth >= maxHealth) {
                revert NFTAlreadyAtFullHealth();
            }

            medicIds[i] = getAvailableMedic();
            if (medicIds[i] == 0) revert InsufficientMedics();

            healAmounts[i] = maxHealth - currentHealth;
            totalFee += healingFee;
        }

        // Verifica allowance
        if (comToken.allowance(msg.sender, address(this)) < totalFee) {
            revert InsufficientCOMAllowance();
        }

        // Processa ogni NFT
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 medicFee = (healingFee * medicFeePercentage) / PERCENTAGE_BASE;
            uint256 treasuryFee = healingFee - medicFee;

            comToken.transferFrom(msg.sender, nftContract.ownerOf(medicIds[i]), medicFee);
            comToken.transferFrom(msg.sender, treasury, treasuryFee);

            professionsManager.activateCooldown(medicIds[i]);
            nftContract.modifyCurrentHealth(tokenIds[i], healAmounts[i], true);

            emit NFTHealed(tokenIds[i], medicIds[i], healingFee);
        }

        emit BatchHealing(tokenIds, medicIds, totalFee);
    }

    // ========== View Functions ==========

    /// @notice Trova un medico disponibile per curare
    /// @return tokenId ID del primo medico disponibile, 0 se nessuno è disponibile
    function getAvailableMedic() public view returns (uint256) {
        uint256[] memory medics = professionsManager.getMembersByProfession(1); // 1 = MEDIC
        
        for (uint256 i = 0; i < medics.length; i++) {
            if (!professionsManager.isOnCooldown(medics[i])) {
                return medics[i];
            }
        }
        
        return 0;
    }

    // ========== Admin Functions ==========

    /// @notice Imposta la fee di cura
    /// @param _newFee Nuova fee in token COM
    function setHealingFee(uint256 _newFee) external onlyOwner {
        if (_newFee == 0) revert InvalidHealingFee();
        uint256 oldFee = healingFee;
        healingFee = _newFee;
        emit HealingFeeUpdated(oldFee, _newFee);
    }

    /// @notice Imposta la percentuale della fee che va al medico
    /// @param _newPercentage Nuova percentuale (0-100)
    function setMedicFeePercentage(uint256 _newPercentage) external onlyOwner {
        if (_newPercentage > 100) revert InvalidPercentage();
        uint256 oldPercentage = medicFeePercentage;
        medicFeePercentage = _newPercentage;
        emit MedicFeePercentageUpdated(oldPercentage, _newPercentage);
    }

    /// @notice Aggiorna l'indirizzo della tesoreria
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidTreasury();
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /// @notice Aggiorna l'indirizzo del contratto COM
    function setComToken(address _newComToken) external onlyOwner {
        if (_newComToken == address(0)) revert InvalidAddress();
        address oldContract = address(comToken);
        comToken = IERC20(_newComToken);
        emit ContractUpdated("COM", oldContract, _newComToken);
    }

    /// @notice Aggiorna l'indirizzo del contratto NFT
    function setNFTContract(address _newNFTContract) external onlyOwner {
        if (_newNFTContract == address(0)) revert InvalidAddress();
        address oldContract = address(nftContract);
        nftContract = IIdleProcioneNFT(_newNFTContract);
        emit ContractUpdated("NFT", oldContract, _newNFTContract);
    }

    /// @notice Aggiorna l'indirizzo del contratto ProfessionsManager
    function setProfessionsManager(address _newProfessionsManager) external onlyOwner {
        if (_newProfessionsManager == address(0)) revert InvalidAddress();
        address oldContract = address(professionsManager);
        professionsManager = IProfessionsManager(_newProfessionsManager);
        emit ContractUpdated("ProfessionsManager", oldContract, _newProfessionsManager);
    }

    /// @notice Mette in pausa il contratto
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Riprende il contratto
    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 