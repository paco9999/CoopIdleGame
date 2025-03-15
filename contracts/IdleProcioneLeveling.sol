// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IIdleProcioneNFT.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/StatsLib.sol";

/// @title IdleProcioneLeveling
/// @notice Sistema di leveling per gli NFT Procione
/// @dev Gestisce il level up e le statistiche dei procioni
contract IdleProcioneLeveling is Ownable, Pausable, ReentrancyGuard {
    using StatsLib for uint256;

    // ========== State Variables ==========
    IIdleProcioneNFT public immutable nftContract;
    IERC20 public immutable rToken;
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
    error InvalidStats();
    error InvalidXPDeduction();
    error InvalidFeeParameters();

    // ========== Events ==========
    event LevelUp(uint256 indexed tokenId, uint256 newLevel, uint256 remainingXP, uint256 fee);
    event TreasuryUpdated(address indexed newTreasury);
    event FeeParametersUpdated(uint256 newBaseFee, uint256 newIncrementoFee);
    event MaxLevelUpdated(uint256 newMaxLevel);
    event ContractPaused(address indexed operator);
    event ContractUnpaused(address indexed operator);

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
        if (_baseFee == 0 || _incrementoFee == 0) revert InvalidFeeParameters();

        nftContract = IIdleProcioneNFT(_nftContract);
        rToken = IERC20(_rToken);
        treasuryAddress = _treasury;
        baseFee = _baseFee;
        incrementoFee = _incrementoFee;
        maxLevel = _maxLevel;
    }

    // ========== Public Functions ==========
    function levelUp(uint256 tokenId) external whenNotPaused nonReentrant {
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        uint256 data = nftContract.getProcioneData(tokenId);
        uint256 currentLevel = data.extractField(StatsLib.LEVEL_MASK, StatsLib.LEVEL_POSITION);
        
        if (currentLevel >= maxLevel) revert MaxLevelReached();
        
        uint256 currentXP = data.extractField(StatsLib.XP_MASK, StatsLib.XP_POSITION);
        uint256 requiredXP = xpForLevel(currentLevel);
        if (currentXP < requiredXP) revert InsufficientXP();

        uint256 fee = calculateFee(currentLevel);
        if (!rToken.transferFrom(msg.sender, treasuryAddress, fee)) revert TransferFailed();

        uint256 newXP = currentXP - requiredXP;
        if (newXP > type(uint256).max || newXP > currentXP) revert InvalidXPDeduction();
        
        uint256 newLevel = currentLevel + 1;
        data = _updateLevelAndXP(data, newLevel, newXP);
        data = _updateStats(data);
        data = _updateBreedingSlots(data, newLevel);

        nftContract.updateProcioneData(tokenId, data);

        emit LevelUp(tokenId, newLevel, newXP, fee);
    }

    // ========== View Functions ==========
    function xpForLevel(uint256 level) public pure returns (uint256) {
        unchecked {
            return 30 * level * level;
        }
    }

    function calculateFee(uint256 currentLevel) public view returns (uint256) {
        unchecked {
            return baseFee + (incrementoFee * (currentLevel + 1));
        }
    }

    // ========== Admin Functions ==========
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        treasuryAddress = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    function setFeeParameters(uint256 _baseFee, uint256 _incrementoFee) external onlyOwner {
        if (_baseFee == 0 || _incrementoFee == 0) revert InvalidFeeParameters();
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
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    // ========== Internal Functions ==========
    function _updateLevelAndXP(uint256 data, uint256 newLevel, uint256 newXP) private pure returns (uint256) {
        data = data.updateField(newXP, StatsLib.XP_MASK, StatsLib.XP_POSITION);
        return data.updateField(newLevel, StatsLib.LEVEL_MASK, StatsLib.LEVEL_POSITION);
    }

    function _updateStats(uint256 data) private pure returns (uint256) {
        unchecked {
            uint256[4] memory stats;
            stats[0] = data.extractField(StatsLib.STRENGTH_MASK, StatsLib.STRENGTH_POSITION);
            stats[1] = data.extractField(StatsLib.SPEED_MASK, StatsLib.SPEED_POSITION);
            stats[2] = data.extractField(StatsLib.INTELLIGENCE_MASK, StatsLib.INTELLIGENCE_POSITION);
            stats[3] = data.extractField(StatsLib.ACCURACY_MASK, StatsLib.ACCURACY_POSITION);

            for(uint256 i = 0; i < 4; i++) {
                if (stats[i] > 253) revert InvalidStats(); // 255 - 2 per permettere l'incremento
                stats[i] += 2;
            }

            data = data.updateField(stats[0], StatsLib.STRENGTH_MASK, StatsLib.STRENGTH_POSITION);
            data = data.updateField(stats[1], StatsLib.SPEED_MASK, StatsLib.SPEED_POSITION);
            data = data.updateField(stats[2], StatsLib.INTELLIGENCE_MASK, StatsLib.INTELLIGENCE_POSITION);
            return data.updateField(stats[3], StatsLib.ACCURACY_MASK, StatsLib.ACCURACY_POSITION);
        }
    }

    function _updateBreedingSlots(uint256 data, uint256 newLevel) private pure returns (uint256) {
        if (newLevel == 3 || newLevel == 10 || newLevel == 20 || newLevel == 35 || newLevel == 50) {
            uint256 currentBreeding = data.extractField(StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
            if (currentBreeding >= 5) revert InvalidStats(); // Massimo 5 slot di breeding
            uint256 newBreeding = currentBreeding + 1;
            return data.updateField(newBreeding, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
        }
        return data;
    }
} 