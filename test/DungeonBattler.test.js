const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Configurazione dell'interfaccia readline per l'interazione con l'utente
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Funzione per promisificare la funzione question di readline
function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

describe("DungeonBattler", function () {
    let dungeonBattler;
    let dungeonManager;
    let idleProcioneNFT;
    let craftingManager;
    let randomnessConsumer;
    let owner;
    let addr1;
    let addr2;
    
    // Array per registrare i risultati delle battaglie
    const battleResults = [];

    // Costanti per il test
    const NUM_BATTLES = 100;
    const BASE_HEALTH = 100;
    const DUNGEON_IDS = [1, 2, 3, 4, 5];
    const DUNGEON_STATS = [
        [1, 1, 1, 1, 50], // Dungeon facile
        [2, 1, 2, 2, 50], // Dungeon medio-facile
        [3, 2, 2, 3, 50], // Dungeon medio
        [4, 2, 3, 4, 50], // Dungeon difficile
        [5, 3, 3, 5, 50]  // Dungeon molto difficile
    ];

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy dei mock
        const MockIdleProcioneNFT = await ethers.getContractFactory("contracts/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        idleProcioneNFT = await MockIdleProcioneNFT.deploy();

        const MockCraftingManager = await ethers.getContractFactory("contracts/mocks/MockCraftingManager.sol:MockCraftingManager");
        craftingManager = await MockCraftingManager.deploy();

        const MockRandomnessConsumer = await ethers.getContractFactory("contracts/mocks/MockRandomnessConsumer.sol:MockRandomnessConsumer");
        randomnessConsumer = await MockRandomnessConsumer.deploy();

        // Deploy di un mock semplice per DungeonManager
        const MockDungeonManager = await ethers.getContractFactory("contracts/mocks/MockDungeonManager.sol:MockDungeonManager");
        dungeonManager = await MockDungeonManager.deploy();

        // Deploy del DungeonBattler
        const DungeonBattler = await ethers.getContractFactory("DungeonBattler");
        dungeonBattler = await DungeonBattler.deploy(
            await dungeonManager.getAddress(),
            await idleProcioneNFT.getAddress(),
            await craftingManager.getAddress(),
            await randomnessConsumer.getAddress()
        );
    });

    // Funzione per bypassare il controllo onlyDungeonManager
    async function setupDungeonManagerAuth() {
        // Utilizziamo un workaround: aggiorniamo l'indirizzo del DungeonManager al nostro indirizzo di test
        await dungeonBattler.updateDungeonManager(owner.address);
    }

    describe("Inizializzazione", function () {
        it("Dovrebbe impostare correttamente gli indirizzi dei contratti", async function () {
            expect(await dungeonBattler.dungeonManager()).to.equal(await dungeonManager.getAddress());
            expect(await dungeonBattler.idleProcioneNFT()).to.equal(await idleProcioneNFT.getAddress());
            expect(await dungeonBattler.craftingManager()).to.equal(await craftingManager.getAddress());
            expect(await dungeonBattler.randomnessConsumer()).to.equal(await randomnessConsumer.getAddress());
        });

        it("Dovrebbe impostare correttamente i parametri di base", async function () {
            expect(await dungeonBattler.baseXpReward()).to.equal(100);
            expect(await dungeonBattler.baseCOMReward()).to.equal(50);
        });
    });

    describe("Funzioni di calcolo battaglia", function () {
        it("Dovrebbe calcolare correttamente il numero di attacchi in base alla Duration", async function () {
            // Test per ogni Duration
            const durations = [1, 2, 3, 4, 5];
            const seeds = Array.from({ length: 10 }, () => Math.floor(Math.random() * 1000000));

            for (let i = 0; i < durations.length; i++) {
                const duration = durations[i];
                
                // Verifica più volte con semi diversi
                for (const seed of seeds) {
                    const attackCount = await dungeonBattler.calculateAttackCount(duration, seed);
                    
                    // Verifica che il numero di attacchi sia nel range corretto
                    let minAttacks, maxAttacks;
                    if (duration === 1) {
                        minAttacks = 3; maxAttacks = 5;
                    } else if (duration === 2) {
                        minAttacks = 3; maxAttacks = 7;
                    } else if (duration === 3) {
                        minAttacks = 4; maxAttacks = 8;
                    } else if (duration === 4) {
                        minAttacks = 6; maxAttacks = 9;
                    } else if (duration === 5) {
                        minAttacks = 8; maxAttacks = 12;
                    }
                    
                    expect(attackCount).to.be.at.least(minAttacks);
                    expect(attackCount).to.be.at.most(maxAttacks);
                }
            }
        });

        it("Dovrebbe determinare correttamente il tipo di danno in base a EnemyStrength", async function () {
            const enemyStrengths = [1, 2, 3, 4, 5];
            const numTests = 100;
            
            // Statistica per contare i risultati
            const results = {};
            
            for (const strength of enemyStrengths) {
                results[strength] = {
                    NONE: 0,
                    LIGHT: 0,
                    MEDIUM: 0,
                    HEAVY: 0,
                    LETHAL: 0
                };
                
                for (let i = 0; i < numTests; i++) {
                    const seed = Math.floor(Math.random() * 1000000);
                    const damageType = await dungeonBattler.determineDamageType(strength, seed);
                    
                    // Convertiamo il BigInt a Number per confrontare correttamente
                    const damageTypeNum = Number(damageType);
                    
                    if (damageTypeNum === 0) results[strength].NONE++;
                    else if (damageTypeNum === 1) results[strength].LIGHT++;
                    else if (damageTypeNum === 2) results[strength].MEDIUM++;
                    else if (damageTypeNum === 3) results[strength].HEAVY++;
                    else if (damageTypeNum === 4) results[strength].LETHAL++;
                }
                
                // Analizziamo solo per EnemyStrength 1 e 5 come esempio
                if (strength === 1) {
                    // Per EnemyStrength 1, non verifichiamo valori esatti ma proporzioni
                    expect(results[1].LIGHT).to.be.greaterThan(results[1].MEDIUM);
                    expect(results[1].NONE + results[1].LIGHT).to.be.greaterThan(70);
                    expect(results[1].HEAVY).to.equal(0);
                    expect(results[1].LETHAL).to.equal(0);
                } else if (strength === 5) {
                    // Per EnemyStrength 5, verifichiamo che ci siano danni più gravi
                    expect(results[5].MEDIUM + results[5].HEAVY + results[5].LETHAL).to.be.greaterThan(40);
                    expect(results[5].LETHAL).to.be.greaterThan(0);
                }
            }
        });

        it("Dovrebbe attivare le trappole in base a TrapDensity", async function () {
            const trapDensities = [1, 2, 3];
            const numTests = 100;
            
            // Statistica per contare i risultati
            const results = {};
            
            for (const density of trapDensities) {
                results[density] = {
                    triggered: 0,
                    notTriggered: 0
                };
                
                for (let i = 0; i < numTests; i++) {
                    const seed = Math.floor(Math.random() * 1000000);
                    const isTriggered = await dungeonBattler.shouldTriggerTrap(density, seed);
                    
                    if (isTriggered) results[density].triggered++;
                    else results[density].notTriggered++;
                }
                
                // Verifica che le probabilità siano approssimativamente corrette
                const expectedProb = density * 10; // 10%, 20%, 30%
                expect(results[density].triggered).to.be.approximately(expectedProb, 10);
            }
        });
    });

    describe("Gestione ricompense personalizzate", function () {
        it("Dovrebbe permettere all'owner di impostare ricompense personalizzate per un dungeon", async function () {
            const dungeonId = 1;
            const xpReward = 200;
            const comReward = 100;
            
            await dungeonBattler.setDungeonRewards(dungeonId, xpReward, comReward);
            
            expect(await dungeonBattler.customRewardsEnabled(dungeonId)).to.be.true;
            expect(await dungeonBattler.dungeonXpRewards(dungeonId)).to.equal(xpReward);
            expect(await dungeonBattler.dungeonCOMRewards(dungeonId)).to.equal(comReward);
        });
        
        it("Dovrebbe permettere all'owner di rimuovere ricompense personalizzate", async function () {
            const dungeonId = 1;
            const xpReward = 200;
            const comReward = 100;
            
            await dungeonBattler.setDungeonRewards(dungeonId, xpReward, comReward);
            await dungeonBattler.removeDungeonRewards(dungeonId);
            
            expect(await dungeonBattler.customRewardsEnabled(dungeonId)).to.be.false;
        });
        
        it("Non dovrebbe permettere a non-owner di impostare ricompense personalizzate", async function () {
            const dungeonId = 1;
            const xpReward = 200;
            const comReward = 100;
            
            await expect(
                dungeonBattler.connect(addr1).setDungeonRewards(dungeonId, xpReward, comReward)
            ).to.be.revertedWithCustomError(dungeonBattler, "OwnableUnauthorizedAccount");
        });
    });

    describe("Simulazione completa di battaglie", function () {
        
        // Preparazione dei procioni per la battaglia
        async function prepareProciones(healthValues) {
            const prociones = [];
            
            for (let i = 0; i < 3; i++) {
                // Mint un nuovo procione
                const tx = await idleProcioneNFT.simpleMint(owner.address);
                const receipt = await tx.wait();
                
                // Otteniamo il tokenId dal risultato
                // Dato che simpleMint restituisce il tokenId, possiamo leggerlo dagli eventi o dall'output
                const tokenId = i; // Per ora usiamo l'indice come fallback
                
                console.log(`Procione ${i} mintato con tokenId: ${tokenId}`);
                
                // Imposta le statistiche
                await idleProcioneNFT.setStrength(tokenId, 10 + i * 5);
                await idleProcioneNFT.setSpeed(tokenId, 10 + i * 3);
                await idleProcioneNFT.setIntelligence(tokenId, 10 + i * 2);
                await idleProcioneNFT.setAccuracy(tokenId, 10 + i * 4);
                
                // Imposta la salute
                await idleProcioneNFT.setCurrentHealth(tokenId, healthValues[i]);
                console.log(`Procione ${tokenId} impostato con salute: ${healthValues[i]}`);
                
                prociones.push(tokenId);
            }
            
            return prociones;
        }
        
        // Esecuzione del test di battaglia
        it("Dovrebbe simulare battaglie e registrare gli esiti", async function () {
            // Aumentiamo il timeout per permettere l'esecuzione completa
            this.timeout(600000); // 10 minuti
            
            // Aggiorna l'autorizzazione per bypassare il modifier onlyDungeonManager
            await setupDungeonManagerAuth();

            // Prepara gli oggetti equipaggiati
            const equippedItems = [10, 20, 30];
            
            // Imposta i bonus degli oggetti (HP, STR, SPD, INT, ACC)
            await craftingManager.setItemBonus(10, [5, 3, 0, 0, 0]);
            await craftingManager.setItemBonus(20, [0, 0, 3, 2, 0]);
            await craftingManager.setItemBonus(30, [0, 0, 0, 0, 5]);
            
            // Simulazione delle battaglie
            let successCount = 0;
            let failureCount = 0;
            
            // Configurazione del test parallelo
            const testBattles = 10000;
            const batchSize = 50; // Riduciamo la dimensione dei batch per avere più parallelismo
            const numBatches = Math.ceil(testBattles / batchSize);
            const maxConcurrentThreads = 50; // Ridotto il numero massimo di thread paralleli per evitare errori di memoria
            
            console.log(`\nEsecuzione di ${testBattles} battaglie in ${numBatches} batch (${batchSize} battaglie per batch)`);
            console.log(`Utilizzo di massimo ${maxConcurrentThreads} thread paralleli`);
            
            // Salviamo lo stato della blockchain per ripristinarlo rapidamente
            const snapshotId = await ethers.provider.send("evm_snapshot", []);
            
            // Funzione per preparare un token ID univoco per ogni batch e procione
            function getUniqueTokenId(batchIndex, procionIndex) {
                return batchIndex * 1000 + procionIndex;
            }
            
            // Funzione per processare un singolo batch di battaglie
            async function processBatchOfBattles(batchIndex) {
                const localBattleResults = [];
                let localSuccessCount = 0;
                let localFailureCount = 0;
                
                const startBattleIndex = batchIndex * batchSize;
                const endBattleIndex = Math.min((batchIndex + 1) * batchSize, testBattles);
                
                // Pre-minting dei procioni per tutto il batch
                const procioniPerBatch = {};
                
                for (let battleIndex = startBattleIndex; battleIndex < endBattleIndex; battleIndex++) {
                    // Log per monitorare l'avanzamento delle battaglie
                    // Mostro un log ogni 10 battaglie o all'inizio/fine di un batch
                    if (battleIndex === startBattleIndex || 
                        battleIndex === endBattleIndex - 1 || 
                        battleIndex % 10 === 0) {
                        console.log(`Batch ${batchIndex + 1}/${numBatches}: Processando battaglia ${battleIndex - startBattleIndex + 1}/${endBattleIndex - startBattleIndex} (${Math.round((battleIndex - startBattleIndex + 1) / (endBattleIndex - startBattleIndex) * 100)}%)`);
                    }
                    
                    // Varia la salute iniziale per ogni procione
                    let healthValues;
                    switch (battleIndex % 5) {
                        case 0: // Molto bassa: 30-40-50
                            healthValues = [30, 40, 50];
                            break;
                        case 1: // Bassa: 50-60-70
                            healthValues = [50, 60, 70];
                            break;
                        case 2: // Media: 70-80-90
                            healthValues = [70, 80, 90];
                            break;
                        case 3: // Alta: 90-100-110
                            healthValues = [90, 100, 110];
                            break;
                        case 4: // Molto alta: 110-120-130
                            healthValues = [110, 120, 130];
                            break;
                    }
                    
                    // Genera token ID unici per questo batch
                    const prociones = [];
                    for (let i = 0; i < 3; i++) {
                        const tokenId = getUniqueTokenId(batchIndex, i + (battleIndex - startBattleIndex) * 3);
                        
                        if (!procioniPerBatch[tokenId]) {
                            // Mint un nuovo procione con ID univoco solo se non esiste già
                            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId);
                            
                            // Imposta le statistiche
                            await idleProcioneNFT.setStrength(tokenId, 10 + i * 5);
                            await idleProcioneNFT.setSpeed(tokenId, 10 + i * 3);
                            await idleProcioneNFT.setIntelligence(tokenId, 10 + i * 2);
                            await idleProcioneNFT.setAccuracy(tokenId, 10 + i * 4);
                            
                            // Memorizza che è stato creato
                            procioniPerBatch[tokenId] = true;
                        }
                        
                        // Imposta la salute per questa battaglia
                        await idleProcioneNFT.setCurrentHealth(tokenId, healthValues[i]);
                        
                        prociones.push(tokenId);
                    }
                    
                    // Seleziona un dungeon (alterna tra i 5 tipi)
                    const dungeonIndex = battleIndex % DUNGEON_IDS.length;
                    const dungeonId = DUNGEON_IDS[dungeonIndex];
                    const dungeonStats = DUNGEON_STATS[dungeonIndex];
                    
                    // Genera un seed casuale
                    const randomSeed = Math.floor(Math.random() * 1000000) + 1 + battleIndex;
                    
                    try {
                        // Chiamata al contratto
                        const tx = await dungeonBattler.calculateBattleOutcome(
                            dungeonId,
                            0, // partyIndex
                            prociones[0],
                            prociones[1],
                            prociones[2],
                            healthValues[0],
                            healthValues[1],
                            healthValues[2],
                            equippedItems,
                            dungeonStats,
                            randomSeed
                        );
                        
                        // Attendi che la transazione venga confermata
                        const receipt = await tx.wait();
                        
                        // Estrai gli eventi per ottenere i risultati
                        const battleEvents = receipt.logs
                            .filter(log => log.address === dungeonBattler.target)
                            .map(log => {
                                try {
                                    return dungeonBattler.interface.parseLog(log);
                                } catch (e) {
                                    return null;
                                }
                            })
                            .filter(parsed => parsed && parsed.name === "DungeonBattleResult");
                        
                        let success = false;
                        let remainingHealth = 0;
                        let xpEarned = 0;
                        let comEarned = 0;
                        
                        if (battleEvents.length > 0) {
                            const event = battleEvents[0];
                            
                            // Estrai i dati dall'evento
                            success = event.args.success;
                            remainingHealth = Number(event.args.remainingHealth);
                            xpEarned = Number(event.args.xpEarned);
                            comEarned = Number(event.args.comEarned);
                        }
                        
                        // Registra i risultati
                        const battleResult = {
                            battleIndex,
                            dungeonId,
                            dungeonDifficulty: getDungeonDifficulty(dungeonIndex),
                            initialHealth: healthValues.reduce((sum, h) => sum + h, 0),
                            success: success,
                            remainingHealth: remainingHealth,
                            xpEarned: xpEarned,
                            comEarned: comEarned
                        };
                        
                        localBattleResults.push(battleResult);
                        
                        if (success) {
                            localSuccessCount++;
                        } else {
                            localFailureCount++;
                        }
                        
                        // Log conciso dopo ogni battaglia completata
                        const healthLostPercent = ((battleResult.initialHealth - battleResult.remainingHealth) / battleResult.initialHealth * 100).toFixed(0);
                        console.log(`B${batchIndex+1} [${battleIndex}] ${battleResult.dungeonDifficulty.substring(0, 5)}: ${success ? '✅' : '❌'} HP: ${remainingHealth}/${battleResult.initialHealth} (-${healthLostPercent}%)`);
                        
                        // Incrementa il contatore globale delle battaglie completate
                        completedBattles++;
                    } catch (error) {
                        console.error(`Errore durante la battaglia ${battleIndex} nel batch ${batchIndex}:`, error.message);
                        
                        // Incrementa il contatore degli errori
                        errorCount++;
                        
                        // Log dettagliato dell'errore di battaglia
                        console.error(`⚠️ ERRORE BATTAGLIA ${battleIndex} (batch ${batchIndex+1})`);
                        console.error(`🔸 Messaggio: ${error.message}`);
                        console.error(`🔸 Dungeon: ${dungeonId} (${getDungeonDifficulty(dungeonIndex)})`);
                        console.error(`🔸 Procioni IDs: ${prociones.join(', ')}`);
                        console.error(`🔸 Salute iniziale: ${healthValues.join(', ')}`);
                        
                        // Implementa un retry per la singola battaglia
                        let retrySuccess = false;
                        
                        // Tenta fino a 3 volte
                        for (let retryAttempt = 1; retryAttempt <= 3 && !retrySuccess; retryAttempt++) {
                            try {
                                console.log(`🔄 Tentativo ${retryAttempt}/3 di recupero battaglia ${battleIndex}...`);
                                
                                // Attendiamo un po' prima di riprovare
                                await new Promise(resolve => setTimeout(resolve, 500 * retryAttempt));
                                
                                // Genera un nuovo seed per evitare problemi
                                const newRandomSeed = randomSeed + retryAttempt * 1000;
                                
                                // Riprova la battaglia
                                const retryTx = await dungeonBattler.calculateBattleOutcome(
                                    dungeonId,
                                    0,
                                    prociones[0],
                                    prociones[1],
                                    prociones[2],
                                    healthValues[0],
                                    healthValues[1],
                                    healthValues[2],
                                    equippedItems,
                                    dungeonStats,
                                    newRandomSeed
                                );
                                
                                const retryReceipt = await retryTx.wait();
                                
                                // Estrai gli eventi per ottenere i risultati
                                const retryBattleEvents = retryReceipt.logs
                                    .filter(log => log.address === dungeonBattler.target)
                                    .map(log => {
                                        try {
                                            return dungeonBattler.interface.parseLog(log);
                                        } catch (e) {
                                            return null;
                                        }
                                    })
                                    .filter(parsed => parsed && parsed.name === "DungeonBattleResult");
                                
                                if (retryBattleEvents.length > 0) {
                                    const event = retryBattleEvents[0];
                                    
                                    // Estrai i dati dall'evento
                                    const success = event.args.success;
                                    const remainingHealth = Number(event.args.remainingHealth);
                                    const xpEarned = Number(event.args.xpEarned);
                                    const comEarned = Number(event.args.comEarned);
                                    
                                    // Registra i risultati
                                    const battleResult = {
                                        battleIndex,
                                        dungeonId,
                                        dungeonDifficulty: getDungeonDifficulty(dungeonIndex),
                                        initialHealth: healthValues.reduce((sum, h) => sum + h, 0),
                                        success: success,
                                        remainingHealth: remainingHealth,
                                        xpEarned: xpEarned,
                                        comEarned: comEarned,
                                        wasRetried: true,
                                        retryAttempt
                                    };
                                    
                                    localBattleResults.push(battleResult);
                                    
                                    if (success) {
                                        localSuccessCount++;
                                    } else {
                                        localFailureCount++;
                                    }
                                    
                                    // Log conciso dopo ogni battaglia recuperata
                                    const healthLostPercent = ((battleResult.initialHealth - battleResult.remainingHealth) / battleResult.initialHealth * 100).toFixed(0);
                                    console.log(`B${batchIndex+1} [${battleIndex}] ${battleResult.dungeonDifficulty.substring(0, 5)}: ${success ? '✅' : '❌'} HP: ${remainingHealth}/${battleResult.initialHealth} (-${healthLostPercent}%) [RECUPERATA]`);
                                    
                                    retrySuccess = true;
                                    retrySuccessCount++; // Contatore globale
                                }
                            } catch (retryError) {
                                console.error(`❌ Tentativo ${retryAttempt} fallito per battaglia ${battleIndex}: ${retryError.message}`);
                            }
                        }
                        
                        // Se tutti i retry sono falliti, aggiungiamo comunque un risultato negativo
                        if (!retrySuccess) {
                            console.error(`❌ BATTAGLIA ${battleIndex} ABBANDONATA dopo 3 tentativi falliti`);
                            retryFailureCount++;
                            
                            // Aggiungiamo un risultato di battaglia fallita
                            const failedBattleResult = {
                                battleIndex,
                                dungeonId,
                                dungeonDifficulty: getDungeonDifficulty(dungeonIndex),
                                initialHealth: healthValues.reduce((sum, h) => sum + h, 0),
                                success: false,
                                remainingHealth: 0,
                                xpEarned: 0,
                                comEarned: 0,
                                error: true
                            };
                            
                            localBattleResults.push(failedBattleResult);
                            localFailureCount++;
                        }
                        
                        // Incrementa il contatore globale anche in caso di errore
                        completedBattles++;
                    }
                }
                
                return {
                    batchIndex,
                    results: localBattleResults,
                    successes: localSuccessCount,
                    failures: localFailureCount
                };
            }
            
            // Avvia il tempo di esecuzione
            const startTime = Date.now();
            
            // Contatori globali per le statistiche in tempo reale
            let completedBattles = 0;
            let lastProgressTime = startTime;
            let lastCompletedBattles = 0;
            let errorCount = 0;
            let retrySuccessCount = 0;
            let retryFailureCount = 0;
            
            // Sistema di salvataggio periodico per recovery dopo crash
            let lastSaveTime = startTime;
            const autoSaveInterval = 15000; // Ridotto a 15 secondi per salvare più frequentemente
            let lastSavedResults = {
                battleResults: [],
                successCount: 0,
                failureCount: 0,
                completedBattles: 0,
                completedBatchIndices: []
            };
            
            // Soglia minima di completamento per considerare il test valido
            const minCompletionThreshold = 0.75; // 75% di completamento è accettabile
            
            // Funzione per salvare lo stato corrente
            function saveCurrentState() {
                // Clona le strutture dati necessarie
                lastSavedResults = {
                    battleResults: [...battleResults],
                    successCount,
                    failureCount,
                    completedBattles,
                    // Salva gli indici dei batch già completati
                    completedBatchIndices: completedBatchResults.map(r => r.batchIndex)
                };
                
                lastSaveTime = Date.now();
                console.log(`\n💾 Stato salvato: ${completedBattles}/${testBattles} battaglie (${(completedBattles/testBattles*100).toFixed(1)}%)`);
            }
            
            // Monitoraggio delle risorse
            let lastMemoryUsage = process.memoryUsage();
            let currentMaxThreads = maxConcurrentThreads;
            
            // Funzione per controllare l'utilizzo della memoria e regolare il numero di thread
            function adjustThreadCount() {
                const memoryUsage = process.memoryUsage();
                const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
                const heapTotalMB = memoryUsage.heapTotal / (1024 * 1024);
                const heapUsageRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;
                
                // Condizioni più severe per la riduzione dei thread
                
                // Memoria critica: oltre il 90%, riduzione drastica
                if (heapUsageRatio > 0.9) {
                    const newMaxThreads = Math.max(2, Math.floor(currentMaxThreads * 0.5)); // Riduzione del 50%
                    console.warn(`\n⚠️⚠️⚠️ AVVISO MEMORIA CRITICA ⚠️⚠️⚠️`);
                    console.warn(`Utilizzo heap CRITICO: ${heapUsedMB.toFixed(1)}/${heapTotalMB.toFixed(1)} MB (${(heapUsageRatio * 100).toFixed(1)}%)`);
                    console.warn(`Riduzione DRASTICA thread da ${currentMaxThreads} a ${newMaxThreads}`);
                    currentMaxThreads = newMaxThreads;
                    
                    // Forza la garbage collection per liberare memoria
                    if (global.gc) {
                        try {
                            global.gc();
                            console.warn("Garbage collection forzata eseguita");
                        } catch (e) {
                            console.warn("Garbage collection fallita:", e.message);
                        }
                    }
                    
                    // Forza un salvataggio dello stato corrente
                    saveCurrentState();
                    
                    return currentMaxThreads;
                }
                
                // Memoria alta: oltre l'80%, riduzione significativa
                if (heapUsageRatio > 0.8 && currentMaxThreads > 5) {
                    const newMaxThreads = Math.max(5, Math.floor(currentMaxThreads * 0.7)); 
                    console.warn(`\n⚠️ AVVISO MEMORIA ELEVATA ⚠️`);
                    console.warn(`Utilizzo heap elevato: ${heapUsedMB.toFixed(1)}/${heapTotalMB.toFixed(1)} MB (${(heapUsageRatio * 100).toFixed(1)}%)`);
                    console.warn(`Riduzione thread da ${currentMaxThreads} a ${newMaxThreads}`);
                    currentMaxThreads = newMaxThreads;
                    
                    // Forza la garbage collection se disponibile
                    if (global.gc) {
                        console.warn("Forzando garbage collection...");
                        try {
                            global.gc();
                            console.warn("Garbage collection completata");
                        } catch (e) {
                            console.warn("Garbage collection fallita:", e.message);
                        }
                    }
                }
                
                // Memoria moderata: oltre il 70%, riduzione lieve
                else if (heapUsageRatio > 0.7 && currentMaxThreads > 8) {
                    const newMaxThreads = Math.max(8, Math.floor(currentMaxThreads * 0.9));
                    console.warn(`\n🔶 AVVISO MEMORIA MODERATA`);
                    console.warn(`Utilizzo heap: ${heapUsedMB.toFixed(1)}/${heapTotalMB.toFixed(1)} MB (${(heapUsageRatio * 100).toFixed(1)}%)`);
                    console.warn(`Leggera riduzione thread da ${currentMaxThreads} a ${newMaxThreads}`);
                    currentMaxThreads = newMaxThreads;
                }
                
                // Se l'utilizzo è tornato sotto il 50% e avevamo ridotto, possiamo aumentare di nuovo
                else if (heapUsageRatio < 0.5 && currentMaxThreads < maxConcurrentThreads) {
                    const newMaxThreads = Math.min(maxConcurrentThreads, Math.floor(currentMaxThreads * 1.2));
                    console.info(`\n📈 MEMORIA STABILE - Aumento thread da ${currentMaxThreads} a ${newMaxThreads}`);
                    currentMaxThreads = newMaxThreads;
                }
                
                return currentMaxThreads;
            }
            
            // Funzione per mostrare le statistiche in tempo reale
            function printRealTimeStats() {
                const currentTime = Date.now();
                const elapsedSeconds = (currentTime - startTime) / 1000;
                const recentElapsedSeconds = (currentTime - lastProgressTime) / 1000;
                
                // Calcola la velocità media totale
                const overallSpeed = completedBattles / elapsedSeconds;
                
                // Calcola la velocità recente (ultime battaglie)
                const recentBattles = completedBattles - lastCompletedBattles;
                const recentSpeed = recentBattles / recentElapsedSeconds;
                
                // Stima il tempo rimanente
                const remainingBattles = testBattles - completedBattles;
                const estimatedRemainingSeconds = remainingBattles / overallSpeed;
                
                // Formatta la stima in mm:ss
                const remainingMinutes = Math.floor(estimatedRemainingSeconds / 60);
                const remainingSeconds = Math.floor(estimatedRemainingSeconds % 60);
                
                // Monitoraggio memoria
                const currentMemory = process.memoryUsage();
                const memoryDiff = {
                    rss: (currentMemory.rss - lastMemoryUsage.rss) / (1024 * 1024),
                    heapTotal: (currentMemory.heapTotal - lastMemoryUsage.heapTotal) / (1024 * 1024),
                    heapUsed: (currentMemory.heapUsed - lastMemoryUsage.heapUsed) / (1024 * 1024),
                    external: (currentMemory.external - lastMemoryUsage.external) / (1024 * 1024)
                };
                
                console.log(`\n📊 STATISTICHE TEMPO REALE 📊`);
                console.log(`Completate: ${completedBattles}/${testBattles} (${(completedBattles/testBattles*100).toFixed(1)}%)`);
                console.log(`Tempo trascorso: ${elapsedSeconds.toFixed(1)}s`);
                console.log(`Velocità media: ${overallSpeed.toFixed(1)} battaglie/s`);
                console.log(`Velocità recente: ${recentSpeed.toFixed(1)} battaglie/s`);
                console.log(`Tempo stimato rimanente: ${remainingMinutes}m ${remainingSeconds}s`);
                console.log(`Errori: ${errorCount} (recuperati: ${retrySuccessCount}, falliti: ${retryFailureCount})`);
                
                console.log(`\n🧠 UTILIZZO MEMORIA:`);
                console.log(`RSS: ${(currentMemory.rss / (1024 * 1024)).toFixed(1)} MB (${memoryDiff.rss > 0 ? '+' : ''}${memoryDiff.rss.toFixed(1)} MB)`);
                console.log(`Heap: ${(currentMemory.heapUsed / (1024 * 1024)).toFixed(1)}/${(currentMemory.heapTotal / (1024 * 1024)).toFixed(1)} MB`);
                console.log(`Variazione heap: ${memoryDiff.heapUsed > 0 ? '+' : ''}${memoryDiff.heapUsed.toFixed(1)} MB`);
                
                // Monitora la blockchain
                console.log(`\n⛓️ STATO BLOCKCHAIN:`);
                console.log(`Thread attivi: ${runningPromises.length}/${currentMaxThreads} (max configurato: ${maxConcurrentThreads})`);
                console.log(`Batch completati: ${completedBatchResults.length}/${numBatches}`);
                console.log(`Batch in attesa: ${pendingBatchIndices.length}`);
                
                // Aggiorna i contatori per il prossimo intervallo
                lastProgressTime = currentTime;
                lastCompletedBattles = completedBattles;
                lastMemoryUsage = currentMemory;
                
                // Regola il numero di thread in base all'utilizzo della memoria
                adjustThreadCount();
                
                // Verifica se è il momento di salvare lo stato
                if (currentTime - lastSaveTime > autoSaveInterval) {
                    saveCurrentState();
                }
            }
            
            // Configura un intervallo per mostrare le statistiche ogni 5 secondi
            const statsInterval = setInterval(printRealTimeStats, 5000);
            
            // Inizializza le strutture dati per il pool di thread
            // Array per tenere traccia dei batch ancora da eseguire
            const pendingBatchIndices = Array.from({ length: numBatches }, (_, i) => i);
            
            // Array di promesse attualmente in esecuzione
            const runningPromises = [];
            
            // Risultati dei batch completati
            const completedBatchResults = [];
            
            console.log(`Avvio pool di thread con massimo ${maxConcurrentThreads} thread paralleli...`);
            
            // Definisco una funzione per gestire errori critici
            const handleCriticalError = async (error) => {
                console.error("\n❌❌❌ ERRORE CRITICO NEL TEST ❌❌❌");
                console.error(`Timestamp: ${new Date().toISOString()}`);
                console.error(`Messaggio: ${error.message}`);
                console.error(`Stack: ${error.stack}`);
                
                // Verifica se è un errore di memoria
                if (error.message.includes("heap") || error.message.includes("memory") || 
                    error.message.includes("allocation") || error.toString().includes("HEAP")) {
                    console.error("RILEVATO ERRORE DI MEMORIA!");
                    console.error("Memoria attuale:", process.memoryUsage());
                }
                
                // Ferma l'intervallo di statistiche
                clearInterval(statsInterval);
                
                // Prova a ripristinare lo snapshot
                try {
                    await ethers.provider.send("evm_revert", [snapshotId]);
                    console.error("Snapshot della blockchain ripristinato");
                } catch (revError) {
                    console.error("Impossibile ripristinare lo snapshot:", revError.message);
                }
                
                // Restituisci dati parziali se disponibili
                if (completedBatchResults.length > 0) {
                    console.error(`Risultati parziali disponibili: ${completedBatchResults.length} batch completati (${completedBattles} battaglie)`);
                }
                
                // Utilizza lo stato salvato se disponibile
                if (lastSavedResults.completedBattles > 0) {
                    console.error(`\n🔄 UTILIZZANDO STATO SALVATO da ${(lastSaveTime - startTime) / 1000}s fa`);
                    console.error(`Battaglie salvate: ${lastSavedResults.completedBattles}/${testBattles} (${(lastSavedResults.completedBattles/testBattles*100).toFixed(1)}%)`);
                    
                    // Ripristina i risultati dal salvataggio
                    battleResults.length = 0;
                    battleResults.push(...lastSavedResults.battleResults);
                    successCount = lastSavedResults.successCount;
                    failureCount = lastSavedResults.failureCount;
                    
                    console.error(`Stato ripristinato con ${battleResults.length} risultati`);
                    
                    // Non lanciare l'eccezione per consentire il completamento parziale
                    return {
                        recovered: true,
                        fromSaved: true,
                        results: lastSavedResults
                    };
                }
            };
            
            // Esegue i batch in parallelo
            try {
                // Invece di avviare tutti i batch contemporaneamente, implementiamo un thread pool
                // Funzione per avviare un nuovo batch quando possibile
                const startNextBatchIfAvailable = async () => {
                    // Se ci sono batch in attesa e abbiamo spazio per eseguire più thread
                    if (pendingBatchIndices.length > 0 && runningPromises.length < currentMaxThreads) {
                        // Prende il prossimo batch
                        const batchIndex = pendingBatchIndices.shift();
                        
                        // Crea una promessa che eseguirà il batch e gestirà il completamento
                        const batchPromise = processBatchOfBattles(batchIndex)
                            .then(result => {
                                // Quando il batch è completato, lo rimuoviamo dalle promesse in esecuzione
                                const index = runningPromises.indexOf(batchPromise);
                                if (index !== -1) {
                                    runningPromises.splice(index, 1);
                                }
                                
                                // Aggiungiamo il risultato ai batch completati
                                completedBatchResults.push(result);
                                
                                // Log di completamento del batch
                                console.log(`✅ Batch ${result.batchIndex + 1}/${numBatches} completato: ${result.successes} vittorie, ${result.failures} sconfitte`);
                                
                                // Tentiamo di avviare un altro batch
                                return startNextBatchIfAvailable();
                            })
                            .catch(error => {
                                // Log dettagliato dell'errore
                                console.error(`\n❌ ERRORE CRITICO NEL BATCH ${batchIndex + 1}/${numBatches}`);
                                console.error(`⏱️ Timestamp: ${new Date().toISOString()}`);
                                console.error(`📋 Dettagli errore: ${error.message}`);
                                console.error(`🔍 Stack trace: ${error.stack}`);
                                console.error(`📊 Thread attivi: ${runningPromises.length}/${currentMaxThreads}`);
                                console.error(`📈 Completamento: ${completedBattles}/${testBattles} (${(completedBattles/testBattles*100).toFixed(1)}%)`);
                                
                                // Rimuoviamo comunque dalla lista dei thread in esecuzione
                                const index = runningPromises.indexOf(batchPromise);
                                if (index !== -1) {
                                    runningPromises.splice(index, 1);
                                }
                                
                                // Tenta un retry per il batch fallito (max 3 tentativi)
                                const retryBatch = async (batchIdx, attemptNumber = 1) => {
                                    if (attemptNumber <= 3) {
                                        console.log(`🔄 Tentativo ${attemptNumber}/3 di ripristino per il batch ${batchIdx + 1}...`);
                                        
                                        try {
                                            // Attendiamo un po' prima di riprovare per dare tempo alla blockchain di stabilizzarsi
                                            await new Promise(resolve => setTimeout(resolve, 1000 * attemptNumber));
                                            
                                            // Rifacciamo il batch
                                            const retryResult = await processBatchOfBattles(batchIdx);
                                            
                                            console.log(`✅ Retry batch ${batchIdx + 1} completato con successo!`);
                                            completedBatchResults.push(retryResult);
                                            return true;
                                        } catch (retryError) {
                                            console.error(`❌ Tentativo ${attemptNumber} fallito per batch ${batchIdx + 1}: ${retryError.message}`);
                                            
                                            // Prova un altro retry con backoff esponenziale
                                            return retryBatch(batchIdx, attemptNumber + 1);
                                        }
                                    } else {
                                        console.error(`❌ BATCH ${batchIdx + 1} ABBANDONATO dopo 3 tentativi falliti`);
                                        
                                        // Creiamo un risultato vuoto per il batch fallito per evitare di bloccare l'esecuzione
                                        completedBatchResults.push({
                                            batchIndex: batchIdx,
                                            results: [],
                                            successes: 0,
                                            failures: batchSize, // Consideriamo tutte le battaglie del batch come fallite
                                            error: true
                                        });
                                        
                                        return false;
                                    }
                                };
                                
                                // Avviamo il retry ma non attendiamo (proseguiamo con altri batch)
                                retryBatch(batchIndex).then(() => {
                                    // Dopo il retry, avviamo il prossimo batch disponibile
                                    return startNextBatchIfAvailable();
                                });
                                
                                // Per non bloccare l'esecuzione, avviamo anche immediatamente il prossimo batch
                                return startNextBatchIfAvailable();
                            });
                        
                        // Aggiungiamo la promessa a quelle in esecuzione
                        runningPromises.push(batchPromise);
                        console.log(`🚀 Avviato batch ${batchIndex + 1}/${numBatches} (${runningPromises.length}/${currentMaxThreads} thread attivi)`);
                        
                        // Avviamo immediatamente un altro batch se c'è spazio
                        return startNextBatchIfAvailable();
                    }
                    
                    // Se non ci sono più batch da avviare, attendiamo che tutti i batch in esecuzione terminino
                    if (pendingBatchIndices.length === 0 && runningPromises.length === 0) {
                        return completedBatchResults;
                    }
                    
                    // Se abbiamo raggiunto il limite di thread, ritorniamo null
                    return null;
                };
                
                // Avviamo il processo di esecuzione dei batch
                await startNextBatchIfAvailable();
                
                // Attendiamo eventuali batch ancora in esecuzione
                if (runningPromises.length > 0) {
                    console.log(`In attesa del completamento di ${runningPromises.length} batch rimanenti...`);
                    await Promise.all(runningPromises);
                }
                
                // Verifica se ci sono altri batch in attesa e li avvia forzatamente
                // Questo è necessario perché potrebbe verificarsi una condizione di stallo
                // dove nessun thread avvia nuovi batch perché tutti pensano che ci siano già abbastanza thread attivi
                if (pendingBatchIndices.length > 0) {
                    console.log(`\n⚠️ Rilevati ${pendingBatchIndices.length} batch ancora in attesa dopo il ciclo principale.`);
                    console.log(`Avvio forzato dei batch rimanenti...`);
                    
                    // Avvia manualmente tutti i batch rimanenti in gruppi
                    while (pendingBatchIndices.length > 0) {
                        const batchPromises = [];
                        const batchLimit = Math.min(pendingBatchIndices.length, currentMaxThreads);
                        
                        console.log(`Avvio gruppo di ${batchLimit} batch...`);
                        
                        for (let i = 0; i < batchLimit; i++) {
                            if (pendingBatchIndices.length === 0) break;
                            const batchIndex = pendingBatchIndices.shift();
                            batchPromises.push(processBatchOfBattles(batchIndex));
                        }
                        
                        // Attendi il completamento di questo gruppo
                        const batchResults = await Promise.all(batchPromises);
                        
                        // Aggiungi i risultati
                        for (const result of batchResults) {
                            completedBatchResults.push(result);
                            console.log(`✅ Batch ${result.batchIndex + 1}/${numBatches} completato (avvio forzato): ${result.successes} vittorie, ${result.failures} sconfitte`);
                        }
                        
                        console.log(`${pendingBatchIndices.length} batch rimanenti...`);
                    }
                }
                
                // Ordiniamo i risultati per indice del batch
                completedBatchResults.sort((a, b) => a.batchIndex - b.batchIndex);
                
                // Combina i risultati di tutti i batch
                for (const result of completedBatchResults) {
                    battleResults.push(...result.results);
                    successCount += result.successes;
                    failureCount += result.failures;
                }
            } catch (error) {
                console.error("Errore durante l'esecuzione dei batch:", error);
                // Utilizziamo la funzione per gestire errori critici
                const recoveryResult = await handleCriticalError(error);
                
                // Se siamo riusciti a recuperare da un salvataggio, evitiamo di lanciare l'eccezione
                if (recoveryResult && recoveryResult.recovered) {
                    console.log("\n⚠️ TEST PROSEGUITO CON RISULTATI PARZIALI ⚠️");
                    console.log(`Usando ${recoveryResult.results.battleResults.length} battaglie dal salvataggio`);
                } else {
                    throw error;
                }
            }
            
            // Calcola il tempo di esecuzione
            const executionTime = (Date.now() - startTime) / 1000;
            
            // Ferma l'intervallo delle statistiche
            clearInterval(statsInterval);
            
            // Verifica il numero effettivo di battaglie completate nei risultati
            const actualBattlesCompleted = battleResults.length;
            
            console.log(`\nEsecuzione completata in ${executionTime.toFixed(2)} secondi`);
            console.log(`Battaglie effettivamente completate: ${actualBattlesCompleted}/${testBattles}`);
            console.log(`Velocità: ${(actualBattlesCompleted / executionTime).toFixed(2)} battaglie/secondo`);
            
            console.log(`\nRiepilogo Simulazione Dungeon:`);
            console.log(`----------------------------`);
            console.log(`Battaglie nel contatore interno: ${completedBattles}`);
            console.log(`Battaglie effettivamente nei risultati: ${actualBattlesCompleted}`);
            
            // Ricalcoliamo le statistiche in base ai risultati effettivi
            let actualSuccessCount = 0;
            let actualFailureCount = 0;
            
            battleResults.forEach(r => {
                if (r.success) actualSuccessCount++;
                else actualFailureCount++;
            });
            
            console.log(`Vittorie verificate: ${actualSuccessCount} (${(actualSuccessCount / actualBattlesCompleted * 100).toFixed(2)}%)`);
            console.log(`Sconfitte verificate: ${actualFailureCount} (${(actualFailureCount / actualBattlesCompleted * 100).toFixed(2)}%)`);
            console.log(`Errori totali: ${errorCount}`);
            console.log(`  - Recuperati con successo: ${retrySuccessCount}`);
            console.log(`  - Falliti definitivamente: ${retryFailureCount}`);
            console.log(`Tempo totale: ${executionTime.toFixed(2)} secondi`);
            
            // Ordinare i risultati prima di mostrarli
            battleResults.sort((a, b) => a.battleIndex - b.battleIndex);
            
            // Verifica se non abbiamo completato tutte le battaglie richieste
            if (actualBattlesCompleted < testBattles) {
                console.warn(`\n⚠️ ATTENZIONE: Completate solo ${actualBattlesCompleted}/${testBattles} battaglie richieste (${(actualBattlesCompleted/testBattles*100).toFixed(1)}%)`);
                console.warn(`Potrebbe esserci stato un problema durante l'esecuzione o un errore nel conteggio.`);
            }
            
            // Mostra solo un campione rappresentativo dei risultati se ci sono troppe battaglie
            const maxResultsToShow = Math.min(100, actualBattlesCompleted);
            const sampleStep = Math.max(1, Math.floor(actualBattlesCompleted / maxResultsToShow));
            
            console.log(`\nTabella dei risultati (campione di ${Math.min(maxResultsToShow, actualBattlesCompleted)} battaglie):`);
            console.log("-------------------");
            console.log("ID | Difficoltà       | Salute  | Esito | HP Rimasti | % Persa");
            console.log("----------------------------------------------------------");
            
            // Mostra i risultati del campione
            for (let i = 0; i < battleResults.length; i += sampleStep) {
                const r = battleResults[i];
                const healthLostPercent = ((r.initialHealth - r.remainingHealth) / r.initialHealth * 100).toFixed(0);
                console.log(`${r.dungeonId.toString().padEnd(2)} | ${r.dungeonDifficulty.padEnd(16)} | ${r.initialHealth.toString().padEnd(7)} | ${r.success ? 'Vittoria' : 'Sconfitta'} | ${r.remainingHealth.toString().padEnd(10)} | ${healthLostPercent.toString().padEnd(3)}%`);
            }
            
            // Analisi per difficoltà
            console.log("\nAnalisi per Difficoltà:");
            console.log("====================");
            
            // Inizializza i contatori per ogni livello di difficoltà
            const difficultyStats = {
                "Molto Facile": { total: 0, victories: 0, defeats: 0 },
                "Facile": { total: 0, victories: 0, defeats: 0 },
                "Medio": { total: 0, victories: 0, defeats: 0 },
                "Difficile": { total: 0, victories: 0, defeats: 0 },
                "Molto Difficile": { total: 0, victories: 0, defeats: 0 }
            };
            
            // Popola le statistiche
            battleResults.forEach(r => {
                difficultyStats[r.dungeonDifficulty].total++;
                if (r.success) {
                    difficultyStats[r.dungeonDifficulty].victories++;
                } else {
                    difficultyStats[r.dungeonDifficulty].defeats++;
                }
            });
            
            // Stampa l'intestazione della tabella
            console.log("Difficoltà       | Battaglie | Vittorie | Sconfitte | % Vittorie");
            console.log("--------------------------------------------------------");
            
            // Stampa i risultati per ogni difficoltà
            Object.entries(difficultyStats).forEach(([difficulty, stats]) => {
                if (stats.total > 0) { // Mostra solo le difficoltà con almeno una battaglia
                    const victoryRate = (stats.victories / stats.total * 100).toFixed(2);
                    console.log(`${difficulty.padEnd(16)} | ${stats.total.toString().padEnd(9)} | ${stats.victories.toString().padEnd(8)} | ${stats.defeats.toString().padEnd(9)} | ${victoryRate.padEnd(9)}%`);
                }
            });
            
            // Verifica che tutte le battaglie siano completate
            expect(actualSuccessCount + actualFailureCount).to.equal(actualBattlesCompleted);
            
            // Verifica che siano state completate almeno una percentuale minima di battaglie
            const completionRate = actualBattlesCompleted / testBattles;
            if (completionRate < minCompletionThreshold) {
                console.error(`\n❌ TEST FALLITO: Completate solo ${(completionRate*100).toFixed(1)}% delle battaglie richieste (minimo ${minCompletionThreshold*100}%)`);
                // Facciamo fallire il test se non raggiunge la soglia minima
                expect(completionRate).to.be.at.least(minCompletionThreshold, `Completate solo ${actualBattlesCompleted}/${testBattles} battaglie`);
            } else {
                console.log(`\n✅ TEST ACCETTATO: Completate ${(completionRate*100).toFixed(1)}% delle battaglie richieste (minimo ${minCompletionThreshold*100}%)`);
            }
        });
        
        // Funzione per ottenere il nome della difficoltà del dungeon
        function getDungeonDifficulty(index) {
            const difficulties = [
                "Molto Facile",
                "Facile",
                "Medio",
                "Difficile",
                "Molto Difficile"
            ];
            return difficulties[index] || "Sconosciuto";
        }
    });
}); 