// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IDungeonManager
 * @dev Interfaccia per interagire con il contratto DungeonManager
 */
interface IDungeonManager {
    // Funzione per verificare che chi chiama sia il DungeonManager
}

/**
 * @title IIdleProcioneNFT
 * @dev Interfaccia per interagire con il contratto IdleProcioneNFT
 */
interface IIdleProcioneNFT {
    function getProcioneData(uint256 tokenId) external view returns (uint256);
    function getCurrentHealth(uint256 tokenId) external view returns (uint256);
    function getBaseHealth(uint256 tokenId) external view returns (uint256);
    function getStrength(uint256 tokenId) external view returns (uint256);
    function getSpeed(uint256 tokenId) external view returns (uint256);
    function getIntelligence(uint256 tokenId) external view returns (uint256);
    function getAccuracy(uint256 tokenId) external view returns (uint256);
}

/**
 * @title ICraftingManager
 * @dev Interfaccia per interagire con il contratto CraftingManager
 */
interface ICraftingManager {
    function getItemBonus(uint256 itemId) external view returns (uint256[5] memory);
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
    
    function verifySignature(
        uint256 randomNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external view returns (bool);
}

/**
 * @title DungeonBattler
 * @dev Contratto per calcolare l'esito delle battaglie nei dungeon
 */
contract DungeonBattler is Ownable {
    // ============ Enums ============
    
    // Tipi di danno
    enum DamageType {
        NONE,      // Nessun danno
        LIGHT,     // Danno leggero (1-20 HP)
        MEDIUM,    // Danno medio (21-50 HP)
        HEAVY,     // Danno pesante (51-99 HP)
        LETHAL     // Danno letale (100% HP)
    }
    
    // ============ Constants ============
    
    // Ranges per numero di attacchi in base a Duration
    uint8[2][] private ATTACK_RANGES = [
        [3, 5],   // Duration 1
        [3, 7],   // Duration 2
        [4, 8],   // Duration 3 
        [6, 9],   // Duration 4
        [8, 12]   // Duration 5
    ];
    
    // Probabilità di tipi di danno in base a EnemyStrength (in percentuale)
    // [NONE, LIGHT, MEDIUM, HEAVY, LETHAL]
    uint8[5][] private DAMAGE_PROBABILITIES = [
        [20, 75, 5, 0, 0],     // EnemyStrength 1
        [10, 75, 15, 0, 0],    // EnemyStrength 2
        [10, 55, 25, 10, 0],   // EnemyStrength 3
        [5, 45, 30, 20, 0],    // EnemyStrength 4
        [5, 30, 35, 25, 5]     // EnemyStrength 5
    ];
    
    // Range di danno per tipo
    uint8[2][] private DAMAGE_RANGES = [
        [0, 0],    // NONE
        [1, 20],   // LIGHT
        [21, 50],  // MEDIUM
        [51, 99],  // HEAVY
        [100, 100] // LETHAL (valore speciale per 100% HP)
    ];
    
    // Probabilità di trappole in base a TrapDensity (in percentuale)
    uint8[] private TRAP_PROBABILITIES = [
        0,   // Non usato
        10,  // TrapDensity 1
        20,  // TrapDensity 2
        30   // TrapDensity 3
    ];
    
    // Danno da trappola in base a Depth (percentuale di HP totale)
    uint8[] private TRAP_DAMAGE_PERCENTAGES = [
        0,   // Non usato
        10,  // Depth 1
        20,  // Depth 2
        30   // Depth 3
    ];
    
    // ============ Storage ============
    
    // Contratti esterni
    address public dungeonManager;
    IIdleProcioneNFT public idleProcioneNFT;
    ICraftingManager public craftingManager;
    IRandomnessConsumer public randomnessConsumer;
    
    // Parametri di bilanciamento base
    uint256 public baseXpReward = 100;         // XP base per completamento dungeon
    uint256 public baseCOMReward = 50;         // Token COM base per completamento dungeon
    
    // Ricompense personalizzate per dungeon
    mapping(uint256 => uint256) public dungeonXpRewards;      // DungeonID => XP reward
    mapping(uint256 => uint256) public dungeonCOMRewards;     // DungeonID => COM reward
    mapping(uint256 => bool) public customRewardsEnabled;     // DungeonID => ha ricompense personalizzate?
    
    // ============ Events ============
    
    event DungeonBattleResult(
        uint256 indexed dungeonId,
        uint256 indexed partyIndex,
        bool success,
        uint256 remainingHealth,
        uint256 damageDealt,
        uint256 xpEarned,
        uint256 comEarned,
        uint256[] materialsEarned
    );
    
    event BattleDetailedResult(
        uint256 indexed dungeonId,
        uint256 indexed partyIndex,
        uint256 attackCount,
        uint256 trapCount,
        uint256 totalDamage
    );
    
    event DungeonManagerUpdated(address indexed newDungeonManager);
    event IdleProcioneNFTUpdated(address indexed newIdleProcioneNFT);
    event CraftingManagerUpdated(address indexed newCraftingManager);
    event RandomnessConsumerUpdated(address indexed newRandomnessConsumer);
    event BaseRewardParametersUpdated(uint256 baseXp, uint256 baseCOM);
    event DungeonRewardsUpdated(uint256 indexed dungeonId, uint256 xpReward, uint256 comReward);
    event DungeonRewardsRemoved(uint256 indexed dungeonId);
    
    // ============ Errors ============
    
    error UnauthorizedCaller();
    error InvalidDungeonManager();
    error InvalidIdleProcioneNFT();
    error InvalidCraftingManager();
    error InvalidRandomnessConsumer();
    error InvalidDungeonParameters();
    error InvalidPartyParameters();
    error InvalidRandomSeed();
    error InvalidRewardValue();
    
    // ============ Constructor ============
    
    /**
     * @dev Costruttore che imposta gli indirizzi dei contratti necessari
     * @param _dungeonManager Indirizzo del contratto DungeonManager
     * @param _idleProcioneNFT Indirizzo del contratto IdleProcioneNFT
     * @param _craftingManager Indirizzo del contratto CraftingManager
     * @param _randomnessConsumer Indirizzo del contratto RandomnessConsumer
     */
    constructor(
        address _dungeonManager,
        address _idleProcioneNFT,
        address _craftingManager,
        address _randomnessConsumer
    ) Ownable(msg.sender) {
        if (_dungeonManager == address(0)) revert InvalidDungeonManager();
        if (_idleProcioneNFT == address(0)) revert InvalidIdleProcioneNFT();
        if (_craftingManager == address(0)) revert InvalidCraftingManager();
        if (_randomnessConsumer == address(0)) revert InvalidRandomnessConsumer();
        
        dungeonManager = _dungeonManager;
        idleProcioneNFT = IIdleProcioneNFT(_idleProcioneNFT);
        craftingManager = ICraftingManager(_craftingManager);
        randomnessConsumer = IRandomnessConsumer(_randomnessConsumer);
    }
    
    // ============ Modifiers ============
    
    /**
     * @dev Modifier per verificare che chi chiama sia il DungeonManager
     */
    modifier onlyDungeonManager() {
        if (msg.sender != dungeonManager) revert UnauthorizedCaller();
        _;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @dev Aggiorna l'indirizzo del contratto DungeonManager
     * @param _newDungeonManager Nuovo indirizzo del contratto
     */
    function updateDungeonManager(address _newDungeonManager) external onlyOwner {
        if (_newDungeonManager == address(0)) revert InvalidDungeonManager();
        dungeonManager = _newDungeonManager;
        emit DungeonManagerUpdated(_newDungeonManager);
    }
    
    /**
     * @dev Aggiorna l'indirizzo del contratto IdleProcioneNFT
     * @param _newIdleProcioneNFT Nuovo indirizzo del contratto
     */
    function updateIdleProcioneNFT(address _newIdleProcioneNFT) external onlyOwner {
        if (_newIdleProcioneNFT == address(0)) revert InvalidIdleProcioneNFT();
        idleProcioneNFT = IIdleProcioneNFT(_newIdleProcioneNFT);
        emit IdleProcioneNFTUpdated(_newIdleProcioneNFT);
    }
    
    /**
     * @dev Aggiorna l'indirizzo del contratto CraftingManager
     * @param _newCraftingManager Nuovo indirizzo del contratto
     */
    function updateCraftingManager(address _newCraftingManager) external onlyOwner {
        if (_newCraftingManager == address(0)) revert InvalidCraftingManager();
        craftingManager = ICraftingManager(_newCraftingManager);
        emit CraftingManagerUpdated(_newCraftingManager);
    }
    
    /**
     * @dev Aggiorna l'indirizzo del contratto RandomnessConsumer
     * @param _newRandomnessConsumer Nuovo indirizzo del contratto
     */
    function updateRandomnessConsumer(address _newRandomnessConsumer) external onlyOwner {
        if (_newRandomnessConsumer == address(0)) revert InvalidRandomnessConsumer();
        randomnessConsumer = IRandomnessConsumer(_newRandomnessConsumer);
        emit RandomnessConsumerUpdated(_newRandomnessConsumer);
    }
    
    /**
     * @dev Aggiorna i parametri base di ricompensa
     */
    function updateBaseRewardParameters(
        uint256 _baseXpReward,
        uint256 _baseCOMReward
    ) external onlyOwner {
        baseXpReward = _baseXpReward;
        baseCOMReward = _baseCOMReward;
        emit BaseRewardParametersUpdated(_baseXpReward, _baseCOMReward);
    }
    
    /**
     * @dev Imposta ricompense personalizzate per un dungeon specifico
     * @param dungeonId ID del dungeon
     * @param xpReward Ricompensa XP per questo dungeon
     * @param comReward Ricompensa COM per questo dungeon
     */
    function setDungeonRewards(
        uint256 dungeonId,
        uint256 xpReward,
        uint256 comReward
    ) external onlyOwner {
        if (xpReward == 0 || comReward == 0) revert InvalidRewardValue();
        
        dungeonXpRewards[dungeonId] = xpReward;
        dungeonCOMRewards[dungeonId] = comReward;
        customRewardsEnabled[dungeonId] = true;
        
        emit DungeonRewardsUpdated(dungeonId, xpReward, comReward);
    }
    
    /**
     * @dev Rimuove le ricompense personalizzate per un dungeon
     * @param dungeonId ID del dungeon
     */
    function removeDungeonRewards(uint256 dungeonId) external onlyOwner {
        if (!customRewardsEnabled[dungeonId]) return;
        
        delete dungeonXpRewards[dungeonId];
        delete dungeonCOMRewards[dungeonId];
        customRewardsEnabled[dungeonId] = false;
        
        emit DungeonRewardsRemoved(dungeonId);
    }
    
    // ============ Battle Logic ============
    
    /**
     * @dev Calcola l'esito di una battaglia nel dungeon
     * @param dungeonId ID del dungeon
     * @param partyIndex Indice del party nel dungeon
     * @param procione1Id ID del primo procione
     * @param procione2Id ID del secondo procione
     * @param procione3Id ID del terzo procione
     * @param procione1Health Salute iniziale del primo procione
     * @param procione2Health Salute iniziale del secondo procione
     * @param procione3Health Salute iniziale del terzo procione
     * @param equippedItems Array degli oggetti equipaggiati
     * @param dungeonStats Statistiche del dungeon [Duration, Depth, TrapDensity, EnemyStrength, Drop_rate]
     * @param randomSeed Seme per la generazione di numeri casuali
     * @return success Esito della battaglia (true = vittoria, false = sconfitta)
     * @return remainingHealth Salute rimanente totale del party
     * @return xpEarned XP guadagnati (0 se sconfitta)
     * @return comEarned Token COM guadagnati (0 se sconfitta)
     * @return materialsEarned Array di materiali guadagnati (vuoto se sconfitta)
     */
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
    ) external onlyDungeonManager returns (
        bool success,
        uint256 remainingHealth,
        uint256 xpEarned,
        uint256 comEarned,
        uint256[] memory materialsEarned
    ) {
        if (randomSeed == 0) revert InvalidRandomSeed();

        // Estrai le statistiche del dungeon
        // [Duration, Depth, TrapDensity, EnemyStrength, Drop_rate]
        uint256 duration = dungeonStats[0];
        uint256 depth = dungeonStats[1];
        uint256 trapDensity = dungeonStats[2];
        uint256 enemyStrength = dungeonStats[3];
        uint256 dropRate = dungeonStats[4];
        
        // Verifica validità dei parametri
        if (duration < 1 || duration > 5) revert InvalidDungeonParameters();
        if (depth < 1 || depth > 3) revert InvalidDungeonParameters();
        if (trapDensity < 1 || trapDensity > 3) revert InvalidDungeonParameters();
        if (enemyStrength < 1 || enemyStrength > 5) revert InvalidDungeonParameters();
        
        // Calcola la salute totale iniziale del party
        uint256 totalInitialHealth = procione1Health + procione2Health + procione3Health;
        
        // Array della salute attuale dei procioni
        uint256[3] memory currentHealth = [procione1Health, procione2Health, procione3Health];
        
        // Calcola il numero di attacchi basato sulla Duration
        uint256 attackCount = calculateAttackCount(duration, randomSeed);
        
        // Calcola le statistiche del party (per eventuali bonus difensivi)
        (
            uint256 partyStrength,
            uint256 partySpeed,
            uint256 partyIntelligence,
            uint256 partyAccuracy
        ) = calculatePartyStats(
            procione1Id,
            procione2Id,
            procione3Id,
            equippedItems
        );
        
        // Esegui la simulazione dell'avventura
        uint256 totalDamage = 0;
        uint256 trapCount = 0;
        
        // Prima verifica se si incontra una trappola (una sola volta per dungeon)
        uint256 trapSeed = uint256(keccak256(abi.encodePacked(randomSeed, "trap")));
        bool trapTriggered = shouldTriggerTrap(trapDensity, trapSeed);
        
        // Se viene attivata una trappola, applica il danno
        if (trapTriggered) {
            trapCount = 1;
            
            // Calcola il danno da trappola (percentuale della salute massima)
            uint256 trapDamage = calculateTrapDamage(depth, totalInitialHealth);
            
            // Distribuisci il danno equamente tra i procioni ancora vivi
            uint256 aliveCount = 0;
            for (uint256 j = 0; j < 3; j++) {
                if (currentHealth[j] > 0) {
                    aliveCount++;
                }
            }
            
            if (aliveCount > 0) {
                uint256 damagePerProcione = trapDamage / aliveCount;
                
                for (uint256 j = 0; j < 3; j++) {
                    if (currentHealth[j] > 0) {
                        uint256 actualTrapDamage = damagePerProcione;
                        if (actualTrapDamage >= currentHealth[j]) {
                            actualTrapDamage = currentHealth[j];
                        }
                        
                        totalDamage += actualTrapDamage;
                        currentHealth[j] -= actualTrapDamage;
                    }
                }
            }
        }
        
        // Poi gestisci gli attacchi nemici
        for (uint256 i = 0; i < attackCount; i++) {
            // Usa un hash diverso per ogni attacco
            uint256 attackSeed = uint256(keccak256(abi.encodePacked(randomSeed, i)));
            
            // Determina il tipo di danno
            DamageType damageType = determineDamageType(enemyStrength, attackSeed);
            
            // Determina l'ammontare di danno
            uint256 damageAmount = calculateDamageAmount(damageType, attackSeed);
            
            // Determina quale procione viene colpito (casualmente)
            uint256 targetIndex = attackSeed % 3;
            
            // Verifica se c'è almeno un procione vivo
            bool anyAlive = false;
            for (uint256 j = 0; j < 3; j++) {
                if (currentHealth[j] > 0) {
                    anyAlive = true;
                    break;
                }
            }
            
            // Se non c'è nessun procione vivo, interrompi gli attacchi
            if (!anyAlive) break;
            
            // Se il procione selezionato è già KO, trova un altro procione vivo
            if (currentHealth[targetIndex] == 0) {
                for (uint256 j = 0; j < 3; j++) {
                    if (currentHealth[j] > 0) {
                        targetIndex = j;
                        break;
                    }
                }
            }
            
            // Applica il danno, gestendo il caso LETHAL
            if (damageType == DamageType.LETHAL) {
                // Il danno letale azzera completamente la salute del procione colpito
                totalDamage += currentHealth[targetIndex];
                currentHealth[targetIndex] = 0;
            } else {
                // Per gli altri tipi di danno, applica il danno normalmente
                uint256 actualDamage = damageAmount;
                if (actualDamage >= currentHealth[targetIndex]) {
                    actualDamage = currentHealth[targetIndex];
                }
                
                totalDamage += actualDamage;
                currentHealth[targetIndex] -= actualDamage;
            }
        }
        
        // Calcola la salute totale rimanente
        remainingHealth = currentHealth[0] + currentHealth[1] + currentHealth[2];
        
        // Determina l'esito della battaglia
        success = remainingHealth > 0;
        
        // Calcola le ricompense in caso di vittoria
        if (success) {
            xpEarned = calculateXpReward(dungeonId, dungeonStats);
            comEarned = calculateCOMReward(dungeonId, dungeonStats);
            materialsEarned = calculateMaterialRewards(dungeonStats, randomSeed);
        } else {
            xpEarned = 0;
            comEarned = 0;
            materialsEarned = new uint256[](0);
        }
        
        // Emetti l'evento con i risultati dettagliati della battaglia
        emit BattleDetailedResult(
            dungeonId,
            partyIndex,
            attackCount,
            trapCount,
            totalDamage
        );
        
        // Emetti l'evento con i risultati generali della battaglia
        emit DungeonBattleResult(
            dungeonId,
            partyIndex,
            success,
            remainingHealth,
            totalDamage,
            xpEarned,
            comEarned,
            materialsEarned
        );
        
        return (success, remainingHealth, xpEarned, comEarned, materialsEarned);
    }
    
    // ============ Battle Calculation Functions ============
    
    /**
     * @dev Calcola il numero di attacchi basato sulla Duration del dungeon
     * @param duration Durata del dungeon (1-5)
     * @param seed Seme casuale
     * @return Numero di attacchi
     */
    function calculateAttackCount(uint256 duration, uint256 seed) public view returns (uint256) {
        if (duration < 1 || duration > 5) revert InvalidDungeonParameters();
        
        uint8 min = ATTACK_RANGES[duration - 1][0];
        uint8 max = ATTACK_RANGES[duration - 1][1];
        uint256 range = max - min + 1;
        
        // Genera un numero casuale nel range [min, max]
        return min + (seed % range);
    }
    
    /**
     * @dev Determina il tipo di danno basato sulla EnemyStrength del dungeon
     * @param enemyStrength Forza dei nemici (1-5)
     * @param seed Seme casuale
     * @return Tipo di danno
     */
    function determineDamageType(uint256 enemyStrength, uint256 seed) public view returns (DamageType) {
        if (enemyStrength < 1 || enemyStrength > 5) revert InvalidDungeonParameters();
        
        uint8[5] storage probabilities = DAMAGE_PROBABILITIES[enemyStrength - 1];
        
        // Genera un numero casuale tra 1 e 100
        uint256 roll = (seed % 100) + 1;
        
        // Calcola il tipo di danno in base alla probabilità
        uint256 cumulativeProbability = 0;
        
        for (uint256 i = 0; i < probabilities.length; i++) {
            cumulativeProbability += probabilities[i];
            if (roll <= cumulativeProbability) {
                return DamageType(i);
            }
        }
        
        // Fallback (non dovrebbe mai accadere)
        return DamageType.NONE;
    }
    
    /**
     * @dev Calcola l'ammontare di danno basato sul tipo di danno
     * @param damageType Tipo di danno
     * @param seed Seme casuale
     * @return Ammontare di danno
     */
    function calculateDamageAmount(DamageType damageType, uint256 seed) public view returns (uint256) {
        uint8 min = DAMAGE_RANGES[uint256(damageType)][0];
        uint8 max = DAMAGE_RANGES[uint256(damageType)][1];
        
        // Per il danno letale, viene gestito in modo speciale
        if (damageType == DamageType.LETHAL) {
            // Restituisci un valore speciale per indicare il danno letale
            // (verrà interpretato come "tutta la salute rimanente" al momento dell'applicazione)
            return 100;
        }
        
        // Per gli altri tipi di danno, genera un numero casuale nel range [min, max]
        uint256 range = max - min + 1;
        return min + (seed % range);
    }
    
    /**
     * @dev Determina se una trappola viene attivata
     * @param trapDensity Densità delle trappole (1-3)
     * @param seed Seme casuale
     * @return True se la trappola è attivata, false altrimenti
     */
    function shouldTriggerTrap(uint256 trapDensity, uint256 seed) public view returns (bool) {
        if (trapDensity < 1 || trapDensity > 3) revert InvalidDungeonParameters();
        
        // Ottieni la probabilità di trappola in base a TrapDensity
        uint8 probability = TRAP_PROBABILITIES[trapDensity];
        
        // Genera un numero casuale tra 1 e 100
        uint256 roll = (seed % 100) + 1;
        
        // Verifica se la trappola è attivata
        return roll <= probability;
    }
    
    /**
     * @dev Calcola il danno da trappola in base alla Depth del dungeon
     * @param depth Profondità del dungeon (1-3)
     * @param totalHealth Salute totale del party
     * @return Ammontare di danno
     */
    function calculateTrapDamage(uint256 depth, uint256 totalHealth) public view returns (uint256) {
        if (depth < 1 || depth > 3) revert InvalidDungeonParameters();
        
        // Ottieni la percentuale di danno in base a Depth
        uint8 percentage = TRAP_DAMAGE_PERCENTAGES[depth];
        
        // Calcola il danno (percentuale della salute totale)
        return (totalHealth * percentage) / 100;
    }
    
    /**
     * @dev Ottiene le ricompense XP per un dungeon specifico
     * @param dungeonId ID del dungeon
     */
    function getDungeonXpReward(uint256 dungeonId) public view returns (uint256) {
        return customRewardsEnabled[dungeonId] ? dungeonXpRewards[dungeonId] : baseXpReward;
    }
    
    /**
     * @dev Ottiene le ricompense COM per un dungeon specifico
     * @param dungeonId ID del dungeon
     */
    function getDungeonCOMReward(uint256 dungeonId) public view returns (uint256) {
        return customRewardsEnabled[dungeonId] ? dungeonCOMRewards[dungeonId] : baseCOMReward;
    }
    
    /**
     * @dev Calcola le statistiche combinate del party
     */
    function calculatePartyStats(
        uint256 procione1Id,
        uint256 procione2Id,
        uint256 procione3Id,
        uint256[] calldata equippedItems
    ) internal view returns (
        uint256 totalStrength,
        uint256 totalSpeed,
        uint256 totalIntelligence,
        uint256 totalAccuracy
    ) {
        // Combina le statistiche dei procioni
        totalStrength = idleProcioneNFT.getStrength(procione1Id) +
                        idleProcioneNFT.getStrength(procione2Id) +
                        idleProcioneNFT.getStrength(procione3Id);
                        
        totalSpeed = idleProcioneNFT.getSpeed(procione1Id) +
                     idleProcioneNFT.getSpeed(procione2Id) +
                     idleProcioneNFT.getSpeed(procione3Id);
                     
        totalIntelligence = idleProcioneNFT.getIntelligence(procione1Id) +
                            idleProcioneNFT.getIntelligence(procione2Id) +
                            idleProcioneNFT.getIntelligence(procione3Id);
                            
        totalAccuracy = idleProcioneNFT.getAccuracy(procione1Id) +
                        idleProcioneNFT.getAccuracy(procione2Id) +
                        idleProcioneNFT.getAccuracy(procione3Id);
        
        // Aggiungi i bonus degli oggetti equipaggiati
        for (uint256 i = 0; i < equippedItems.length; i++) {
            uint256[5] memory itemBonus = craftingManager.getItemBonus(equippedItems[i]);
            // Assumiamo che i bonus degli oggetti siano: [HP, STR, SPD, INT, ACC]
            totalStrength += itemBonus[1];
            totalSpeed += itemBonus[2];
            totalIntelligence += itemBonus[3];
            totalAccuracy += itemBonus[4];
        }
        
        return (totalStrength, totalSpeed, totalIntelligence, totalAccuracy);
    }
    
    /**
     * @dev Calcola la ricompensa in XP
     */
    function calculateXpReward(uint256 dungeonId, uint256[5] calldata dungeonStats) internal view returns (uint256) {
        // Ricompensa fissa per il dungeon, personalizzata o base
        return getDungeonXpReward(dungeonId);
    }
    
    /**
     * @dev Calcola la ricompensa in token COM
     */
    function calculateCOMReward(uint256 dungeonId, uint256[5] calldata dungeonStats) internal view returns (uint256) {
        // Ricompensa fissa per il dungeon, personalizzata o base
        return getDungeonCOMReward(dungeonId);
    }
    
    /**
     * @dev Calcola i materiali guadagnati
     */
    function calculateMaterialRewards(uint256[5] calldata dungeonStats, uint256 randomSeed) internal pure returns (uint256[] memory) {
        // Estrai il drop rate
        uint256 dropRate = dungeonStats[4];
        
        // Determina il numero di materiali da assegnare basato sul drop rate
        uint256 materialCount = 0;
        if (randomSeed % 100 < dropRate) {
            materialCount = 1 + (randomSeed % 3); // 1-3 materiali
        }
        
        // Crea un array di materiali (gli ID effettivi sarebbero determinati altrove)
        uint256[] memory materials = new uint256[](materialCount);
        
        for (uint256 i = 0; i < materialCount; i++) {
            // Usa un hash diverso per ogni materiale
            uint256 materialSeed = uint256(keccak256(abi.encodePacked(randomSeed, "material", i)));
            // Genera ID di materiali (1001-1020)
            materials[i] = 1001 + (materialSeed % 20);
        }
        
        return materials;
    }
} 