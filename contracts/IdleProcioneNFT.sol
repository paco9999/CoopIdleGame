// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./libraries/GeneticsLib.sol";
import "./libraries/WhitelistLib.sol";
import "./libraries/FactionClassLib.sol";
import "./libraries/StatsLib.sol";
import "./interfaces/IIdleProcioneBreeding.sol";
import "./RandomnessConsumer.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/Base64.sol";

/// @title IdleProcioneNFT
/// @author Il tuo nome
/// @notice Contratto principale per la gestione degli NFT Procione
/// @dev Implementa ERC721 con storage ottimizzato e sistema di mint in due fasi
contract IdleProcioneNFT is 
    Initializable, 
    ERC721Upgradeable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
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

    // Requisiti per le professioni
    uint256 private constant MIN_LEVEL_FOR_PROFESSION = 5;
    uint256 private constant MIN_BREEDING_FOR_PROFESSION = 2;
    uint256 private constant INITIAL_PROFESSION_LEVEL = 1;
    uint256 private constant INITIAL_PROFESSION_EXP = 0;

    // ========== State Variables ==========
    // Contatori
    uint256 private _tokenIdCounter;
    uint256 private _randomMintCount;

    // Storage
    mapping(uint256 => uint256) private _procioneData;
    mapping(address => bool) public authorizedHealthModifiers;

    // Contratti autorizzati
    address public levelUpContract;
    address public eggContract;
    address public professionsContract;
    address public dungeonManager;
    uint256 public professionBaseStep;
    RandomnessConsumer public randomnessConsumer;

    // Stato
    bool public randomMintPaused;

    // Strutture dati
    WhitelistLib.WhitelistData private whitelistData;
    FactionClassLib.FactionClassData private factionClassData;
    GeneticsLib.TraitCounts private traitCounts;
    GeneticsLib.TraitLimits private traitLimits;
    
    // Strutture per il fenotipo
    mapping(uint256 => uint256[5]) private _fenotipo;
    GeneticsLib.TraitNames private traitNames;
    mapping(string => string) private _imageBaseURI;
    string private _baseTokenURI;

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
    error InsufficientLevel();
    error InsufficientBreeding();
    error ProfessionAlreadySet();
    error InsufficientExp();
    error NotTokenOwner();
    error UnauthorizedDungeonManager();
    error InvalidRandomness();

    // ========== Events ==========
    event DataUpdated(uint256 indexed tokenId, uint256 newData);
    event LevelUpContractUpdated(address indexed oldContract, address indexed newContract);
    event ProfessionsContractUpdated(address indexed oldContract, address indexed newContract);
    event DungeonManagerUpdated(address indexed oldContract, address indexed newContract);
    event DungeonStatusChanged(uint256 indexed tokenId, bool status);
    event HealthModifierAuthorized(address indexed modifierAddress, bool authorized);
    event CurrentHealthModified(uint256 indexed tokenId, uint256 oldHealth, uint256 newHealth);
    event ProfessionBaseStepUpdated(uint256 oldValue, uint256 newValue);
    event ProfessionSet(uint256 indexed tokenId, uint256 profession);
    event ProfessionLevelUp(uint256 indexed tokenId, uint256 newLevel);
    event ProfessionExpAdded(uint256 indexed tokenId, uint256 expAdded);
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
    event FenotipoStabilito(uint256 indexed tokenId, uint256[5] fenotipo);
    event TraitNameSet(uint256 partType, uint256 traitId, string name);
    event MutazioneGenetica(uint256 indexed tokenId, uint256 partType, bool isMother, uint256 newAllele);
    event RandomMintPausedUpdated(bool paused);
    event EggContractUpdated(address indexed newContract);
    event RandomnessConsumerUpdated(address indexed newConsumer);

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
        address _randomnessConsumer
    ) public initializer {
        __ERC721_init(name, symbol);
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        randomnessConsumer = RandomnessConsumer(_randomnessConsumer);
        professionBaseStep = 100;

        factionClassData.setMaxGenLimits(_maxFacGen, _maxClassGen);
        GeneticsLib.initializeTraitLimits(traitLimits);
        randomMintPaused = false;
    }

    // ========== Public Functions ==========
    function randomMint(bytes calldata signature) external payable whenNotPaused {
        if (randomMintPaused) revert RandomMintPaused();
        if (_randomMintCount >= MAX_RANDOM_MINT) revert MaxRandomMintReached();
        if (!factionClassData.hasAvailableSlots()) revert NoSlotsAvailable();
        whitelistData.checkMintConditions(msg.sender, msg.value, MINT_PER_WALLET);

        // Ottieni il timestamp corrente
        uint256 timestamp = block.timestamp;
        
        // Verifica e consuma il numero casuale firmato
        uint256 randomNumber = randomnessConsumer.consumeRandomness(
            uint256(keccak256(abi.encodePacked(msg.sender, timestamp, _randomMintCount))),
            timestamp,
            signature
        );

        if (randomNumber == 0) revert InvalidRandomness();
        
        // Genera le caratteristiche del Procione
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
        whitelistData.mintedPerWallet[msg.sender]++;

        uint256 genetics = generateCompleteGenetics(randomNumber);
        uint256 data = StatsLib.createInitialData();
        data = StatsLib.updateField(data, genetics, StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        data = StatsLib.updateField(data, class, StatsLib.CLASS_MASK, StatsLib.CLASS_POSITION);
        data = StatsLib.updateField(data, faction, StatsLib.FACTION_MASK, StatsLib.FACTION_POSITION);
        _procioneData[tokenId] = data;
        
        // Genera e salva il fenotipo
        uint256[5] memory fenotipo = GeneticsLib.determineFenotipo(genetics);
        _fenotipo[tokenId] = fenotipo;
        
        // Emetti evento per il fenotipo
        emit FenotipoStabilito(tokenId, fenotipo);
        
        _safeMint(msg.sender, tokenId);

        emit ProcioneMinted(tokenId, msg.sender, faction, class, genetics);
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

        // Genera e salva il fenotipo
        uint256[5] memory fenotipo = GeneticsLib.determineFenotipo(genetics);
        _fenotipo[tokenId] = fenotipo;
        
        // Emetti evento per il fenotipo
        emit FenotipoStabilito(tokenId, fenotipo);
        
        _safeMint(to, tokenId);

        emit ProcioneMinted(tokenId, to, faction, class, genetics);
        return tokenId;
    }

    // ========== Internal Functions ==========
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

    function setProfessionsContract(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidAddress();
        address oldContract = professionsContract;
        professionsContract = _newAddress;
        emit ProfessionsContractUpdated(oldContract, _newAddress);
    }

    function setProfessionBaseStep(uint256 _newValue) external onlyOwner {
        uint256 oldValue = professionBaseStep;
        professionBaseStep = _newValue;
        emit ProfessionBaseStepUpdated(oldValue, _newValue);
    }

    function setProfession(uint256 tokenId, StatsLib.Professions profession) external {
        if (msg.sender != professionsContract) revert UnauthorizedCaller();
        if (!_exists(tokenId)) revert TokenNotExists();
        
        uint256 data = _procioneData[tokenId];
        data = StatsLib.setProfession(data, profession);
        data = StatsLib.setProfessionLevel(data, INITIAL_PROFESSION_LEVEL);
        data = StatsLib.setProfessionExp(data, INITIAL_PROFESSION_EXP);
        
        _procioneData[tokenId] = data;
        emit DataUpdated(tokenId, data);
    }

    function updateProcioneData(uint256 tokenId, uint256 newData) external {
        if (msg.sender != professionsContract && msg.sender != levelUpContract) revert UnauthorizedCaller();
        if (!_exists(tokenId)) revert TokenNotExists();
        
        _procioneData[tokenId] = newData;
        emit DataUpdated(tokenId, newData);
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

    function setRandomnessConsumer(address _newConsumer) external onlyOwner {
        if (_newConsumer == address(0)) revert InvalidAddress();
        address oldConsumer = address(randomnessConsumer);
        randomnessConsumer = RandomnessConsumer(_newConsumer);
        emit RandomnessConsumerUpdated(_newConsumer);
    }

    // ========== View Functions ==========
    function getProcioneData(uint256 tokenId) external view returns (uint256) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return _procioneData[tokenId];
    }

    /// @notice Helper function per impostare il livello di un procione
    /// @param data I dati attuali del procione
    /// @param level Il nuovo livello da impostare
    /// @return I dati aggiornati del procione
    function setLevel(uint256 data, uint256 level) external pure returns (uint256) {
        return StatsLib.setLevel(data, level);
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

    function getProfessionInfo(uint256 tokenId) external view returns (
        StatsLib.Professions profession,
        uint256 level,
        uint256 exp
    ) {
        if (!_exists(tokenId)) revert TokenNotExists();
        uint256 data = _procioneData[tokenId];
        return (
            StatsLib.getProfession(data),
            StatsLib.getProfessionLevel(data),
            StatsLib.getProfessionExp(data)
        );
    }

    function getRequiredExpForNextLevel(uint256 tokenId) external view returns (uint256) {
        if (!_exists(tokenId)) revert TokenNotExists();
        uint256 currentLevel = StatsLib.getProfessionLevel(_procioneData[tokenId]);
        return professionBaseStep * ((currentLevel + 1) ** 2);
    }

    // ========== Override Functions ==========
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Verifica se un token esiste
    /// @param tokenId ID del token da verificare
    /// @return bool True se il token esiste
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /// @notice Autorizza o revoca l'autorizzazione a un contratto per modificare CURRENT_HEALTH
    /// @param modifierIndirizzo Indirizzo del contratto da autorizzare/revocare
    /// @param authorized True per autorizzare, False per revocare
    function setHealthModifierAuthorization(address modifierIndirizzo, bool authorized) external onlyOwner {
        if (modifierIndirizzo == address(0)) revert InvalidAddress();
        authorizedHealthModifiers[modifierIndirizzo] = authorized;
        emit HealthModifierAuthorized(modifierIndirizzo, authorized);
    }

    /// @notice Modifica il valore di CURRENT_HEALTH di un procione
    /// @param tokenId ID del procione
    /// @param delta Valore da aggiungere/sottrarre
    /// @param isAddition True per aggiungere, False per sottrarre
    function modifyCurrentHealth(uint256 tokenId, uint256 delta, bool isAddition) external {
        if (!authorizedHealthModifiers[msg.sender]) revert UnauthorizedCaller();
        if (!_exists(tokenId)) revert TokenNotExists();

        uint256 oldData = _procioneData[tokenId];
        uint256 oldHealth = StatsLib.getCurrentHealth(oldData);
        uint256 newData = StatsLib.modifyCurrentHealth(oldData, delta, isAddition);
        _procioneData[tokenId] = newData;

        emit CurrentHealthModified(tokenId, oldHealth, StatsLib.getCurrentHealth(newData));
        emit DataUpdated(tokenId, newData);
    }

    // ========== Dungeon Functions ==========
    
    /// @notice Imposta l'indirizzo del contratto DungeonManager
    /// @param _newAddress Il nuovo indirizzo del DungeonManager
    function setDungeonManager(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidAddress();
        
        // Revoca l'autorizzazione dal vecchio DungeonManager
        if (dungeonManager != address(0)) {
            authorizedHealthModifiers[dungeonManager] = false;
            emit HealthModifierAuthorized(dungeonManager, false);
        }
        
        address oldContract = dungeonManager;
        dungeonManager = _newAddress;
        
        // Autorizza il nuovo DungeonManager a modificare la salute
        authorizedHealthModifiers[_newAddress] = true;
        
        emit DungeonManagerUpdated(oldContract, _newAddress);
        emit HealthModifierAuthorized(_newAddress, true);
    }

    /// @notice Ottiene lo stato del dungeon di un procione
    /// @param tokenId L'ID del procione
    /// @return bool True se il procione è in dungeon, False altrimenti
    function getDungeonStatus(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return StatsLib.getDungeonStatus(_procioneData[tokenId]) == 1;
    }

    /// @notice Imposta lo stato del dungeon di un procione
    /// @param tokenId L'ID del procione
    /// @param status Il nuovo stato (true = in dungeon, false = non in dungeon)
    function setDungeonStatus(uint256 tokenId, bool status) external {
        if (msg.sender != dungeonManager) revert UnauthorizedDungeonManager();
        if (!_exists(tokenId)) revert TokenNotExists();

        uint256 data = _procioneData[tokenId];
        uint256 newStatus = status ? 1 : 0;
        uint256 newData = StatsLib.setDungeonStatus(data, newStatus);
        _procioneData[tokenId] = newData;

        emit DungeonStatusChanged(tokenId, status);
        emit DataUpdated(tokenId, newData);
    }

    // ========== Funzioni per il fenotipo ==========
    
    /// @notice Ottiene il fenotipo di un procione
    /// @param tokenId L'ID del token
    /// @return Un array di 5 valori che rappresenta i tratti visibili
    function getFenotipo(uint256 tokenId) external view returns (uint256[5] memory) {
        if (!_exists(tokenId)) revert TokenNotExists();
        return _fenotipo[tokenId];
    }

    /// @notice Verifica se un procione ha tratti recessivi nascosti di valore
    /// @param tokenId L'ID del token
    /// @return boolean Se ci sono tratti recessivi nascosti di valore
    function hasHiddenRecessiveTraits(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert TokenNotExists();
        
        uint256 genetics = StatsLib.extractField(_procioneData[tokenId], StatsLib.GENETICS_MASK, StatsLib.GENETICS_POSITION);
        uint256[5] memory fenotipo = _fenotipo[tokenId];
        
        // Per ogni parte, verifica se ci sono tratti nascosti di valore
        for (uint256 i = 0; i < 5; i++) {
            uint256 motherPos = i * 12;
            uint256 fatherPos = motherPos + 6;
            
            uint256 motherAllele = GeneticsLib.extractField(genetics, GeneticsLib.ALLELE_MASK, motherPos);
            uint256 fatherAllele = GeneticsLib.extractField(genetics, GeneticsLib.ALLELE_MASK, fatherPos);
            
            uint256 motherId = motherAllele & GeneticsLib.TRAIT_ID_MASK;
            uint256 fatherId = fatherAllele & GeneticsLib.TRAIT_ID_MASK;
            
            // Se un tratto non visibile è raro (ID >= 7), abbiamo un tratto nascosto di valore
            if ((motherId != fenotipo[i] && motherId >= 7) || (fatherId != fenotipo[i] && fatherId >= 7)) {
                return true;
            }
        }
        
        return false;
    }
    
    /// @notice Imposta i nomi dei tratti
    /// @param partType Tipo di parte (0=HEAD, 1=FUR, ecc.)
    /// @param traitId ID del tratto
    /// @param name Nome del tratto
    function setTraitName(uint256 partType, uint256 traitId, string memory name) external onlyOwner {
        require(traitId < 10, "ID tratto non valido");
        require(partType < 5, "Tipo parte non valido");
        
        if (partType == 0) traitNames.headNames[traitId] = name;
        else if (partType == 1) traitNames.furNames[traitId] = name;
        else if (partType == 2) traitNames.starNames[traitId] = name;
        else if (partType == 3) traitNames.weaponNames[traitId] = name;
        else traitNames.accessoryNames[traitId] = name;
        
        emit TraitNameSet(partType, traitId, name);
    }
    
    /// @notice Ottiene i nomi dei tratti di un fenotipo
    /// @param tokenId ID del token
    /// @return Array con i nomi dei tratti
    function getTraitNames(uint256 tokenId) external view returns (string[5] memory) {
        if (!_exists(tokenId)) revert TokenNotExists();
        
        uint256[5] memory fenotipo = _fenotipo[tokenId];
        string[5] memory names;
        
        names[0] = traitNames.headNames[fenotipo[0]];
        names[1] = traitNames.furNames[fenotipo[1]];
        names[2] = traitNames.starNames[fenotipo[2]];
        names[3] = traitNames.weaponNames[fenotipo[3]];
        names[4] = traitNames.accessoryNames[fenotipo[4]];
        
        return names;
    }
    
    /// @notice Imposta l'URI base per le immagini di un tipo di parte
    /// @param partType Tipo di parte ("HEAD", "FUR", ecc.)
    /// @param baseURI URI base per le immagini di questa parte
    function setImageBaseURI(string memory partType, string memory baseURI) external onlyOwner {
        _imageBaseURI[partType] = baseURI;
    }
    
    /// @notice Imposta l'URI base per i token
    /// @param baseURI Nuovo URI base
    function setBaseTokenURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /// @notice Genera l'URI dell'immagine basato sul fenotipo
    /// @param fenotipo Array del fenotipo
    /// @return URI dell'immagine
    function getImageURI(uint256[5] memory fenotipo) internal view returns (string memory) {
        // Implementazione semplificata: concatena gli URI base con gli ID dei tratti
        string memory headURI = string(abi.encodePacked(_imageBaseURI["HEAD"], toString(fenotipo[0])));
        string memory furURI = string(abi.encodePacked(_imageBaseURI["FUR"], toString(fenotipo[1])));
        string memory starURI = string(abi.encodePacked(_imageBaseURI["STAR"], toString(fenotipo[2])));
        string memory weaponURI = string(abi.encodePacked(_imageBaseURI["WEAPON"], toString(fenotipo[3])));
        string memory accURI = string(abi.encodePacked(_imageBaseURI["ACCESSORY"], toString(fenotipo[4])));
        
        // Qui potresti implementare una concatenazione più elaborata o chiamare un servizio esterno
        return string(abi.encodePacked(headURI, "/", furURI, "/", starURI, "/", weaponURI, "/", accURI));
    }
    
    /// @notice Sovrascrive la funzione tokenURI per costruire URI basati sul fenotipo
    /// @param tokenId L'ID del token
    /// @return URI completo per i metadati del token
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert TokenNotExists();
        
        uint256[5] memory fenotipo = _fenotipo[tokenId];
        
        // Se è impostato un baseTokenURI, lo utilizziamo direttamente
        if (bytes(_baseTokenURI).length > 0) {
            return string(abi.encodePacked(_baseTokenURI, toString(tokenId)));
        }
        
        // Altrimenti costruiamo un URI on-chain con i metadati JSON
        return constructTokenURI(tokenId, fenotipo);
    }
    
    /// @notice Costruisce l'URI del token con metadati on-chain
    /// @param tokenId ID del token
    /// @param fenotipo Array del fenotipo
    /// @return URI completo
    function constructTokenURI(uint256 tokenId, uint256[5] memory fenotipo) internal view returns (string memory) {
        // Questa è una versione semplificata, senza base64 encoding per semplicità
        string memory json = string(abi.encodePacked(
            '{"name":"Procione #', 
            toString(tokenId), 
            '","description":"Un procione virtuale con tratti genetici unici",',
            '"image":"', 
            getImageURI(fenotipo), 
            '","attributes":[',
            getAttributesJSON(tokenId, fenotipo),
            ']}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }
    
    /// @notice Genera la parte JSON degli attributi
    /// @param tokenId ID del token
    /// @param fenotipo Array del fenotipo
    /// @return Stringa JSON degli attributi
    function getAttributesJSON(uint256 tokenId, uint256[5] memory fenotipo) internal view returns (string memory) {
        uint256 data = _procioneData[tokenId];
        (uint256 xp, uint256 level, uint256 health, uint256 strength, uint256 speed, 
         uint256 intelligence, uint256 accuracy, uint256 breeding) = StatsLib.extractStats(data);
        
        string memory attributes = string(abi.encodePacked(
            '{"trait_type":"Head","value":"', traitNames.headNames[fenotipo[0]], '"},',
            '{"trait_type":"Fur","value":"', traitNames.furNames[fenotipo[1]], '"},',
            '{"trait_type":"Star","value":"', traitNames.starNames[fenotipo[2]], '"},',
            '{"trait_type":"Weapon","value":"', traitNames.weaponNames[fenotipo[3]], '"},',
            '{"trait_type":"Accessory","value":"', traitNames.accessoryNames[fenotipo[4]], '"},',
            '{"trait_type":"Level","value":', toString(level), '},',
            '{"trait_type":"Health","value":', toString(health), '},',
            '{"trait_type":"Strength","value":', toString(strength), '},',
            '{"trait_type":"Speed","value":', toString(speed), '},',
            '{"trait_type":"Intelligence","value":', toString(intelligence), '},',
            '{"trait_type":"Accuracy","value":', toString(accuracy), '},',
            '{"trait_type":"Breeding","value":', toString(breeding), '}'
        ));
        
        return attributes;
    }
    
    /// @notice Converte un uint in una stringa
    /// @param value Il valore da convertire
    /// @return Rappresentazione stringa del valore
    function toString(uint256 value) internal pure returns (string memory) {
        // Gestione speciale per 0
        if (value == 0) {
            return "0";
        }
        
        // Trova la lunghezza della stringa risultante
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        // Alloca la memoria per la stringa
        bytes memory buffer = new bytes(digits);
        
        // Estrai le cifre in ordine inverso
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    receive() external payable {}
} 