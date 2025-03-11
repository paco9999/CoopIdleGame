// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./test/mocks/VRFConsumerBaseV2Upgradeable.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./libraries/GeneticsLib.sol";
import "./libraries/WhitelistLib.sol";
import "./libraries/FactionClassLib.sol";
import "./libraries/StatsLib.sol";

/// @title IdleProcioneNFT
/// @author Il tuo nome
/// @notice Contratto principale per la gestione degli NFT Procione
/// @dev Implementa ERC721 con storage ottimizzato e sistema di mint in due fasi
contract IdleProcioneNFT is 
    Initializable, 
    ERC721Upgradeable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    VRFConsumerBaseV2Upgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // ========== Libraries ==========
    using GeneticsLib for *;
    using WhitelistLib for WhitelistLib.WhitelistData;
    using FactionClassLib for FactionClassLib.FactionClassData;
    using StatsLib for uint256;

    // ========== Constants ==========
    uint256 private constant MAX_RANDOM_MINT = 6000;
    uint256 private constant MINT_PER_WALLET = 3;
    uint32 private constant CALLBACK_GAS_LIMIT = 2500000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;

    // ========== State Variables ==========
    // Contatori
    uint256 private _tokenIdCounter;
    uint256 private _randomMintCount;

    // Storage
    mapping(uint256 => uint256) private _procioneData;
    mapping(uint256 => address) private requestToSender;

    // Contratti autorizzati
    address public levelUpContract;
    address public eggContract;

    // Chainlink VRF
    VRFCoordinatorV2Interface private COORDINATOR;
    bytes32 private keyHash;
    uint64 private subscriptionId;

    // Stato
    bool public randomMintPaused;

    // Strutture dati
    WhitelistLib.WhitelistData private whitelistData;
    FactionClassLib.FactionClassData private factionClassData;
    GeneticsLib.TraitCounts private traitCounts;
    GeneticsLib.TraitLimits private traitLimits;

    // ========== Custom Errors ==========
    error RandomMintPaused();
    error MaxRandomMintReached();
    error NoSlotsAvailable();
    error TokenNotExists();
    error UnauthorizedCaller();
    error InvalidAddress();
    error TransferFailed();
    error UnauthorizedEggContract();
    error NotWhitelisted();
    error InsufficientPayment();

    // ========== Events ==========
    event DataUpdated(uint256 indexed tokenId, uint256 newData);
    event LevelUpContractUpdated(address indexed oldContract, address indexed newContract);
    event RandomMintRequested(address indexed sender, uint256 requestId);
    event ProcioneMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 faction,
        uint256 class,
        uint256 genetics
    );
    event TraitGenerated(
        uint256 indexed tokenId,
        string traitType,
        uint256 motherId,
        uint256 fatherId,
        GeneticsLib.TraitType motherType,
        GeneticsLib.TraitType fatherType
    );
    event RandomMintPausedUpdated(bool paused);
    event EggContractUpdated(address indexed newContract);

    // ========== Constructor & Initializer ==========
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 _maxFacGen,
        uint256 _maxClassGen,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(msg.sender);
        __VRFConsumerBaseV2_init(_vrfCoordinator);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;

        factionClassData.setMaxGenLimits(_maxFacGen, _maxClassGen);
        GeneticsLib.initializeTraitLimits(traitLimits);
        randomMintPaused = false;
    }

    // ========== Public Functions ==========
    function randomMint() external payable whenNotPaused {
        if (randomMintPaused) revert RandomMintPaused();
        if (_randomMintCount >= MAX_RANDOM_MINT) revert MaxRandomMintReached();
        if (!factionClassData.hasAvailableSlots()) revert NoSlotsAvailable();
        whitelistData.checkMintConditions(msg.sender, msg.value, MINT_PER_WALLET);

        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            1
        );

        requestToSender[requestId] = msg.sender;
        emit RandomMintRequested(msg.sender, requestId);
    }

    function mintFromEgg(
        address to,
        uint256 genetics,
        uint256 class,
        uint256 faction
    ) external returns (uint256) {
        if (msg.sender != eggContract) revert UnauthorizedEggContract();
        if (!factionClassData.hasAvailableSlots()) revert NoSlotsAvailable();
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        unchecked {
            factionClassData.factionCount[faction]++;
            factionClassData.classCount[class]++;
            factionClassData.facGen++;
            factionClassData.classGen++;
        }

        uint256 data = StatsLib.createInitialData();
        data = StatsLib.updateField(data, genetics, StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        data = StatsLib.updateField(data, class, StatsLib.CLASS_MASK, StatsLib.CLASS_POSITION);
        data = StatsLib.updateField(data, faction, StatsLib.FACTION_MASK, StatsLib.FACTION_POSITION);
        _procioneData[tokenId] = data;
        _safeMint(to, tokenId);

        emit ProcioneMinted(tokenId, to, faction, class, genetics);
        return tokenId;
    }

    // ========== Internal Functions ==========
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address sender = requestToSender[requestId];
        uint256 randomNumber = randomWords[0];
        
        uint256 faction = uint256(FactionClassLib.generateValidFaction(randomNumber, 0, factionClassData));
        uint256 class = uint256(FactionClassLib.generateValidClass(randomNumber, 0, factionClassData));
        
        unchecked {
            factionClassData.factionCount[faction]++;
            factionClassData.classCount[class]++;
            factionClassData.facGen++;
            factionClassData.classGen++;
            _randomMintCount++;
        }
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        whitelistData.mintedPerWallet[sender]++;

        uint256 genetics = generateCompleteGenetics(randomNumber);
        uint256 data = StatsLib.createInitialData();
        data = StatsLib.updateField(data, genetics, StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        data = StatsLib.updateField(data, class, StatsLib.CLASS_MASK, StatsLib.CLASS_POSITION);
        data = StatsLib.updateField(data, faction, StatsLib.FACTION_MASK, StatsLib.FACTION_POSITION);
        _procioneData[tokenId] = data;
        _safeMint(sender, tokenId);

        emit ProcioneMinted(tokenId, sender, faction, class, genetics);
    }

    function generateCompleteGenetics(uint256 randomNumber) private returns (uint256 genetics) {
        uint256 mother;
        uint256 father;
        for (uint256 i = 0; i < 5; i++) {
            (genetics, mother, father) = generateTraitPair(
                genetics,
                randomNumber,
                i,
                getPartName(i)
            );
        }
    }

    function getPartName(uint256 partType) private pure returns (string memory) {
        if (partType == 0) return "HEAD";
        if (partType == 1) return "FUR";
        if (partType == 2) return "STAR";
        if (partType == 3) return "WEAPON";
        return "ACCESSORY";
    }

    function generateTraitPair(
        uint256 genetics,
        uint256 randomNumber,
        uint256 partType,
        string memory partName
    ) private returns (uint256, uint256, uint256) {
        uint256 mother = GeneticsLib.generateAllele(randomNumber, partType * 2, partType, traitCounts, traitLimits);
        uint256 father = GeneticsLib.generateAllele(randomNumber, partType * 2 + 1, partType, traitCounts, traitLimits);
        
        uint256 motherPos = partType * 12;
        uint256 fatherPos = motherPos + 6;
        
        genetics = StatsLib.updateField(genetics, mother, GeneticsLib.ALLELE_MASK, motherPos);
        genetics = StatsLib.updateField(genetics, father, GeneticsLib.ALLELE_MASK, fatherPos);

        emit TraitGenerated(
            _tokenIdCounter,
            partName,
            mother & GeneticsLib.TRAIT_ID_MASK,
            father & GeneticsLib.TRAIT_ID_MASK,
            GeneticsLib.TraitType((mother >> 4) & GeneticsLib.TRAIT_TYPE_MASK),
            GeneticsLib.TraitType((father >> 4) & GeneticsLib.TRAIT_TYPE_MASK)
        );

        return (genetics, mother, father);
    }

    // ========== Admin Functions ==========
    function setWhitelistPhase1(address[] calldata addresses, bool status) external onlyOwner {
        whitelistData.setWhitelistPhase1(addresses, status);
    }

    function setWhitelistPhase2(address[] calldata addresses, bool status) external onlyOwner {
        whitelistData.setWhitelistPhase2(addresses, status);
    }

    function setPhaseStatus(uint256 phase, bool status) external onlyOwner {
        whitelistData.setPhaseStatus(phase, status);
    }

    function setPrice(uint256 _price) external onlyOwner {
        whitelistData.setPrice(_price);
    }

    function setMaxGenLimits(uint256 _maxFacGen, uint256 _maxClassGen) external onlyOwner {
        factionClassData.setMaxGenLimits(_maxFacGen, _maxClassGen);
    }

    function setWhitelistBatch(
        address[] calldata addresses,
        bool[] calldata phase1Status,
        bool[] calldata phase2Status
    ) external onlyOwner {
        whitelistData.setWhitelistBatch(addresses, phase1Status, phase2Status);
    }

    function setRandomMintPaused(bool paused) external onlyOwner {
        randomMintPaused = paused;
        emit RandomMintPausedUpdated(paused);
    }

    function setLevelUpContract(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidAddress();
        address oldContract = levelUpContract;
        levelUpContract = _newAddress;
        emit LevelUpContractUpdated(oldContract, _newAddress);
    }

    function setEggContract(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidAddress();
        eggContract = _newAddress;
        emit EggContractUpdated(_newAddress);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    function rescueERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        IERC20(token).transfer(owner(), amount);
    }

    // ========== View Functions ==========
    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return _procioneData[tokenId];
    }

    function getProcioneStats(uint256 tokenId) external view returns (
        uint256 xp,
        uint256 level,
        uint256 health,
        uint256 strength,
        uint256 speed,
        uint256 intelligence,
        uint256 accuracy,
        uint256 breeding
    ) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return StatsLib.extractStats(_procioneData[tokenId]);
    }

    function getAvailableFactions() external view returns (uint256[5] memory) {
        return FactionClassLib.getAvailableFactions(factionClassData);
    }

    function getAvailableClasses() external view returns (uint256[6] memory) {
        return FactionClassLib.getAvailableClasses(factionClassData);
    }

    function getMintInfo(address wallet) external view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    ) {
        return whitelistData.getMintInfo(wallet, MINT_PER_WALLET);
    }

    function getRandomMintCount() external view returns (uint256) {
        return _randomMintCount;
    }

    function getTotalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function getMaxGenLimits() external view returns (uint256 maxFacGen, uint256 maxClassGen) {
        return factionClassData.getMaxGenLimits();
    }

    // ========== Override Functions ==========
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Verifica se un token esiste
    /// @param tokenId ID del token da verificare
    /// @return bool True se il token esiste
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function updateProcioneData(uint256 tokenId, uint256 newData) external nonReentrant {
        if (levelUpContract == address(0)) revert UnauthorizedCaller();
        if (msg.sender != levelUpContract) revert UnauthorizedCaller();
        if (!_exists(tokenId)) revert TokenNotExists();
        
        uint256 oldData = _procioneData[tokenId];
        _procioneData[tokenId] = newData;
        
        // Chiamata al contratto levelUp per notificare l'aggiornamento
        (bool success,) = levelUpContract.call(
            abi.encodeWithSignature("onDataUpdated(uint256,uint256)", tokenId, newData)
        );
        require(success, "Chiamata a onDataUpdated fallita");
        
        emit DataUpdated(tokenId, newData);
    }

    receive() external payable {}
} 