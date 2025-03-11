// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IIdleProcioneNFT.sol";

/// @title IdleProcioneLeveling
/// @notice Sistema di leveling per gli NFT Procione
/// @dev Gestisce il level up e le statistiche dei procioni
contract IdleProcioneLeveling is Ownable, Pausable {
    // ========== Constants ==========
    uint256 private constant XP_MASK = 0xFFFFFFFF;
    uint256 private constant XP_POSITION = 0;
    uint256 private constant LEVEL_MASK = 0xFF;
    uint256 private constant LEVEL_POSITION = 32;
    uint256 private constant HEALTH_MASK = 0xFF;
    uint256 private constant HEALTH_POSITION = 40;
    uint256 private constant STRENGTH_MASK = 0xFF;
    uint256 private constant STRENGTH_POSITION = 48;
    uint256 private constant SPEED_MASK = 0xFF;
    uint256 private constant SPEED_POSITION = 56;
    uint256 private constant INTELLIGENCE_MASK = 0xFF;
    uint256 private constant INTELLIGENCE_POSITION = 64;
    uint256 private constant ACCURACY_MASK = 0xFF;
    uint256 private constant ACCURACY_POSITION = 72;
    uint256 private constant BREEDING_MASK = 0xFF;
    uint256 private constant BREEDING_POSITION = 80;

    // ========== State Variables ==========
    IIdleProcioneNFT public nftContract;
    IERC20 public rToken;
    address public treasuryAddress;
    uint256 public baseFee;
    uint256 public incrementoFee;
    uint256 public maxLevel;

    // ========== Custom Errors ==========
    error InvalidAddress();
    error InvalidLevel();
    error InsufficientXP();
    error MaxLevelReached();
    error NotTokenOwner();
    error TransferFailed();

    // ========== Events ==========
    event LevelUp(uint256 indexed tokenId, uint256 newLevel, uint256 remainingXP, uint256 fee);
    event TreasuryUpdated(address indexed newTreasury);
    event FeeParametersUpdated(uint256 newBaseFee, uint256 newIncrementoFee);
    event MaxLevelUpdated(uint256 newMaxLevel);

    // ========== Constructor ==========
    constructor(
        address _nftContract,
        address _rToken,
        address _treasury,
        uint256 _baseFee,
        uint256 _incrementoFee,
        uint256 _maxLevel
    ) Ownable(msg.sender) {
        if (_nftContract == address(0) || _rToken == address(0) || _treasury == address(0)) {
            revert InvalidAddress();
        }
        if (_maxLevel == 0 || _maxLevel > 50) revert InvalidLevel();

        nftContract = IIdleProcioneNFT(_nftContract);
        rToken = IERC20(_rToken);
        treasuryAddress = _treasury;
        baseFee = _baseFee;
        incrementoFee = _incrementoFee;
        maxLevel = _maxLevel;
    }

    // ========== Public Functions ==========
    function levelUp(uint256 tokenId) external whenNotPaused {
        // Verifica proprietà del token
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // Ottieni i dati del procione
        uint256 data = nftContract.getProcioneData(tokenId);
        uint256 currentLevel = extractField(data, LEVEL_MASK, LEVEL_POSITION);
        uint256 currentXP = extractField(data, XP_MASK, XP_POSITION);

        // Verifica condizioni per il level up
        if (currentLevel >= maxLevel) revert MaxLevelReached();
        uint256 requiredXP = xpForLevel(currentLevel);
        if (currentXP < requiredXP) revert InsufficientXP();

        // Calcola e addebita la fee
        uint256 fee = calculateFee(currentLevel);
        bool success = rToken.transferFrom(msg.sender, treasuryAddress, fee);
        if (!success) revert TransferFailed();

        // Aggiorna le statistiche
        uint256 newLevel = currentLevel + 1;
        data = updateField(data, currentXP - requiredXP, XP_MASK, XP_POSITION);
        data = updateField(data, newLevel, LEVEL_MASK, LEVEL_POSITION);

        // Incrementa le statistiche base
        data = updateField(data, extractField(data, STRENGTH_MASK, STRENGTH_POSITION) + 2, STRENGTH_MASK, STRENGTH_POSITION);
        data = updateField(data, extractField(data, SPEED_MASK, SPEED_POSITION) + 2, SPEED_MASK, SPEED_POSITION);
        data = updateField(data, extractField(data, INTELLIGENCE_MASK, INTELLIGENCE_POSITION) + 2, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
        data = updateField(data, extractField(data, ACCURACY_MASK, ACCURACY_POSITION) + 2, ACCURACY_MASK, ACCURACY_POSITION);

        // Sblocca slot breeding ai livelli specifici
        if (newLevel == 3 || newLevel == 10 || newLevel == 20 || newLevel == 35 || newLevel == 50) {
            uint256 currentBreeding = extractField(data, BREEDING_MASK, BREEDING_POSITION);
            data = updateField(data, currentBreeding + 1, BREEDING_MASK, BREEDING_POSITION);
        }

        // Aggiorna i dati del procione
        nftContract.updateProcioneData(tokenId, data);

        emit LevelUp(tokenId, newLevel, currentXP - requiredXP, fee);
    }

    // ========== View Functions ==========
    function xpForLevel(uint256 level) public pure returns (uint256) {
        return 30 * level * level;
    }

    function calculateFee(uint256 currentLevel) public view returns (uint256) {
        return baseFee + (incrementoFee * (currentLevel + 1));
    }

    function extractField(uint256 data, uint256 mask, uint256 position) public pure returns (uint256) {
        return (data >> position) & mask;
    }

    function updateField(uint256 data, uint256 value, uint256 mask, uint256 position) public pure returns (uint256) {
        return (data & ~(mask << position)) | ((value & mask) << position);
    }

    // ========== Admin Functions ==========
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        treasuryAddress = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    function setFeeParameters(uint256 _baseFee, uint256 _incrementoFee) external onlyOwner {
        baseFee = _baseFee;
        incrementoFee = _incrementoFee;
        emit FeeParametersUpdated(_baseFee, _incrementoFee);
    }

    function setMaxLevel(uint256 _maxLevel) external onlyOwner {
        if (_maxLevel == 0 || _maxLevel > 50) revert InvalidLevel();
        maxLevel = _maxLevel;
        emit MaxLevelUpdated(_maxLevel);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
} 