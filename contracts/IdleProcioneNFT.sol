// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
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
    VRFConsumerBaseV2,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using GeneticsLib for *;
    using WhitelistLib for WhitelistLib.WhitelistData;
    using FactionClassLib for FactionClassLib.FactionClassData;
    using StatsLib for uint256;

    // Contatore per gli ID dei token
    CountersUpgradeable.Counter private _tokenIdCounter;

    // Contatore per i mint random
    uint256 private _randomMintCount;

    // Mapping per i dati dei procioni
    mapping(uint256 => uint256) private _procioneData;

    // Contratto autorizzato per il leveling
    address public levelUpContract;

    // Contratto autorizzato per le uova
    address public eggContract;

    // Costanti
    uint256 private constant MAX_RANDOM_MINT = 6000;
    uint256 private constant MINT_PER_WALLET = 3;

    // Strutture dati
    WhitelistLib.WhitelistData private whitelistData;
    FactionClassLib.FactionClassData private factionClassData;
    GeneticsLib.TraitCounts private traitCounts;
    GeneticsLib.TraitLimits private traitLimits;

    // Chainlink VRF
    VRFCoordinatorV2Interface private immutable COORDINATOR;
    bytes32 private immutable keyHash;
    uint64 private immutable subscriptionId;
    uint32 private constant CALLBACK_GAS_LIMIT = 2500000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    mapping(uint256 => address) private requestToSender;

    // Stato di pausa per il random mint
    bool public randomMintPaused;

    // Custom errors
    error RandomMintPaused();
    error MaxRandomMintReached();
    error NoSlotsAvailable();
    error TokenNotExists();
    error UnauthorizedCaller();
    error InvalidAddress();
    error TransferFailed();
    error UnauthorizedEggContract();

    // Eventi
    event DataUpdated(uint256 indexed tokenId, uint256 newData);
    event LevelUpContractUpdated(address indexed newContract);
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint64 _subscriptionId
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 _maxFacGen,
        uint256 _maxClassGen
    ) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        // Inizializza i limiti
        factionClassData.setMaxGenLimits(_maxFacGen, _maxClassGen);
        GeneticsLib.initializeTraitLimits(traitLimits);
        
        // Inizializza lo stato di pausa del random mint
        randomMintPaused = false;
    }

    /// @notice Mette in pausa o riattiva il random mint
    /// @param paused True per mettere in pausa, false per riattivare
    function setRandomMintPaused(bool paused) external onlyOwner {
        randomMintPaused = paused;
        emit RandomMintPausedUpdated(paused);
    }

    function randomMint() external payable whenNotPaused {
        if (randomMintPaused) revert RandomMintPaused();
        if (_randomMintCount >= MAX_RANDOM_MINT) revert MaxRandomMintReached();
        if (!factionClassData.hasAvailableSlots()) revert NoSlotsAvailable();
        whitelistData.checkMintConditions(msg.sender, msg.value, MINT_PER_WALLET);

        // Richiedi numeri random a Chainlink VRF
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            1 // numero di parole random
        );

        requestToSender[requestId] = msg.sender;
        emit RandomMintRequested(msg.sender, requestId);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address sender = requestToSender[requestId];
        uint256 randomNumber = randomWords[0];
        
        // Genera fazione e classe valide separatamente
        FactionClassLib.Faction faction = factionClassData.generateValidFaction(randomNumber);
        uint256 class = factionClassData.generateValidClass(randomNumber);
        
        // Incrementa contatori
        unchecked {
            factionClassData.facGen[uint256(faction)]++;
            factionClassData.classGen[class]++;
            _randomMintCount++;
        }
        
        // Crea il nuovo procione
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        whitelistData.mintedPerWallet[sender]++;

        // Genera la genetica completa
        uint256 genetics = generateCompleteGenetics(randomNumber);
        
        // Imposta i dati iniziali del procione
        _procioneData[tokenId] = StatsLib.createInitialData(genetics, class, uint256(faction));
        _safeMint(sender, tokenId);

        emit ProcioneMinted(tokenId, sender, uint256(faction), class, genetics);
    }

    // Funzione helper per generare la genetica completa
    function generateCompleteGenetics(uint256 randomNumber) private returns (uint256 genetics) {
        // Genera alleli per ogni parte
        for (uint256 i = 0; i < 5; i++) {
            (genetics, uint256 mother, uint256 father) = generateTraitPair(
                genetics,
                randomNumber,
                i,
                getPartName(i)
            );
        }
    }

    // Funzione helper per ottenere il nome della parte
    function getPartName(uint256 partType) private pure returns (string memory) {
        if (partType == 0) return "HEAD";
        if (partType == 1) return "FUR";
        if (partType == 2) return "STAR";
        if (partType == 3) return "WEAPON";
        return "ACCESSORY";
    }

    // Funzione helper per generare una coppia di tratti
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
            _tokenIdCounter.current(),
            partName,
            mother & GeneticsLib.TRAIT_ID_MASK,
            father & GeneticsLib.TRAIT_ID_MASK,
            GeneticsLib.TraitType((mother >> 4) & GeneticsLib.TRAIT_TYPE_MASK),
            GeneticsLib.TraitType((father >> 4) & GeneticsLib.TRAIT_TYPE_MASK)
        );

        return (genetics, mother, father);
    }

    // Funzioni amministrative
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

    function updateProcioneData(uint256 tokenId, uint256 newData) external {
        if (!_exists(tokenId)) revert TokenNotExists();
        if (msg.sender != levelUpContract) revert UnauthorizedCaller();
        _procioneData[tokenId] = newData;
        emit DataUpdated(tokenId, newData);
    }

    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return _procioneData[tokenId];
    }

    function setLevelUpContract(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidAddress();
        levelUpContract = _newAddress;
        emit LevelUpContractUpdated(_newAddress);
    }

    function setEggContract(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidAddress();
        eggContract = _newAddress;
        emit EggContractUpdated(_newAddress);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function withdraw() external onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    function rescueERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        IERC20(token).transfer(owner(), amount);
    }

    function getAvailableFactions() external view returns (uint256[5] memory) {
        return factionClassData.getAvailableFactions();
    }

    function getAvailableClasses() external view returns (uint256[6] memory) {
        return factionClassData.getAvailableClasses();
    }

    function getMintInfo(address wallet) external view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    ) {
        return whitelistData.getMintInfo(wallet, MINT_PER_WALLET);
    }

    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }

    function getProcioneStats(uint256 tokenId) external view returns (StatsLib.Stats memory) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return StatsLib.extractStats(_procioneData[tokenId]);
    }

    /// @notice Restituisce il numero totale di procioni mintati tramite random mint
    function getRandomMintCount() external view returns (uint256) {
        return _randomMintCount;
    }

    /// @notice Restituisce il numero totale di procioni esistenti
    function getTotalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /// @notice Funzione di mint per il breeding, chiamabile solo dal contratto uovo
    /// @param to Indirizzo del destinatario
    /// @param genetics Genetica del nuovo procione
    /// @param class Classe del nuovo procione
    /// @param faction Fazione del nuovo procione
    /// @return ID del nuovo procione
    function mintFromEgg(
        address to,
        uint256 genetics,
        uint256 class,
        uint256 faction
    ) external returns (uint256) {
        if (msg.sender != eggContract) revert UnauthorizedEggContract();
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Imposta i dati iniziali del procione
        uint256 data = 0;
        
        // Inizializza i campi base
        data = StatsLib.updateField(data, 0, StatsLib.XP_MASK, StatsLib.XP_POSITION); // XP iniziale a 0
        data = StatsLib.updateField(data, 1, StatsLib.LEVEL_MASK, StatsLib.LEVEL_POSITION); // Livello iniziale a 1
        data = StatsLib.updateField(data, 100, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION); // Salute iniziale a 100
        
        // Inizializza le statistiche base
        data = StatsLib.updateField(data, 10, StatsLib.STAT_MASK, StatsLib.STRENGTH_POSITION); // Forza iniziale a 10
        data = StatsLib.updateField(data, 10, StatsLib.STAT_MASK, StatsLib.SPEED_POSITION); // Velocità iniziale a 10
        data = StatsLib.updateField(data, 10, StatsLib.STAT_MASK, StatsLib.INTELLIGENCE_POSITION); // Intelligenza iniziale a 10
        data = StatsLib.updateField(data, 10, StatsLib.STAT_MASK, StatsLib.PRECISION_POSITION); // Precisione iniziale a 10
        
        // Imposta genetica, classe e fazione
        data = StatsLib.updateField(data, genetics, StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        data = StatsLib.updateField(data, class, StatsLib.CLASS_MASK, StatsLib.CLASS_POSITION);
        data = StatsLib.updateField(data, faction, StatsLib.FACTION_MASK, StatsLib.FACTION_POSITION);
        
        // Imposta gli slot breeding iniziali a 0 (dovranno essere sbloccati con il leveling)
        data = StatsLib.updateField(data, 0, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION);

        // Salva i dati e minta il token
        _procioneData[tokenId] = data;
        _safeMint(to, tokenId);

        emit ProcioneMinted(tokenId, to, faction, class, genetics);

        return tokenId;
    }
} 