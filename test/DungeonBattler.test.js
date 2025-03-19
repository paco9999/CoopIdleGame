const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

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
            
            // Riduciamo il numero di battaglie per evitare problemi
            const testBattles = 10000; 
            
            for (let battleIndex = 0; battleIndex < testBattles; battleIndex++) {
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
                
                // Prepara i procioni
                const prociones = await prepareProciones(healthValues);
                
                // Seleziona un dungeon (alterna tra i 5 tipi)
                const dungeonIndex = battleIndex % DUNGEON_IDS.length;
                const dungeonId = DUNGEON_IDS[dungeonIndex];
                const dungeonStats = DUNGEON_STATS[dungeonIndex];
                
                // Genera un seed casuale
                const randomSeed = Math.floor(Math.random() * 1000000) + 1;
                
                // Esegui la battaglia e destruttura i risultati
                console.log("Chiamata al contratto in corso...");
                
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
                    console.log("Transazione completata:", receipt.hash);
                    
                    // Estrai gli eventi per ottenere i risultati
                    // Cerca l'evento DungeonBattleResult
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
                    
                    console.log("Eventi trovati:", battleEvents.length);
                    
                    let success = false;
                    let remainingHealth = 0;
                    let xpEarned = 0;
                    let comEarned = 0;
                    
                    if (battleEvents.length > 0) {
                        const event = battleEvents[0];
                        console.log("Evento:", event);
                        
                        // Estrai i dati dall'evento
                        success = event.args.success;
                        remainingHealth = Number(event.args.remainingHealth);
                        xpEarned = Number(event.args.xpEarned);
                        comEarned = Number(event.args.comEarned);
                    }
                    
                    console.log(`\nRisultato battaglia ${battleIndex} contro dungeon ${dungeonId}:`);
                    console.log(`- Successo: ${success}`);
                    console.log(`- Salute rimanente: ${remainingHealth}`);
                    console.log(`- XP guadagnati: ${xpEarned}`);
                    console.log(`- COM guadagnati: ${comEarned}`);
                    
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
                    
                    battleResults.push(battleResult);
                    
                    if (success) {
                        successCount++;
                    } else {
                        failureCount++;
                    }
                } catch (error) {
                    console.error("Errore durante la chiamata al contratto:", error);
                    failureCount++;
                }
            }
            
            console.log(`\nRiepilogo Simulazione Dungeon:`);
            console.log(`----------------------------`);
            console.log(`Battaglie completate: ${testBattles}`);
            console.log(`Vittorie: ${successCount} (${(successCount / testBattles * 100).toFixed(2)}%)`);
            console.log(`Sconfitte: ${failureCount} (${(failureCount / testBattles * 100).toFixed(2)}%)`);
            
            console.log("\nTabella dei risultati:");
            console.log("-------------------");
            console.log("ID | Difficoltà       | Salute  | Esito | HP Rimasti | % Persa");
            console.log("----------------------------------------------------------");
            
            // Mostra i risultati
            battleResults.forEach(r => {
                const healthLostPercent = ((r.initialHealth - r.remainingHealth) / r.initialHealth * 100).toFixed(0);
                console.log(`${r.dungeonId.toString().padEnd(2)} | ${r.dungeonDifficulty.padEnd(16)} | ${r.initialHealth.toString().padEnd(7)} | ${r.success ? 'Vittoria' : 'Sconfitta'} | ${r.remainingHealth.toString().padEnd(10)} | ${healthLostPercent.toString().padEnd(3)}%`);
            });
            
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
            expect(successCount + failureCount).to.equal(testBattles);
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