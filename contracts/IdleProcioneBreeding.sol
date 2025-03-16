// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/StatsLib.sol";
import "./libraries/GeneticsLib.sol";
import "./interfaces/IIdleProcioneNFT.sol";
import "./RandomnessConsumer.sol";

// ========== Interfaces ==========
/// @notice Interfaccia per il contratto NFT dei Procioni
interface IIdleProcioneEgg is IERC20 {
    function mint(
        address to,
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 timestamp
    ) external returns (uint256);
}

/// @title IdleProcioneBreeding
/// @notice Contratto per la gestione del breeding dei Procioni NFT
/// @dev Gestisce il breeding, i costi e la creazione di uova
contract IdleProcioneBreeding is Ownable, ReentrancyGuard, Pausable {
    using StatsLib for uint256;
    using GeneticsLib for uint256;

    // ========== State Variables ==========
    // Contratti esterni
    IIdleProcioneNFT public immutable nftContract;
    IIdleProcioneEgg public immutable eggContract;
    IERC20 public immutable rewardToken;
    IERC20 public immutable govToken;
    RandomnessConsumer public randomnessConsumer;

    // Configurazione
    address public treasuryAddress;
    uint256 public baseCost;
    uint256 public govBaseCost;
    
    // Tracciamento breeding
    mapping(uint256 => uint256) public breedCount;

    // ========== Constants ==========
    uint256 private constant INCUBATION_TIME = 5 days;

    // ========== Custom Errors ==========
    error InsufficientBreedingSlots();
    error InvalidAddress();
    error TransferFailed();
    error UnauthorizedBreeder();
    error SameParentNotAllowed();
    error InvalidRandomness();

    // ========== Events ==========
    event BreedingInitiated(
        uint256 indexed parent1Id,
        uint256 indexed parent2Id,
        uint256 indexed eggId,
        uint256 genetics,
        uint256 hatchTime
    );
    event CostsUpdated(uint256 newBaseCost, uint256 newGovBaseCost);
    event TreasuryUpdated(address indexed newTreasury);
    event RandomnessConsumerUpdated(address indexed newConsumer);

    // ========== Constructor ==========
    /// @notice Costruttore del contratto
    /// @param _nftContract Indirizzo del contratto NFT
    /// @param _eggContract Indirizzo del contratto Egg
    /// @param _rewardToken Indirizzo del token di reward
    /// @param _govToken Indirizzo del token di governance
    /// @param _treasury Indirizzo del treasury
    /// @param _randomnessConsumer Indirizzo del contratto RandomnessConsumer
    /// @param _baseCost Costo base in reward token
    /// @param _govBaseCost Costo base in governance token
    constructor(
        address _nftContract,
        address _eggContract,
        address _rewardToken,
        address _govToken,
        address _treasury,
        address _randomnessConsumer,
        uint256 _baseCost,
        uint256 _govBaseCost
    ) Ownable(msg.sender) {
        if (_nftContract == address(0) || _eggContract == address(0) || 
            _rewardToken == address(0) || _govToken == address(0) || 
            _treasury == address(0) || _randomnessConsumer == address(0)) revert InvalidAddress();

        nftContract = IIdleProcioneNFT(_nftContract);
        eggContract = IIdleProcioneEgg(_eggContract);
        rewardToken = IERC20(_rewardToken);
        govToken = IERC20(_govToken);
        randomnessConsumer = RandomnessConsumer(_randomnessConsumer);
        treasuryAddress = _treasury;
        baseCost = _baseCost;
        govBaseCost = _govBaseCost;
    }

    // ========== Public Functions ==========
    /// @notice Esegue il breeding di due procioni
    /// @param parent1Id ID del primo genitore
    /// @param parent2Id ID del secondo genitore
    /// @param randomNumber Numero random
    /// @param timestamp Timestamp
    /// @param signature Firma
    function breed(
        uint256 parent1Id, 
        uint256 parent2Id, 
        uint256 randomNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        // Verifica che i token appartengano al chiamante
        if (nftContract.ownerOf(parent1Id) != msg.sender || 
            nftContract.ownerOf(parent2Id) != msg.sender) revert UnauthorizedBreeder();
        if (parent1Id == parent2Id) revert SameParentNotAllowed();

        // Verifica e consuma la randomness
        uint256 verifiedRandom = randomnessConsumer.consumeRandomness(
            randomNumber,
            timestamp,
            signature
        );
        
        if (verifiedRandom == 0) revert InvalidRandomness();

        // Ottieni e verifica i dati dei genitori
        _verifyAndUpdateParents(parent1Id, parent2Id);

        // Incrementa il contatore di breed
        unchecked {
            breedCount[parent1Id]++;
            breedCount[parent2Id]++;
        }

        // Crea l'uovo con la genetica combinata
        _createEgg(parent1Id, parent2Id, verifiedRandom);
    }

    function _verifyAndUpdateParents(uint256 parent1Id, uint256 parent2Id) private {
        // Ottieni i dati dei genitori
        uint256 parent1Data = nftContract.getProcioneData(parent1Id);
        uint256 parent2Data = nftContract.getProcioneData(parent2Id);

        // Verifica breeding slots
        uint256 parent1Breeding = StatsLib.extractField(parent1Data, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
        uint256 parent2Breeding = StatsLib.extractField(parent2Data, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
        if (parent1Breeding == 0 || parent2Breeding == 0) revert InsufficientBreedingSlots();

        // Calcola e addebita i costi
        uint256 rewardCost = baseCost * (breedCount[parent1Id] + 1);
        if (!rewardToken.transferFrom(msg.sender, treasuryAddress, rewardCost)) revert TransferFailed();
        if (!govToken.transferFrom(msg.sender, treasuryAddress, govBaseCost)) revert TransferFailed();

        // Aggiorna i breeding slots
        parent1Data = StatsLib.updateField(parent1Data, parent1Breeding - 1, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
        parent2Data = StatsLib.updateField(parent2Data, parent2Breeding - 1, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);
        nftContract.updateProcioneData(parent1Id, parent1Data);
        nftContract.updateProcioneData(parent2Id, parent2Data);
    }

    function _createEgg(uint256 parent1Id, uint256 parent2Id, uint256 verifiedRandom) private {
        // Ottieni i dati dei genitori per la genetica
        uint256 parent1Data = nftContract.getProcioneData(parent1Id);
        uint256 parent2Data = nftContract.getProcioneData(parent2Id);
        
        // Genera la genetica per l'uovo
        uint256 genetics = combineParentGenetics(parent1Data, parent2Data, verifiedRandom);
        
        // Crea l'uovo
        uint256 hatchTime = block.timestamp + INCUBATION_TIME;
        uint256 eggId = eggContract.mint(msg.sender, parent1Id, parent2Id, genetics, hatchTime);

        emit BreedingInitiated(parent1Id, parent2Id, eggId, genetics, hatchTime);
    }

    // ========== Internal Functions ==========
    /// @notice Combina la genetica dei genitori per l'uovo
    /// @param parent1Data Dati del primo genitore
    /// @param parent2Data Dati del secondo genitore
    /// @param randomValue Valore random
    /// @return La genetica combinata
    function combineParentGenetics(
        uint256 parent1Data, 
        uint256 parent2Data, 
        uint256 randomValue
    ) internal pure returns (uint256) {
        uint256 parent1Genetics = StatsLib.extractField(parent1Data, StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        uint256 parent2Genetics = StatsLib.extractField(parent2Data, StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        
        uint256 newGenetics = 0;
        
        // Per ogni parte (head, fur, star, weapon, accessory)
        for (uint256 i = 0; i < 5; i++) {
            uint256 motherPos = i * 12;
            uint256 fatherPos = motherPos + 6;
            
            // Utilizziamo diversi byte del randomValue per ogni parte
            uint256 partRandomByte = (randomValue >> (i * 8)) & 0xFF;
            
            // Determina quale genitore contribuisce a ciascun allele
            uint256 mother = (partRandomByte % 2 == 0) ? 
                GeneticsLib.extractField(parent1Genetics, GeneticsLib.ALLELE_MASK, motherPos) :
                GeneticsLib.extractField(parent2Genetics, GeneticsLib.ALLELE_MASK, motherPos);
                
            uint256 father = ((partRandomByte >> 4) % 2 == 0) ?
                GeneticsLib.extractField(parent1Genetics, GeneticsLib.ALLELE_MASK, fatherPos) :
                GeneticsLib.extractField(parent2Genetics, GeneticsLib.ALLELE_MASK, fatherPos);
            
            newGenetics = StatsLib.updateField(newGenetics, mother, GeneticsLib.ALLELE_MASK, motherPos);
            newGenetics = StatsLib.updateField(newGenetics, father, GeneticsLib.ALLELE_MASK, fatherPos);
        }
        
        return newGenetics;
    }

    // ========== Admin Functions ==========
    /// @notice Aggiorna i costi del breeding
    /// @param _baseCost Nuovo costo base in reward token
    /// @param _govBaseCost Nuovo costo base in governance token
    function setCosts(uint256 _baseCost, uint256 _govBaseCost) external onlyOwner {
        baseCost = _baseCost;
        govBaseCost = _govBaseCost;
        emit CostsUpdated(_baseCost, _govBaseCost);
    }

    /// @notice Aggiorna l'indirizzo del treasury
    /// @param _newTreasury Nuovo indirizzo del treasury
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        treasuryAddress = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    /// @notice Aggiorna il contratto RandomnessConsumer
    /// @param _newConsumer Nuovo indirizzo del contratto RandomnessConsumer
    function setRandomnessConsumer(address _newConsumer) external onlyOwner {
        if (_newConsumer == address(0)) revert InvalidAddress();
        randomnessConsumer = RandomnessConsumer(_newConsumer);
        emit RandomnessConsumerUpdated(_newConsumer);
    }

    /// @notice Mette in pausa il contratto
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Riprende il contratto dalla pausa
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========== View Functions ==========
    /// @notice Ottiene il numero di breed effettuati per un token
    /// @param tokenId ID del token
    /// @return Numero di breed effettuati
    function getBreedCount(uint256 tokenId) external view returns (uint256) {
        return breedCount[tokenId];
    }
} 