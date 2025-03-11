// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/StatsLib.sol";

// ========== Interfaces ==========
/// @notice Interfaccia per il contratto NFT dei Procioni
interface IIdleProcioneNFT {
    function updateProcioneData(uint256 tokenId, uint256 newData) external;
    function getProcioneData(uint256 tokenId) external view returns (uint256);
}

/// @title IdleProcioneLeveling
/// @notice Contratto per la gestione del leveling dei Procioni NFT
/// @dev Utilizza StatsLib per la gestione dei dati e implementa ottimizzazioni gas
contract IdleProcioneLeveling is Ownable, ReentrancyGuard, Pausable {
    using StatsLib for uint256;

    // ========== State Variables ==========
    // Contratti esterni
    IIdleProcioneNFT public immutable nftContract;
    IERC20 public immutable rToken;
    
    // Configurazione
    address public treasuryAddress;
    uint256 public baseFee;
    uint256 public incrementoFee;
    uint256 public maxLevel;

    // ========== Custom Errors ==========
    error MaxLevelReached();
    error InsufficientXP();
    error InvalidLevel();
    error InvalidAddress();
    error TransferFailed();
    error InvalidAmount();

    // ========== Events ==========
    event LevelUp(
        uint256 indexed tokenId,
        uint256 newLevel,
        uint256 newXP,
        uint256 newBreeding
    );
    event TreasuryUpdated(address indexed newTreasury);
    event FeeParametersUpdated(uint256 newBaseFee, uint256 newIncremento);
    event MaxLevelUpdated(uint256 newMaxLevel);

    // ========== Constructor ==========
    /// @notice Costruttore del contratto
    /// @param _nftContract Indirizzo del contratto NFT
    /// @param _rToken Indirizzo del token di reward
    /// @param _treasury Indirizzo del treasury
    /// @param _baseFee Fee base per il level up
    /// @param _incrementoFee Incremento della fee per livello
    /// @param _maxLevel Livello massimo raggiungibile
    constructor(
        address _nftContract,
        address _rToken,
        address _treasury,
        uint256 _baseFee,
        uint256 _incrementoFee,
        uint256 _maxLevel
    ) Ownable(msg.sender) {
        if (_maxLevel > 99 || _maxLevel == 0) revert InvalidLevel();
        if (_nftContract == address(0) || _rToken == address(0) || _treasury == address(0)) revert InvalidAddress();
        
        nftContract = IIdleProcioneNFT(_nftContract);
        rToken = IERC20(_rToken);
        treasuryAddress = _treasury;
        baseFee = _baseFee;
        incrementoFee = _incrementoFee;
        maxLevel = _maxLevel;
    }

    // ========== Public Functions ==========
    /// @notice Calcola l'XP necessario per un livello
    /// @param level Livello target
    /// @return XP necessario
    function xpForLevel(uint256 level) public pure returns (uint256) {
        return 30 * level * level;
    }

    /// @notice Calcola la fee per il level up
    /// @param currentLevel Livello attuale
    /// @return Fee necessaria
    function calculateFee(uint256 currentLevel) public view returns (uint256) {
        return baseFee + (incrementoFee * (currentLevel - 1));
    }

    /// @notice Esegue il level up di un procione
    /// @param tokenId ID del procione
    function levelUp(uint256 tokenId) external nonReentrant whenNotPaused {
        uint256 currentData = nftContract.getProcioneData(tokenId);
        
        // Estrai i dati attuali
        uint256 currentXP = StatsLib.extractField(currentData, StatsLib.XP_MASK, StatsLib.XP_POSITION);
        uint256 currentLevel = StatsLib.extractField(currentData, StatsLib.LEVEL_MASK, StatsLib.LEVEL_POSITION);
        uint256 currentBreeding = StatsLib.extractField(currentData, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
        
        if (currentLevel >= maxLevel) revert MaxLevelReached();
        if (currentXP < xpForLevel(currentLevel + 1)) revert InsufficientXP();
        
        uint256 newLevel = currentLevel;
        uint256 newBreeding = currentBreeding;
        
        // Calcola il nuovo livello basato sull'XP
        unchecked {
            while (newLevel < maxLevel && currentXP >= xpForLevel(newLevel + 1)) {
                newLevel++;
                
                // Verifica breeding unlock
                if (isBreedingUnlockLevel(newLevel) && newBreeding < 5) {
                    newBreeding++;
                }
                
                // Addebita la fee
                uint256 fee = calculateFee(currentLevel);
                bool success = rToken.transferFrom(msg.sender, treasuryAddress, fee);
                if (!success) revert TransferFailed();
            }
        }
        
        // Aggiorna i dati se c'è stato un level up
        if (newLevel > currentLevel) {
            // Aggiorna i campi
            currentData = StatsLib.updateField(currentData, 0, StatsLib.XP_MASK, StatsLib.XP_POSITION);
            currentData = StatsLib.updateField(currentData, newLevel, StatsLib.LEVEL_MASK, StatsLib.LEVEL_POSITION);
            currentData = StatsLib.updateField(currentData, newBreeding, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
            
            // Incrementa le statistiche
            currentData = incrementStats(currentData, newLevel - currentLevel);
            
            // Aggiorna i dati sul contratto NFT
            nftContract.updateProcioneData(tokenId, currentData);
            
            emit LevelUp(tokenId, newLevel, 0, newBreeding);
        }
    }

    // ========== Internal Functions ==========
    /// @notice Verifica se un livello sblocca breeding
    /// @param level Livello da verificare
    /// @return true se il livello sblocca breeding
    function isBreedingUnlockLevel(uint256 level) internal pure returns (bool) {
        return level == 3 || level == 5 || level == 10 || level == 15 || level == 20;
    }

    /// @notice Incrementa le statistiche del procione
    /// @param data Dati attuali
    /// @param levelIncrease Numero di livelli aumentati
    /// @return Nuovi dati aggiornati
    function incrementStats(uint256 data, uint256 levelIncrease) internal pure returns (uint256) {
        unchecked {
            uint256 statIncrease = 2 * levelIncrease;
            
            // Incrementa ogni statistica
            data = incrementStat(data, StatsLib.STRENGTH_POSITION, statIncrease);
            data = incrementStat(data, StatsLib.SPEED_POSITION, statIncrease);
            data = incrementStat(data, StatsLib.INTELLIGENCE_POSITION, statIncrease);
            data = incrementStat(data, StatsLib.ACCURACY_POSITION, statIncrease);
            
            return data;
        }
    }

    /// @notice Incrementa una singola statistica
    /// @param data Dati attuali
    /// @param position Posizione della statistica
    /// @param increase Incremento da applicare
    /// @return Nuovi dati aggiornati
    function incrementStat(uint256 data, uint256 position, uint256 increase) internal pure returns (uint256) {
        uint256 mask;
        if (position == StatsLib.STRENGTH_POSITION) mask = StatsLib.STRENGTH_MASK;
        else if (position == StatsLib.SPEED_POSITION) mask = StatsLib.SPEED_MASK;
        else if (position == StatsLib.INTELLIGENCE_POSITION) mask = StatsLib.INTELLIGENCE_MASK;
        else if (position == StatsLib.ACCURACY_POSITION) mask = StatsLib.ACCURACY_MASK;
        
        uint256 currentStat = StatsLib.extractField(data, mask, position);
        uint256 newStat = currentStat + increase;
        if (newStat > 100) newStat = 100;
        return StatsLib.updateField(data, newStat, mask, position);
    }

    // ========== Admin Functions ==========
    /// @notice Aggiorna l'indirizzo del treasury
    /// @param _newTreasury Nuovo indirizzo del treasury
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        treasuryAddress = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    /// @notice Aggiorna i parametri delle fee
    /// @param _baseFee Nuova fee base
    /// @param _incrementoFee Nuovo incremento della fee
    function setFeeParameters(uint256 _baseFee, uint256 _incrementoFee) external onlyOwner {
        baseFee = _baseFee;
        incrementoFee = _incrementoFee;
        emit FeeParametersUpdated(_baseFee, _incrementoFee);
    }

    /// @notice Aggiorna il livello massimo raggiungibile
    /// @param _maxLevel Nuovo livello massimo
    function setMaxLevel(uint256 _maxLevel) external onlyOwner {
        if (_maxLevel > 99 || _maxLevel == 0) revert InvalidLevel();
        maxLevel = _maxLevel;
        emit MaxLevelUpdated(_maxLevel);
    }

    /// @notice Mette in pausa il contratto
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Riprende il contratto dalla pausa
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recupera i token ERC20 dal contratto
    /// @param token Indirizzo del token da recuperare
    /// @param amount Quantità di token da recuperare
    function rescueERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        bool success = IERC20(token).transfer(owner(), amount);
        if (!success) revert TransferFailed();
    }
} 