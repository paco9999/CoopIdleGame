// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IIdleProcioneNFT
 * @dev Interfaccia per interagire con il contratto IdleProcioneNFT
 */
interface IIdleProcioneNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getProcioneData(uint256 tokenId) external view returns (uint256);
    function setDungeonStatus(uint256 tokenId, bool status) external;
    function getCurrentHealth(uint256 tokenId) external view returns (uint256);
}

/**
 * @title ICraftingManager
 * @dev Interfaccia per interagire con il contratto CraftingManager
 */
interface ICraftingManager {
    function areRecipesValid(uint256[] calldata recipeIds) external view returns (bool);
}

/**
 * @title IPVPManager
 * @dev Interfaccia per interagire con il contratto PVPManager
 */
interface IPVPManager {
    // Interfaccia vuota per type safety
}

/**
 * @title DungeonManager
 * @dev Gestisce la creazione e la configurazione dei dungeon
 */
contract DungeonManager is Ownable, ReentrancyGuard {
    // ============ Structs ============

    struct DungeonType {
        uint256[] itemsRequired;
        uint256[4] dungeonStats; // [Duration, Depth, TrapDensity, EnemyStrength]
        uint256 timeDuration;
        uint256 numberOfItemsRequired;
        bool initialized;
    }

    struct DungeonParty {
        uint256 dungeonId;
        uint256 procione1Id;
        uint256 procione1Health;
        uint256 procione2Id;
        uint256 procione2Health;
        uint256 procione3Id;
        uint256 procione3Health;
        uint256[] equippedItems;
        uint256 endTime;
        bool PVP_CHECK;
        bool PVP_STATUS;
    }

    // ============ Storage ============

    // Mapping dall'ID del dungeon al tipo di dungeon
    mapping(uint256 => DungeonType) internal dungeons;
    
    // Mapping per tenere traccia dei party attivi nei dungeon
    mapping(uint256 => DungeonParty[]) public dungeonParties;

    // Contratti esterni
    ICraftingManager public craftingManager;
    IIdleProcioneNFT public idleProcioneNFT;
    IPVPManager public pvpManager;

    // ============ Events ============

    event DungeonInitialized(
        uint256 indexed dungeonId, 
        uint256[] itemsRequired, 
        uint256[4] dungeonStats, 
        uint256 timeDuration,
        uint256 numberOfItemsRequired
    );
    event DungeonStatsUpdated(uint256 indexed dungeonId, uint256[4] newStats);
    event DungeonItemsUpdated(uint256 indexed dungeonId, uint256[] newItems, uint256 numberOfItemsRequired);
    event DungeonTimeUpdated(uint256 indexed dungeonId, uint256 newTime);
    event CraftingManagerAddressUpdated(address indexed newAddress);
    event PVPManagerAddressUpdated(address indexed newAddress);
    event PVPStatusUpdated(uint256 indexed dungeonId, uint256 partyIndex, bool pvpStatus);
    event PVPCheckUpdated(uint256 indexed dungeonId, uint256 partyIndex, bool pvpCheck);
    event DungeonStarted(
        uint256 indexed dungeonId,
        uint256 procione1Id,
        uint256 procione2Id,
        uint256 procione3Id,
        uint256[] equippedItems,
        uint256 endTime
    );

    // ============ Errors ============

    error InvalidRecipeIds();
    error InvalidNFTOwner();
    error InvalidHealth();
    error DungeonNotInitialized();
    error InvalidItemCount();
    error InvalidProcioneCount();
    error UnauthorizedPVPManager();
    error InvalidPartyIndex();
    error InvalidPVPManager();

    // ============ Constructor ============

    /**
     * @dev Costruttore che imposta gli indirizzi dei contratti necessari
     * @param _idleProcioneNFT Indirizzo del contratto IdleProcioneNFT
     * @param _craftingManager Indirizzo del contratto CraftingManager
     * @param _pvpManager Indirizzo del contratto PVPManager
     */
    constructor(
        address _idleProcioneNFT, 
        address _craftingManager,
        address _pvpManager
    ) Ownable(msg.sender) {
        require(_craftingManager != address(0), "Indirizzo CraftingManager non valido");
        require(_idleProcioneNFT != address(0), "Indirizzo IdleProcioneNFT non valido");
        require(_pvpManager != address(0), "Indirizzo PVPManager non valido");
        
        craftingManager = ICraftingManager(_craftingManager);
        idleProcioneNFT = IIdleProcioneNFT(_idleProcioneNFT);
        pvpManager = IPVPManager(_pvpManager);
    }

    // ============ Internal Functions ============

    /**
     * @dev Verifica che gli ID delle ricette esistano nel CraftingManager
     * @param _itemIds Array di ID delle ricette da verificare
     */
    function _verifyRecipeIds(uint256[] calldata _itemIds) internal view {
        if (!craftingManager.areRecipesValid(_itemIds)) {
            revert InvalidRecipeIds();
        }
    }

    // ============ Admin Functions ============

    /**
     * @dev Aggiorna l'indirizzo del contratto CraftingManager
     * @param _newAddress Nuovo indirizzo del contratto
     */
    function updateCraftingManagerAddress(address _newAddress) external onlyOwner {
        require(_newAddress != address(0), "Indirizzo non valido");
        craftingManager = ICraftingManager(_newAddress);
        emit CraftingManagerAddressUpdated(_newAddress);
    }

    /**
     * @dev Aggiorna l'indirizzo del contratto PVPManager
     * @param _newAddress Nuovo indirizzo del contratto
     */
    function updatePVPManagerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidPVPManager();
        pvpManager = IPVPManager(_newAddress);
        emit PVPManagerAddressUpdated(_newAddress);
    }

    /**
     * @dev Inizializza o aggiorna un tipo di dungeon
     */
    function initializeDungeon(
        uint256 _dungeonId,
        uint256[] calldata _itemsRequired,
        uint256[4] calldata _dungeonStats,
        uint256 _timeDuration,
        uint256 _numberOfItemsRequired
    ) external onlyOwner {
        require(_timeDuration > 0, "La durata deve essere maggiore di zero");
        require(_itemsRequired.length == _numberOfItemsRequired, "Il numero di oggetti forniti non corrisponde al numero richiesto");
        
        if (_numberOfItemsRequired > 0) {
            _verifyRecipeIds(_itemsRequired);
        }

        DungeonType storage dungeon = dungeons[_dungeonId];
        
        delete dungeon.itemsRequired;
        for (uint256 i = 0; i < _itemsRequired.length; i++) {
            dungeon.itemsRequired.push(_itemsRequired[i]);
        }

        for (uint256 i = 0; i < 4; i++) {
            dungeon.dungeonStats[i] = _dungeonStats[i];
        }

        dungeon.timeDuration = _timeDuration;
        dungeon.numberOfItemsRequired = _numberOfItemsRequired;
        dungeon.initialized = true;

        emit DungeonInitialized(_dungeonId, _itemsRequired, _dungeonStats, _timeDuration, _numberOfItemsRequired);
    }

    /**
     * @dev Aggiorna le statistiche di un dungeon esistente
     */
    function updateDungeonStats(uint256 _dungeonId, uint256[4] calldata _newStats) external onlyOwner {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        
        for (uint256 i = 0; i < 4; i++) {
            dungeons[_dungeonId].dungeonStats[i] = _newStats[i];
        }

        emit DungeonStatsUpdated(_dungeonId, _newStats);
    }

    /**
     * @dev Aggiorna gli oggetti richiesti per un dungeon
     */
    function updateDungeonItems(
        uint256 _dungeonId, 
        uint256[] calldata _newItems,
        uint256 _newNumberOfItemsRequired
    ) external onlyOwner {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        require(_newItems.length == _newNumberOfItemsRequired, "Il numero di oggetti forniti non corrisponde al numero richiesto");
        
        if (_newNumberOfItemsRequired > 0) {
            _verifyRecipeIds(_newItems);
        }

        delete dungeons[_dungeonId].itemsRequired;
        for (uint256 i = 0; i < _newItems.length; i++) {
            dungeons[_dungeonId].itemsRequired.push(_newItems[i]);
        }

        dungeons[_dungeonId].numberOfItemsRequired = _newNumberOfItemsRequired;
        
        emit DungeonItemsUpdated(_dungeonId, _newItems, _newNumberOfItemsRequired);
    }

    /**
     * @dev Aggiorna il tempo di durata di un dungeon
     */
    function updateDungeonTime(uint256 _dungeonId, uint256 _newTime) external onlyOwner {
        require(_newTime > 0, "La durata deve essere maggiore di zero");
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        
        dungeons[_dungeonId].timeDuration = _newTime;
        emit DungeonTimeUpdated(_dungeonId, _newTime);
    }

    // ============ View Functions ============

    /**
     * @dev Ottiene i requisiti di oggetti per un dungeon specifico
     */
    function getDungeonRequirements(uint256 _dungeonId) 
        external 
        view 
        returns (uint256[] memory items, uint256 numRequired) 
    {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        return (dungeons[_dungeonId].itemsRequired, dungeons[_dungeonId].numberOfItemsRequired);
    }

    /**
     * @dev Ottiene le statistiche di un dungeon specifico
     */
    function getStatistics(uint256 _dungeonId) external view returns (uint256[4] memory) {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        return dungeons[_dungeonId].dungeonStats;
    }

    /**
     * @dev Ottiene tutte le informazioni di un dungeon
     */
    function getDungeon(uint256 _dungeonId) external view returns (
        bool initialized,
        uint256[] memory itemsRequired,
        uint256[4] memory dungeonStats,
        uint256 timeDuration,
        uint256 numberOfItemsRequired
    ) {
        DungeonType storage dungeon = dungeons[_dungeonId];
        return (
            dungeon.initialized,
            dungeon.itemsRequired,
            dungeon.dungeonStats,
            dungeon.timeDuration,
            dungeon.numberOfItemsRequired
        );
    }

    /**
     * @dev Ottiene lo stato del check PVP per un party specifico
     */
    function getPvpCheck(uint256 dungeonId, uint256 partyIndex) external view returns (bool) {
        if (partyIndex >= dungeonParties[dungeonId].length) revert InvalidPartyIndex();
        return dungeonParties[dungeonId][partyIndex].PVP_CHECK;
    }

    /**
     * @dev Ottiene il risultato del PVP per un party specifico
     */
    function getPvpStatus(uint256 dungeonId, uint256 partyIndex) external view returns (bool) {
        if (partyIndex >= dungeonParties[dungeonId].length) revert InvalidPartyIndex();
        return dungeonParties[dungeonId][partyIndex].PVP_STATUS;
    }

    // ============ External Functions ============

    /**
     * @notice Avvia un dungeon con un team di procioni
     */
    function startDungeon(
        uint256 dungeonId,
        uint256[3] calldata procioneIds,
        uint256[] calldata itemIds
    ) external nonReentrant {
        DungeonType storage dungeon = dungeons[dungeonId];
        if (!dungeon.initialized) revert DungeonNotInitialized();

        if (itemIds.length > 0) {
            if (itemIds.length != dungeon.numberOfItemsRequired) revert InvalidItemCount();
            _verifyRecipeIds(itemIds);
        }

        uint256[3] memory healthValues;
        for (uint256 i = 0; i < 3; i++) {
            if (idleProcioneNFT.ownerOf(procioneIds[i]) != msg.sender) {
                revert InvalidNFTOwner();
            }

            uint256 currentHealth = idleProcioneNFT.getCurrentHealth(procioneIds[i]);
            if (currentHealth == 0) revert InvalidHealth();
            healthValues[i] = currentHealth;

            idleProcioneNFT.setDungeonStatus(procioneIds[i], true);
        }

        DungeonParty memory newParty = DungeonParty({
            dungeonId: dungeonId,
            procione1Id: procioneIds[0],
            procione1Health: healthValues[0],
            procione2Id: procioneIds[1],
            procione2Health: healthValues[1],
            procione3Id: procioneIds[2],
            procione3Health: healthValues[2],
            equippedItems: itemIds,
            endTime: block.timestamp + dungeon.timeDuration,
            PVP_CHECK: false,
            PVP_STATUS: false
        });

        dungeonParties[dungeonId].push(newParty);

        emit DungeonStarted(
            dungeonId,
            procioneIds[0],
            procioneIds[1],
            procioneIds[2],
            itemIds,
            newParty.endTime
        );
    }

    // ============ PVP Functions ============

    /**
     * @dev Modifica lo stato PVP_CHECK di un party
     */
    function pvpEngaged(uint256 dungeonId, uint256 partyIndex) external {
        if (msg.sender != address(pvpManager)) revert UnauthorizedPVPManager();
        if (partyIndex >= dungeonParties[dungeonId].length) revert InvalidPartyIndex();
        
        dungeonParties[dungeonId][partyIndex].PVP_CHECK = true;
        emit PVPCheckUpdated(dungeonId, partyIndex, true);
    }

    /**
     * @dev Imposta il risultato del PVP per un party
     */
    function pvpResults(uint256 dungeonId, uint256 partyIndex, bool result) external {
        if (msg.sender != address(pvpManager)) revert UnauthorizedPVPManager();
        if (partyIndex >= dungeonParties[dungeonId].length) revert InvalidPartyIndex();
        
        dungeonParties[dungeonId][partyIndex].PVP_STATUS = result;
        emit PVPStatusUpdated(dungeonId, partyIndex, result);
    }
} 