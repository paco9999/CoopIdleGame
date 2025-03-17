// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../libraries/StatsLib.sol";

contract MockIdleProcioneNFT is ERC721 {
    uint256 private _nextTokenId;
    mapping(uint256 => uint256) private _procioneData;
    mapping(uint256 => bool) private _dungeonStatus;
    mapping(uint256 => uint256[5]) private _fenotipo;
    uint256 constant MAX_HEALTH = 100;

    constructor() ERC721("MockIdleProcioneNFT", "MNFT") {}

    function safeMint(address to) public returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        // Inizializza con salute massima e salute corrente al massimo
        uint256 data = 0;
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
        
        // Inizializza il fenotipo con valori casuali
        uint256[5] memory fenotipo;
        for (uint256 i = 0; i < 5; i++) {
            fenotipo[i] = uint256(keccak256(abi.encodePacked(tokenId, i, block.timestamp))) % 10;
        }
        _fenotipo[tokenId] = fenotipo;
        
        return tokenId;
    }

    function getHealth(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return StatsLib.getCurrentHealth(_procioneData[tokenId]);
    }

    function setHealth(uint256 tokenId, uint256 health) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        require(health <= MAX_HEALTH, "Health must be between 0 and 100");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.updateField(data, health, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
    }

    function setFullHealth(uint256 tokenId) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
    }

    function isFullHealth(uint256 tokenId) public view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        uint256 data = _procioneData[tokenId];
        uint256 currentHealth = StatsLib.getCurrentHealth(data);
        uint256 maxHealth = StatsLib.extractField(data, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        return currentHealth >= maxHealth;
    }

    function getProcioneData(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return _procioneData[tokenId];
    }

    function modifyCurrentHealth(uint256 tokenId, uint256 amount, bool increase) public {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.modifyCurrentHealth(data, amount, increase);
        _procioneData[tokenId] = data;
    }

    function mint(address to, uint256 tokenId) external {
        _safeMint(to, tokenId);
        // Inizializza con salute massima e salute corrente al massimo
        uint256 data = 0;
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
    }

    function getCurrentHealth(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        return StatsLib.getCurrentHealth(_procioneData[tokenId]);
    }

    function setCurrentHealth(uint256 tokenId, uint256 health) external {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.updateField(data, health, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
    }

    function setDungeonStatus(uint256 tokenId, bool status) external {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        _dungeonStatus[tokenId] = status;
    }

    function getDungeonStatus(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        return _dungeonStatus[tokenId];
    }

    function updateProcioneData(uint256 tokenId, uint256 data) external {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        _procioneData[tokenId] = data;
    }

    function simpleMint(address to) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        // Inizializza con salute massima e salute corrente al massimo
        uint256 data = 0;
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.HEALTH_MASK, StatsLib.HEALTH_POSITION);
        data = StatsLib.updateField(data, MAX_HEALTH, StatsLib.CURRENT_HEALTH_MASK, StatsLib.CURRENT_HEALTH_POSITION);
        _procioneData[tokenId] = data;
        return tokenId;
    }

    function mintFromEgg(
        address to,
        uint256 genetics,
        uint256 class,
        uint256 faction
    ) external returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        // Crea i dati del procione combinando genetica, classe e fazione
        uint256 data = genetics;
        data = StatsLib.updateField(data, class, StatsLib.CLASS_MASK, StatsLib.CLASS_POSITION);
        data = StatsLib.updateField(data, faction, StatsLib.FACTION_MASK, StatsLib.FACTION_POSITION);
        
        _procioneData[tokenId] = data;
        return tokenId;
    }

    function getProfessionInfo(uint256 tokenId) external view returns (StatsLib.Professions, uint256, uint256) {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        uint256 data = _procioneData[tokenId];
        return (
            StatsLib.getProfession(data),
            StatsLib.getProfessionLevel(data),
            StatsLib.getProfessionExp(data)
        );
    }

    function setProfession(uint256 tokenId, StatsLib.Professions profession) external {
        require(_ownerOf(tokenId) != address(0), "Token non esistente");
        uint256 data = _procioneData[tokenId];
        data = StatsLib.setProfession(data, profession);
        data = StatsLib.setProfessionLevel(data, 1); // Livello iniziale
        data = StatsLib.setProfessionExp(data, 0); // XP iniziale
        _procioneData[tokenId] = data;
    }

    // Funzioni di supporto per i test
    function setLevel(uint256 data, uint256 level) external pure returns (uint256) {
        return StatsLib.updateField(data, level, StatsLib.LEVEL_MASK, StatsLib.LEVEL_POSITION);
    }

    function setEggContract(address _eggContract) external {
        // Mock function per i test
    }

    function setLevelUpContract(address _levelUpContract) external {
        // Mock function per i test
    }

    function setWhitelistPhase1(address[] memory addresses, bool status) external {
        // Mock function per i test
    }

    function setPhaseStatus(uint256 phase, bool status) external {
        // Mock function per i test
    }

    function randomMint() external returns (uint256) {
        return safeMint(msg.sender);
    }

    /**
     * @notice Restituisce il fenotipo (visibile) di un procione
     * @dev Il fenotipo è un array di 5 numeri che rappresentano i tratti visibili
     * @param tokenId ID del token
     * @return Array di 5 valori che rappresentano i tratti visibili
     */
    function getFenotipo(uint256 tokenId) external view returns (uint256[5] memory) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return _fenotipo[tokenId];
    }
    
    /**
     * @notice Imposta il fenotipo di un procione (solo per scopi di test)
     * @param tokenId ID del token
     * @param fenotipo Array di 5 valori che rappresentano i tratti visibili
     */
    function setFenotipo(uint256 tokenId, uint256[5] memory fenotipo) external {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        _fenotipo[tokenId] = fenotipo;
    }
} 