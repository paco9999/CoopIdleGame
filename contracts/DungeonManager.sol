// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IIdleProcioneNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getProcioneData(uint256 tokenId) external view returns (uint256);
    function setDungeonStatus(uint256 tokenId, bool status) external;
    function getCurrentHealth(uint256 tokenId) external view returns (uint256);
}

interface ICraftingManager {
    function areRecipesValid(uint256[] calldata recipeIds) external view returns (bool);
}

/**
 * @title DungeonManager
 * @dev Gestisce la creazione e la configurazione dei dungeon
 */
contract DungeonManager is Ownable, ReentrancyGuard {
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
    }

    // Mapping dall'ID del dungeon al tipo di dungeon
    mapping(uint256 => DungeonType) internal dungeons;
    
    // Mapping per tenere traccia dei party attivi nei dungeon
    mapping(uint256 => DungeonParty[]) public dungeonParties;

    // Indirizzo del contratto CraftingManager
    ICraftingManager public craftingManager;
    
    // Indirizzo del contratto IdleProcioneNFT
    IIdleProcioneNFT public idleProcioneNFT;

    // Eventi
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
    event DungeonStarted(
        uint256 indexed dungeonId,
        uint256 procione1Id,
        uint256 procione2Id,
        uint256 procione3Id,
        uint256[] equippedItems,
        uint256 endTime
    );

    // Custom Errors
    error InvalidRecipeIds();
    error InvalidNFTOwner();
    error InvalidHealth();
    error DungeonNotInitialized();
    error InvalidItemCount();
    error InvalidProcioneCount();

    /**
     * @dev Costruttore che imposta gli indirizzi dei contratti necessari
     * @param _idleProcioneNFT Indirizzo del contratto IdleProcioneNFT
     * @param _craftingManager Indirizzo del contratto CraftingManager
     */
    constructor(address _idleProcioneNFT, address _craftingManager) Ownable(msg.sender) {
        require(_craftingManager != address(0), "Indirizzo CraftingManager non valido");
        require(_idleProcioneNFT != address(0), "Indirizzo IdleProcioneNFT non valido");
        craftingManager = ICraftingManager(_craftingManager);
        idleProcioneNFT = IIdleProcioneNFT(_idleProcioneNFT);
    }
    
    /**
     * @dev Verifica che gli ID delle ricette esistano nel CraftingManager
     * @param _itemIds Array di ID delle ricette da verificare
     */
    function _verifyRecipeIds(uint256[] calldata _itemIds) internal view {
        if (!craftingManager.areRecipesValid(_itemIds)) {
            revert InvalidRecipeIds();
        }
    }

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
     * @dev Inizializza o aggiorna un tipo di dungeon
     * @param _dungeonId ID del dungeon da inizializzare/aggiornare
     * @param _itemsRequired Array di ID degli oggetti richiesti
     * @param _dungeonStats Array delle statistiche del dungeon [Duration, Depth, TrapDensity, EnemyStrength]
     * @param _timeDuration Durata in secondi del dungeon
     * @param _numberOfItemsRequired Numero di oggetti richiesti per entrare nel dungeon
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
        
        // Verifica che gli ID corrispondano a ricette valide se ci sono oggetti richiesti
        if (_numberOfItemsRequired > 0) {
            _verifyRecipeIds(_itemsRequired);
        }

        // Crea una nuova DungeonType
        DungeonType storage dungeon = dungeons[_dungeonId];
        
        // Copia gli oggetti richiesti
        delete dungeon.itemsRequired; // Pulisce l'array esistente
        for (uint256 i = 0; i < _itemsRequired.length; i++) {
            dungeon.itemsRequired.push(_itemsRequired[i]);
        }

        // Copia le statistiche del dungeon
        for (uint256 i = 0; i < 4; i++) {
            dungeon.dungeonStats[i] = _dungeonStats[i];
        }

        dungeon.timeDuration = _timeDuration;
        dungeon.numberOfItemsRequired = _numberOfItemsRequired;
        dungeon.initialized = true;

        emit DungeonInitialized(_dungeonId, _itemsRequired, _dungeonStats, _timeDuration, _numberOfItemsRequired);
    }

    /**
     * @dev Ottiene i requisiti di oggetti per un dungeon specifico
     * @param _dungeonId ID del dungeon
     * @return items Array di ID degli oggetti richiesti
     * @return numRequired Numero di oggetti richiesti
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
     * @param _dungeonId ID del dungeon
     * @return Array delle statistiche del dungeon
     */
    function getStatistics(uint256 _dungeonId) external view returns (uint256[4] memory) {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        return dungeons[_dungeonId].dungeonStats;
    }

    /**
     * @dev Ottiene tutte le informazioni di un dungeon
     * @param _dungeonId ID del dungeon
     * @return initialized Se il dungeon è stato inizializzato
     * @return itemsRequired Array di ID degli oggetti richiesti
     * @return dungeonStats Array delle statistiche del dungeon
     * @return timeDuration Durata in secondi del dungeon
     * @return numberOfItemsRequired Numero di oggetti richiesti
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
     * @dev Aggiorna le statistiche di un dungeon esistente
     * @param _dungeonId ID del dungeon
     * @param _newStats Nuove statistiche del dungeon
     */
    function updateDungeonStats(uint256 _dungeonId, uint256[4] calldata _newStats) external onlyOwner {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        
        // Copia le nuove statistiche
        for (uint256 i = 0; i < 4; i++) {
            dungeons[_dungeonId].dungeonStats[i] = _newStats[i];
        }

        emit DungeonStatsUpdated(_dungeonId, _newStats);
    }

    /**
     * @dev Aggiorna gli oggetti richiesti per un dungeon
     * @param _dungeonId ID del dungeon
     * @param _newItems Nuovo array di oggetti richiesti
     * @param _newNumberOfItemsRequired Nuovo numero di oggetti richiesti
     */
    function updateDungeonItems(
        uint256 _dungeonId, 
        uint256[] calldata _newItems,
        uint256 _newNumberOfItemsRequired
    ) external onlyOwner {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        require(_newItems.length == _newNumberOfItemsRequired, "Il numero di oggetti forniti non corrisponde al numero richiesto");
        
        // Verifica che gli ID corrispondano a ricette valide solo se ci sono oggetti richiesti
        if (_newNumberOfItemsRequired > 0) {
            _verifyRecipeIds(_newItems);
        }

        // Copia i nuovi oggetti richiesti
        delete dungeons[_dungeonId].itemsRequired; // Pulisce l'array esistente
        for (uint256 i = 0; i < _newItems.length; i++) {
            dungeons[_dungeonId].itemsRequired.push(_newItems[i]);
        }

        dungeons[_dungeonId].numberOfItemsRequired = _newNumberOfItemsRequired;
        
        emit DungeonItemsUpdated(_dungeonId, _newItems, _newNumberOfItemsRequired);
    }

    /**
     * @dev Aggiorna il tempo di durata di un dungeon
     * @param _dungeonId ID del dungeon
     * @param _newTime Nuova durata in secondi
     */
    function updateDungeonTime(uint256 _dungeonId, uint256 _newTime) external onlyOwner {
        require(_newTime > 0, "La durata deve essere maggiore di zero");
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        dungeons[_dungeonId].timeDuration = _newTime;
        emit DungeonTimeUpdated(_dungeonId, _newTime);
    }

    /**
     * @notice Avvia un dungeon con un team di procioni
     * @param dungeonId ID del dungeon da avviare
     * @param procioneIds Array di 3 ID dei procioni
     * @param itemIds Array di ID degli oggetti da equipaggiare (opzionale)
     */
    function startDungeon(
        uint256 dungeonId,
        uint256[3] calldata procioneIds,
        uint256[] calldata itemIds
    ) external nonReentrant {
        // Verifica che il dungeon esista
        DungeonType storage dungeon = dungeons[dungeonId];
        if (!dungeon.initialized) revert DungeonNotInitialized();

        // Verifica che il numero di oggetti sia corretto
        if (itemIds.length > 0) {
            if (itemIds.length != dungeon.numberOfItemsRequired) revert InvalidItemCount();
            // Verifica che gli oggetti siano validi
            _verifyRecipeIds(itemIds);
        }

        // Verifica la proprietà e la salute dei procioni
        uint256[3] memory healthValues;
        for (uint256 i = 0; i < 3; i++) {
            // Verifica la proprietà
            if (idleProcioneNFT.ownerOf(procioneIds[i]) != msg.sender) {
                revert InvalidNFTOwner();
            }

            // Ottieni e verifica la salute
            uint256 currentHealth = idleProcioneNFT.getCurrentHealth(procioneIds[i]);
            if (currentHealth == 0) revert InvalidHealth();
            healthValues[i] = currentHealth;

            // Imposta lo stato del dungeon a true
            idleProcioneNFT.setDungeonStatus(procioneIds[i], true);
        }

        // Crea il party
        DungeonParty memory newParty = DungeonParty({
            dungeonId: dungeonId,
            procione1Id: procioneIds[0],
            procione1Health: healthValues[0],
            procione2Id: procioneIds[1],
            procione2Health: healthValues[1],
            procione3Id: procioneIds[2],
            procione3Health: healthValues[2],
            equippedItems: itemIds,
            endTime: block.timestamp + dungeon.timeDuration
        });

        // Aggiungi il party all'array dei party attivi
        dungeonParties[dungeonId].push(newParty);

        // Emetti l'evento
        emit DungeonStarted(
            dungeonId,
            procioneIds[0],
            procioneIds[1],
            procioneIds[2],
            itemIds,
            newParty.endTime
        );
    }
} 