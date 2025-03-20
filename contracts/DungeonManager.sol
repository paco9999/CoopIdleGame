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
    function addExperience(uint256 tokenId, uint256 amount) external;
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
 * @title IRandomnessConsumer
 * @dev Interfaccia per interagire con il contratto RandomnessConsumer
 */
interface IRandomnessConsumer {
    function consumeRandomness(
        uint256 randomNumber, 
        uint256 timestamp, 
        bytes calldata signature
    ) external returns (uint256);
}

/**
 * @title IDungeonBattler
 * @dev Interfaccia per interagire con il contratto DungeonBattler
 */
interface IDungeonBattler {
    function calculateBattleOutcome(
        uint256 dungeonId,
        uint256 partyIndex,
        uint256 procione1Id,
        uint256 procione2Id,
        uint256 procione3Id,
        uint256 procione1Health,
        uint256 procione2Health,
        uint256 procione3Health,
        uint256[] calldata equippedItems,
        uint256[5] calldata dungeonStats,
        uint256 randomSeed
    ) external returns (
        bool success,
        uint256 remainingHealth,
        uint256 xpEarned,
        uint256 comEarned,
        uint256[] memory materialsEarned
    );

    function updateHealthAfterBattle(
        uint256 procione1Id,
        uint256 procione2Id,
        uint256 procione3Id,
        uint256[3] calldata updatedHealth
    ) external;
}

/**
 * @title ITokenManager
 * @dev Interfaccia per interagire con il contratto TokenManager
 */
interface ITokenManager {
    function mintCOM(address to, uint256 amount) external;
}

/**
 * @title IMaterialsNFT
 * @dev Interfaccia per interagire con il contratto MaterialsNFT
 */
interface IMaterialsNFT {
    function mint(address to, uint256 id, uint256 amount) external;
}

/**
 * @title DungeonManager
 * @dev Gestisce la creazione e la configurazione dei dungeon
 */
contract DungeonManager is Ownable, ReentrancyGuard {
    // ============ Structs ============

    struct DungeonType {
        uint256[] itemsRequired;
        uint256[5] dungeonStats; // [Duration, Depth, TrapDensity, EnemyStrength, Drop_rate]
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
        bool completed;
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
    IDungeonBattler public dungeonBattler;
    ITokenManager public tokenManager;
    IMaterialsNFT public materialsNFT;
    IRandomnessConsumer public randomnessConsumer;

    // ============ Events ============

    event DungeonInitialized(
        uint256 indexed dungeonId, 
        uint256[] itemsRequired, 
        uint256[5] dungeonStats, 
        uint256 timeDuration,
        uint256 numberOfItemsRequired
    );
    event DungeonStatsUpdated(uint256 indexed dungeonId, uint256[5] newStats);
    event DungeonItemsUpdated(uint256 indexed dungeonId, uint256[] newItems, uint256 numberOfItemsRequired);
    event DungeonTimeUpdated(uint256 indexed dungeonId, uint256 newTime);
    event CraftingManagerAddressUpdated(address indexed newAddress);
    event PVPManagerAddressUpdated(address indexed newAddress);
    event DungeonBattlerAddressUpdated(address indexed newAddress);
    event TokenManagerAddressUpdated(address indexed newAddress);
    event MaterialsNFTAddressUpdated(address indexed newAddress);
    event RandomnessConsumerAddressUpdated(address indexed newAddress);
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
    event DungeonCompleted(
        uint256 indexed dungeonId,
        uint256 indexed partyIndex,
        bool success,
        uint256 remainingHealth,
        uint256 xpEarned,
        uint256 comEarned,
        uint256[] materialsEarned
    );
    event RandomnessConsumed(uint256 indexed dungeonId, uint256 indexed partyIndex, uint256 randomSeed);

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
    error InvalidDungeonBattler();
    error InvalidTokenManager();
    error InvalidMaterialsNFT();
    error InvalidRandomnessConsumer();
    error DungeonNotCompleted();
    error DungeonAlreadyCompleted();
    error InvalidRandomSeed();
    error InvalidSignature();

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
     * @dev Aggiorna l'indirizzo del contratto DungeonBattler
     * @param _newAddress Nuovo indirizzo del contratto
     */
    function updateDungeonBattlerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidDungeonBattler();
        dungeonBattler = IDungeonBattler(_newAddress);
        emit DungeonBattlerAddressUpdated(_newAddress);
    }

    /**
     * @dev Aggiorna l'indirizzo del contratto TokenManager
     * @param _newAddress Nuovo indirizzo del contratto
     */
    function updateTokenManagerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidTokenManager();
        tokenManager = ITokenManager(_newAddress);
        emit TokenManagerAddressUpdated(_newAddress);
    }

    /**
     * @dev Aggiorna l'indirizzo del contratto MaterialsNFT
     * @param _newAddress Nuovo indirizzo del contratto
     */
    function updateMaterialsNFTAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidMaterialsNFT();
        materialsNFT = IMaterialsNFT(_newAddress);
        emit MaterialsNFTAddressUpdated(_newAddress);
    }

    /**
     * @dev Aggiorna l'indirizzo del contratto RandomnessConsumer
     * @param _newAddress Nuovo indirizzo del contratto
     */
    function updateRandomnessConsumerAddress(address _newAddress) external onlyOwner {
        if (_newAddress == address(0)) revert InvalidRandomnessConsumer();
        randomnessConsumer = IRandomnessConsumer(_newAddress);
        emit RandomnessConsumerAddressUpdated(_newAddress);
    }

    /**
     * @dev Inizializza o aggiorna un tipo di dungeon
     */
    function initializeDungeon(
        uint256 _dungeonId,
        uint256[] calldata _itemsRequired,
        uint256[5] calldata _dungeonStats,
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

        for (uint256 i = 0; i < 5; i++) {
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
    function updateDungeonStats(uint256 _dungeonId, uint256[5] calldata _newStats) external onlyOwner {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        
        for (uint256 i = 0; i < 5; i++) {
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
    function getStatistics(uint256 _dungeonId) external view returns (uint256[5] memory) {
        require(dungeons[_dungeonId].initialized, "Dungeon non inizializzato");
        return dungeons[_dungeonId].dungeonStats;
    }

    /**
     * @dev Ottiene tutte le informazioni di un dungeon
     */
    function getDungeon(uint256 _dungeonId) external view returns (
        bool initialized,
        uint256[] memory itemsRequired,
        uint256[5] memory dungeonStats,
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

    /**
     * @dev Verifica se un dungeon è stato completato
     */
    function isDungeonCompleted(uint256 dungeonId, uint256 partyIndex) external view returns (bool) {
        if (partyIndex >= dungeonParties[dungeonId].length) revert InvalidPartyIndex();
        return dungeonParties[dungeonId][partyIndex].completed;
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
            PVP_STATUS: false,
            completed: false
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

    /**
     * @notice Completa un dungeon e calcola l'esito
     * @param dungeonId ID del dungeon
     * @param partyIndex Indice del party
     * @param randomNumber Numero casuale generato offchain
     * @param timestamp Timestamp della generazione del numero casuale
     * @param signature Firma del numero casuale per verifica
     */
    function completeDungeon(
        uint256 dungeonId,
        uint256 partyIndex,
        uint256 randomNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external nonReentrant {
        // Verifica che il party esista
        if (partyIndex >= dungeonParties[dungeonId].length) revert InvalidPartyIndex();
        
        // Verifica che i contratti necessari siano impostati
        if (address(dungeonBattler) == address(0)) revert InvalidDungeonBattler();
        if (address(randomnessConsumer) == address(0)) revert InvalidRandomnessConsumer();
        
        DungeonParty storage party = dungeonParties[dungeonId][partyIndex];
        
        // Verifica che il dungeon non sia già stato completato
        if (party.completed) revert DungeonAlreadyCompleted();
        
        // Verifica che il tempo di completamento sia trascorso
        if (block.timestamp < party.endTime) revert DungeonNotCompleted();
        
        // Consuma il numero casuale firmato
        uint256 randomSeed;
        try randomnessConsumer.consumeRandomness(randomNumber, timestamp, signature) returns (uint256 seed) {
            randomSeed = seed;
        } catch {
            revert InvalidSignature();
        }
        
        // Emetti evento per il consumo della randomicità
        emit RandomnessConsumed(dungeonId, partyIndex, randomSeed);
        
        // Ottieni le statistiche del dungeon
        DungeonType storage dungeon = dungeons[dungeonId];
        
        // Calcola l'esito della battaglia
        (
            bool success,
            uint256 remainingHealth,
            uint256 xpEarned,
            uint256 comEarned,
            uint256[] memory materialsEarned
        ) = dungeonBattler.calculateBattleOutcome(
            dungeonId,
            partyIndex,
            party.procione1Id,
            party.procione2Id,
            party.procione3Id,
            party.procione1Health,
            party.procione2Health,
            party.procione3Health,
            party.equippedItems,
            dungeon.dungeonStats,
            randomSeed
        );
        
        // Aggiorna la salute dei procioni dopo la battaglia
        uint256[3] memory updatedHealth = [
            success ? (remainingHealth / 3) : 0, // Distribuzione approssimativa della salute
            success ? (remainingHealth / 3) : 0,
            success ? (remainingHealth / 3) : 0
        ];
        dungeonBattler.updateHealthAfterBattle(
            party.procione1Id, 
            party.procione2Id, 
            party.procione3Id, 
            updatedHealth
        );
        
        // Aggiorna lo stato del party
        party.completed = true;
        
        // Reimposta lo stato dei procioni (non più in dungeon)
        idleProcioneNFT.setDungeonStatus(party.procione1Id, false);
        idleProcioneNFT.setDungeonStatus(party.procione2Id, false);
        idleProcioneNFT.setDungeonStatus(party.procione3Id, false);
        
        // Se la battaglia è stata vinta, assegna ricompense
        if (success) {
            // Assegna XP ai procioni
            idleProcioneNFT.addExperience(party.procione1Id, xpEarned);
            idleProcioneNFT.addExperience(party.procione2Id, xpEarned);
            idleProcioneNFT.addExperience(party.procione3Id, xpEarned);
            
            // Assegna token COM
            if (address(tokenManager) != address(0)) {
                address owner = idleProcioneNFT.ownerOf(party.procione1Id);
                tokenManager.mintCOM(owner, comEarned);
            }
            
            // Assegna materiali
            if (address(materialsNFT) != address(0)) {
                address owner = idleProcioneNFT.ownerOf(party.procione1Id);
                for (uint256 i = 0; i < materialsEarned.length; i++) {
                    materialsNFT.mint(owner, materialsEarned[i], 1);
                }
            }
        }
        
        // Emetti evento di completamento
        emit DungeonCompleted(
            dungeonId,
            partyIndex,
            success,
            remainingHealth,
            xpEarned,
            comEarned,
            materialsEarned
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