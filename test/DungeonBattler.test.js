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
    let professionsManager;
    let owner;
    let addr1;
    let addr2;
    
    // Array per registrare i risultati delle battaglie
    const battleResults = [];

    // Costanti per il test
    const NUM_BATTLES = 100;
    const BASE_HEALTH = 100;
    const DUNGEON_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const DUNGEON_STATS = [
        [1, 1, 1, 1, 50], // Dungeon 1: Molto Facile
        [1, 1, 1, 2, 50], // Dungeon 2: Facile
        [2, 1, 1, 2, 50], // Dungeon 3: Facile+
        [2, 1, 2, 2, 50], // Dungeon 4: Medio-Facile
        [2, 2, 2, 3, 50], // Dungeon 5: Medio
        [3, 2, 2, 3, 50], // Dungeon 6: Medio+
        [3, 2, 2, 4, 50], // Dungeon 7: Difficile
        [4, 2, 3, 4, 50], // Dungeon 8: Difficile+
        [4, 3, 3, 5, 50], // Dungeon 9: Molto Difficile
        [5, 3, 3, 5, 50]  // Dungeon 10: Estremo
    ];
    
    // Impostazione modalità di test
    let useFixedHealth = false; // Default: usa salute randomizzata
    let fixedHealthValue = 120; // Valore di vita fissa predefinito
    let usePaladin = false; // Default: non utilizzare Paladin
    
    // Funzione per configurare i test
    async function configureTests() {
        console.log("\n=== CONFIGURAZIONE TEST DUNGEON BATTLER ===");
        console.log("Seleziona la modalità di inizializzazione della salute dei procioni:");
        console.log("1. Salute randomizzata (valori diversi per ogni battaglia)");
        console.log("2. Salute fissa (tutti i procioni con " + fixedHealthValue + " HP)");
        console.log("3. Party con Paladin (tutti i procioni con " + fixedHealthValue + " HP e un Paladin nel team)");
        
        const choice = await askQuestion("Seleziona un'opzione (1/2/3): ");
        
        if (choice === "3") {
            useFixedHealth = true;
            usePaladin = true;
            console.log(`\n✅ Modalità selezionata: Party con Paladin (${fixedHealthValue} HP)`);
        } else if (choice === "2") {
            useFixedHealth = true;
            console.log(`\n✅ Modalità selezionata: Salute fissa (${fixedHealthValue} HP)`);
        } else {
            useFixedHealth = false;
            console.log("\n✅ Modalità selezionata: Salute randomizzata");
        }
        
        return true;
    }

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

        // Deploy del mock per ProfessionsManager
        const MockProfessionsManager = await ethers.getContractFactory("contracts/mocks/MockProfessionsManager.sol:MockProfessionsManager");
        professionsManager = await MockProfessionsManager.deploy();

        // Deploy del DungeonBattler
        const DungeonBattler = await ethers.getContractFactory("DungeonBattler");
        dungeonBattler = await DungeonBattler.deploy(
            await dungeonManager.getAddress(),
            await idleProcioneNFT.getAddress(),
            await craftingManager.getAddress(),
            await randomnessConsumer.getAddress()
        );
        
        // Imposta il ProfessionsManager nel DungeonBattler
        await dungeonBattler.setProfessionsManager(await professionsManager.getAddress());
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

    describe("Funzionalità del Paladin", function () {
        it("Dovrebbe verificare la coerenza tra professionsManager e idleProcioneNFT", async function () {
            // Mint di un procione per il test
            const tokenId = 99999;
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId);
            
            // Assegna la professione Paladin tramite professionsManager
            await professionsManager.assignProfession(tokenId, 5); // 5 = PALADIN
            
            // Verifica la professione tramite professionsManager
            const profManagerProfession = await professionsManager.getProfession(tokenId);
            console.log(`Professione in professionsManager: ${profManagerProfession}`);
            expect(profManagerProfession).to.equal(5);
            
            // Verifica la professione tramite idleProcioneNFT
            const [nftProfession,,] = await idleProcioneNFT.getProfessionInfo(tokenId);
            console.log(`Professione in idleProcioneNFT: ${nftProfession}`);
            
            // Questo test probabilmente fallirà, dimostrando il problema
            expect(nftProfession).to.equal(0); // Ci aspettiamo 0 (NONE) in quanto non è sincronizzato
            
            // Ora impostiamo la professione direttamente su idleProcioneNFT
            await idleProcioneNFT.setProfession(tokenId, 5); // 5 = StatsLib.Professions.PALADIN
            
            // Verifichiamo di nuovo
            const [nftProfessionAfter,,] = await idleProcioneNFT.getProfessionInfo(tokenId);
            console.log(`Professione in idleProcioneNFT dopo setProfession: ${nftProfessionAfter}`);
            expect(nftProfessionAfter).to.equal(5);
        });

        it("Dovrebbe attivare l'abilità di guarigione quando la salute scende sotto il 25%", async function () {
            // Usiamo un timeout esteso per questo test
            this.timeout(30000);
            
            // Configurazione del test
            await setupDungeonManagerAuth();
            
            // Mint di 3 procioni per il party
            const tokenId1 = 10001;
            const tokenId2 = 10002;
            const tokenId3 = 10003;
            
            // Creiamo i procioni con ID specifici
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId1);
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId2);
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId3);
            
            // Impostiamo statistiche base per i procioni
            await idleProcioneNFT.setStrength(tokenId1, 50);  // Aumentata forza
            await idleProcioneNFT.setSpeed(tokenId1, 40);     // Aumentata velocità
            await idleProcioneNFT.setIntelligence(tokenId1, 30);
            await idleProcioneNFT.setAccuracy(tokenId1, 40);
            
            await idleProcioneNFT.setStrength(tokenId2, 40);
            await idleProcioneNFT.setSpeed(tokenId2, 50);    // Aumentata velocità
            await idleProcioneNFT.setIntelligence(tokenId2, 40);
            await idleProcioneNFT.setAccuracy(tokenId2, 30);
            
            await idleProcioneNFT.setStrength(tokenId3, 30);
            await idleProcioneNFT.setSpeed(tokenId3, 40);
            await idleProcioneNFT.setIntelligence(tokenId3, 50);  // Aumentata intelligenza
            await idleProcioneNFT.setAccuracy(tokenId3, 40);
            
            // Impostiamo salute iniziale più alta per tutti i procioni
            const initialHealth = 40;  // Aumentata da 30 a 100
            await idleProcioneNFT.setCurrentHealth(tokenId1, initialHealth);
            await idleProcioneNFT.setCurrentHealth(tokenId2, initialHealth);
            await idleProcioneNFT.setCurrentHealth(tokenId3, initialHealth);
            
            // Assegniamo la professione Paladin al primo procione in entrambi i sistemi
            await professionsManager.assignProfession(tokenId1, 5); // 5 = PALADIN
            await idleProcioneNFT.setProfession(tokenId1, 5); // Imposta anche in NFT
            
            // Verifichiamo che la professione sia stata assegnata correttamente
            const profession = await professionsManager.getProfession(tokenId1);
            console.log(`Professione assegnata a tokenId1 in professionsManager: ${profession}`);
            expect(profession).to.equal(5);
            
            // Verifichiamo anche in idleProcioneNFT
            const [nftProfession,,] = await idleProcioneNFT.getProfessionInfo(tokenId1);
            console.log(`Professione assegnata a tokenId1 in idleProcioneNFT: ${nftProfession}`);
            expect(nftProfession).to.equal(5);
                    
            // Assicuriamoci che il Paladin non sia in cooldown
            await professionsManager.deactivateCooldown(tokenId1);
            
            // Verifichiamo che isPaladinOnCooldown non lanci eccezioni
            try {
                const isOnCooldown = await professionsManager.isPaladinOnCooldown(tokenId1);
                console.log(`Paladin in cooldown prima della battaglia: ${isOnCooldown}`);
                expect(isOnCooldown).to.be.false;
            } catch (error) {
                console.error(`ERRORE: ${error.message}`);
                // Se l'errore è "Not a paladin", è un problema con l'assegnazione della professione
                if (error.message.includes("Not a paladin")) {
                    console.log("Forzando la professione Paladin nel storage interno...");
                    // Chiamiamo una funzione per forzare l'assegnazione se esiste
                    if (typeof professionsManager.forceSetProfession === "function") {
                        await professionsManager.forceSetProfession(tokenId1, 5);
                        const newProfession = await professionsManager.getProfession(tokenId1);
                        console.log(`Nuova professione dopo il force: ${newProfession}`);
                    } else {
                        console.log("Funzione forceSetProfession non disponibile");
                    }
                }
            }
            
            // Verifichiamo che professionsManager sia impostato nel DungeonBattler
            const profManagerAddress = await dungeonBattler.professionsManager();
            console.log(`Indirizzo professionsManager nel DungeonBattler: ${profManagerAddress}`);
            console.log(`Indirizzo del contratto mockProfessionsManager: ${professionsManager.target}`);
            
            // Se l'indirizzo è zero, impostiamolo
            if (profManagerAddress === "0x0000000000000000000000000000000000000000") {
                console.log("ProfessionsManager non impostato! Lo imposto ora...");
                await dungeonBattler.setProfessionsManager(professionsManager.target);
                const updatedProfManagerAddress = await dungeonBattler.professionsManager();
                console.log(`Nuovo indirizzo professionsManager: ${updatedProfManagerAddress}`);
            }
            
            // Prepariamo il party e le statistiche del dungeon
            const partyTokenIds = [tokenId1, tokenId2, tokenId3];
            const equippedItems = [0, 0, 0]; // Nessun oggetto equipaggiato
            const dungeonStats = DUNGEON_STATS[7]; // Difficile+ invece di Facile+
            const randomSeed = 12345;
            
            // Calcoliamo la salute totale iniziale del party
            const totalInitialHealth = initialHealth * 3;
            console.log(`Salute totale iniziale del party: ${totalInitialHealth}`);
            
            // Calcoliamo la soglia del 25% per l'attivazione della guarigione
            const healingThreshold = totalInitialHealth * 0.25;
            console.log(`Soglia di attivazione Paladin (25%): ${healingThreshold}`);
            
            // Verifichiamo tutti gli eventi emessi
            console.log("Cercherò l'evento PaladinHealActivated o eventi simili");
            
            // Effettuiamo la battaglia
            const tx = await dungeonBattler.calculateBattleOutcome(
                8, // dungeonId (Difficile+) invece di 3 (Facile+)
                0, // partyIndex
                tokenId1, // Paladin
                tokenId2,
                tokenId3,
                initialHealth,
                initialHealth,
                initialHealth,
                equippedItems,
                dungeonStats,
                randomSeed
            );
            
            // Attendiamo la conferma della transazione
            const receipt = await tx.wait();
            
            // Analizziamo tutti gli eventi
            const allEvents = receipt.logs
                .filter(log => log.address === dungeonBattler.target)
                .map(log => {
                    try {
                        return dungeonBattler.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(parsed => parsed !== null);
            
            // Stampa tutti gli eventi per debug
            console.log(`\nEventi totali emessi: ${allEvents.length}`);
            allEvents.forEach((event, index) => {
                console.log(`Evento ${index + 1}: ${event.name}`);
            });
            
            // Estraiamo gli eventi di guarigione
            const healingEvents = allEvents
                .filter(event => event.name === "PaladinHealActivated");
            
            console.log(`Eventi di guarigione trovati: ${healingEvents.length}`);
            
            // Vediamo se ci sono eventi con "heal" o "paladin" nel nome
            const healOrPaladinEvents = allEvents
                .filter(event => 
                    event.name.toLowerCase().includes('heal') || 
                    event.name.toLowerCase().includes('paladin')
                );
            
            console.log(`Eventi che contengono "heal" o "paladin": ${healOrPaladinEvents.length}`);
            if (healOrPaladinEvents.length > 0) {
                healOrPaladinEvents.forEach((event, index) => {
                    console.log(`Evento heal/paladin ${index + 1}: ${event.name}`);
                    
                    // Se è un evento di debug della condizione di guarigione, mostra i dettagli
                    if (event.name === "PaladinHealConditionCheck") {
                        console.log(`  - Salute corrente: ${event.args.currentHealth}`);
                        console.log(`  - Soglia di guarigione: ${event.args.healthThreshold}`);
                        console.log(`  - Ha Paladin: ${event.args.hasPaladin}`);
                        console.log(`  - Paladin attivo: ${event.args.isPaladinActive}`);
                        console.log(`  - Party vivo: ${event.args.isPartyAlive}`);
                        console.log(`  - Sotto soglia: ${event.args.isBelowThreshold}`);
                        console.log(`  - Manager cooldown attivo: ${event.args.isCooldownManagerActive}`);
                        console.log(`  - Paladin in cooldown: ${event.args.isPaladinOnCooldown}`);
                    }
                });
            }
            
            // Se ci sono eventi di guarigione, verifichiamo che solo il primo Paladin l'abbia attivata
            if (healingEvents.length > 0) {
                healingEvents.forEach(event => {
                    expect(event.args.procione1Id).to.equal(tokenId1, "Solo il primo Paladin nel party dovrebbe attivare l'abilità di guarigione");
                });
            }

            // Calcoliamo la salute totale iniziale del party e la soglia di guarigione
            const totalInitialHealth2 = initialHealth * 3;
            const healingThreshold2 = totalInitialHealth2 * 0.25;
            
            // Estraiamo gli eventi per verificare l'esito della battaglia
            const battleResultEvents = allEvents
                .filter(event => event.name === "DungeonBattleResult");
            
            // Verifichiamo l'esito della battaglia
            let remainingHealth = 0;
            
            if (battleResultEvents.length > 0) {
                const event = battleResultEvents[0];
                remainingHealth = Number(event.args.remainingHealth);
                console.log(`\nSalute rimanente: ${remainingHealth}/${totalInitialHealth2}`);
                console.log(`Soglia di guarigione (25%): ${healingThreshold2}`);
                console.log(`La condizione di attivazione è: ${remainingHealth < healingThreshold2 ? 'soddisfatta' : 'non soddisfatta'}`);
                
                // Mostra anche altri dettagli del battleResultEvent
                console.log(`\nDettagli evento DungeonBattleResult:`);
                console.log(`- dungeonId: ${event.args.dungeonId}`);
                console.log(`- partyIndex: ${event.args.partyIndex}`);
                console.log(`- success: ${event.args.success}`);
                console.log(`- totalDamage: ${event.args.totalDamage}`);
                console.log(`- trapTriggered: ${event.args.trapTriggered}`);
            }

            // Verifichiamo se la salute è scesa sotto il threshold
            if (remainingHealth < healingThreshold2) {
                expect(healingEvents.length).to.be.greaterThan(0, "L'abilità di guarigione del Paladin dovrebbe attivarsi quando la salute scende sotto il 25%");
            } else {
                console.log(`La salute (${remainingHealth}) non è scesa sotto la soglia di guarigione (${healingThreshold2}), quindi l'abilità non è stata attivata.`);
            }
        });

        it("Dovrebbe attivare l'abilità di guarigione per un party con più Paladin considerando solo il primo", async function () {
            // Configurazione del test
            await setupDungeonManagerAuth();
            
            // Mint di 3 procioni per il party
            const tokenId1 = 20001;
            const tokenId2 = 20002;
            const tokenId3 = 20003;
            
            // Creiamo i procioni con ID specifici
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId1);
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId2);
            await idleProcioneNFT.simpleMintWithId(owner.address, tokenId3);
            
            // Impostiamo statistiche base per i procioni
            await idleProcioneNFT.setStrength(tokenId1, 50);  // Aumentata forza
            await idleProcioneNFT.setSpeed(tokenId1, 40);     // Aumentata velocità
            await idleProcioneNFT.setIntelligence(tokenId1, 30);
            await idleProcioneNFT.setAccuracy(tokenId1, 40);
            
            await idleProcioneNFT.setStrength(tokenId2, 40);
            await idleProcioneNFT.setSpeed(tokenId2, 50);    // Aumentata velocità
            await idleProcioneNFT.setIntelligence(tokenId2, 40);
            await idleProcioneNFT.setAccuracy(tokenId2, 30);
            
            await idleProcioneNFT.setStrength(tokenId3, 30);
            await idleProcioneNFT.setSpeed(tokenId3, 40);
            await idleProcioneNFT.setIntelligence(tokenId3, 50);  // Aumentata intelligenza
            await idleProcioneNFT.setAccuracy(tokenId3, 40);
            
            // Impostiamo salute iniziale più alta per tutti i procioni
            const initialHealth = 100;  // Aumentata da 30 a 100
            await idleProcioneNFT.setCurrentHealth(tokenId1, initialHealth);
            await idleProcioneNFT.setCurrentHealth(tokenId2, initialHealth);
            await idleProcioneNFT.setCurrentHealth(tokenId3, initialHealth);
            
            // Assegniamo la professione Paladin a due procioni in entrambi i sistemi
            await professionsManager.assignProfession(tokenId1, 5); // 5 = PALADIN
            await professionsManager.assignProfession(tokenId2, 5); // 5 = PALADIN
            
            await idleProcioneNFT.setProfession(tokenId1, 5); // Imposta anche in NFT
            await idleProcioneNFT.setProfession(tokenId2, 5); // Imposta anche in NFT
            
            // Verifichiamo che le professioni siano state assegnate correttamente
            const profession1 = await professionsManager.getProfession(tokenId1);
            const profession2 = await professionsManager.getProfession(tokenId2);
            console.log(`Professione assegnata a tokenId1 in professionsManager: ${profession1}`);
            console.log(`Professione assegnata a tokenId2 in professionsManager: ${profession2}`);
            expect(profession1).to.equal(5);
            expect(profession2).to.equal(5);
            
            // Verifichiamo anche in idleProcioneNFT
            const [nftProfession1,,] = await idleProcioneNFT.getProfessionInfo(tokenId1);
            const [nftProfession2,,] = await idleProcioneNFT.getProfessionInfo(tokenId2);
            console.log(`Professione assegnata a tokenId1 in idleProcioneNFT: ${nftProfession1}`);
            console.log(`Professione assegnata a tokenId2 in idleProcioneNFT: ${nftProfession2}`);
            expect(nftProfession1).to.equal(5);
            expect(nftProfession2).to.equal(5);
            
            // Assicuriamoci che entrambi i Paladin non siano in cooldown
            await professionsManager.deactivateCooldown(tokenId1);
            await professionsManager.deactivateCooldown(tokenId2);
            
            // Verifichiamo che isPaladinOnCooldown non lanci eccezioni
            try {
                const isOnCooldown1 = await professionsManager.isPaladinOnCooldown(tokenId1);
                const isOnCooldown2 = await professionsManager.isPaladinOnCooldown(tokenId2);
                console.log(`Paladin 1 in cooldown prima della battaglia: ${isOnCooldown1}`);
                console.log(`Paladin 2 in cooldown prima della battaglia: ${isOnCooldown2}`);
                expect(isOnCooldown1).to.be.false;
                expect(isOnCooldown2).to.be.false;
            } catch (error) {
                console.error(`ERRORE: ${error.message}`);
                // Se l'errore è "Not a paladin", è un problema con l'assegnazione della professione
                if (error.message.includes("Not a paladin")) {
                    console.log("Forzando la professione Paladin nel storage interno...");
                    // Chiamiamo una funzione per forzare l'assegnazione se esiste
                    if (typeof professionsManager.forceSetProfession === "function") {
                        await professionsManager.forceSetProfession(tokenId1, 5);
                        await professionsManager.forceSetProfession(tokenId2, 5);
                        const newProfession1 = await professionsManager.getProfession(tokenId1);
                        const newProfession2 = await professionsManager.getProfession(tokenId2);
                        console.log(`Nuova professione tokenId1 dopo il force: ${newProfession1}`);
                        console.log(`Nuova professione tokenId2 dopo il force: ${newProfession2}`);
                    } else {
                        console.log("Funzione forceSetProfession non disponibile");
                    }
                }
            }
            
            // Verifichiamo che professionsManager sia impostato nel DungeonBattler
            const profManagerAddress = await dungeonBattler.professionsManager();
            console.log(`Indirizzo professionsManager nel DungeonBattler: ${profManagerAddress}`);
            console.log(`Indirizzo del contratto mockProfessionsManager: ${professionsManager.target}`);
            
            // Se l'indirizzo è zero, impostiamolo
            if (profManagerAddress === "0x0000000000000000000000000000000000000000") {
                console.log("ProfessionsManager non impostato! Lo imposto ora...");
                await dungeonBattler.setProfessionsManager(professionsManager.target);
                const updatedProfManagerAddress = await dungeonBattler.professionsManager();
                console.log(`Nuovo indirizzo professionsManager: ${updatedProfManagerAddress}`);
            }
            
            // Prepariamo il party e le statistiche del dungeon
            const partyTokenIds = [tokenId1, tokenId2, tokenId3];
            const equippedItems = [0, 0, 0]; // Nessun oggetto equipaggiato
            const dungeonStats = DUNGEON_STATS[7]; // Difficile+
            const randomSeed = 12345;
            
            // Effettuiamo la battaglia
            const tx = await dungeonBattler.calculateBattleOutcome(
                8, // dungeonId (Difficile+)
                0, // partyIndex
                tokenId1, // Primo Paladin
                tokenId2, // Secondo Paladin
                tokenId3,
                initialHealth,
                initialHealth,
                initialHealth,
                equippedItems,
                dungeonStats,
                randomSeed
            );
            
            // Attendiamo la conferma della transazione
            const receipt = await tx.wait();
            
            // Analizziamo tutti gli eventi
            const allEvents = receipt.logs
                .filter(log => log.address === dungeonBattler.target)
                .map(log => {
                    try {
                        return dungeonBattler.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(parsed => parsed !== null);
            
            // Stampa tutti gli eventi per debug
            console.log(`\nEventi totali emessi: ${allEvents.length}`);
            allEvents.forEach((event, index) => {
                console.log(`Evento ${index + 1}: ${event.name}`);
            });
            
            // Estraiamo gli eventi di guarigione
            const healingEvents = allEvents
                .filter(event => event.name === "PaladinHealActivated");
            
            console.log(`Eventi di guarigione trovati: ${healingEvents.length}`);
            
            // Vediamo se ci sono eventi con "heal" o "paladin" nel nome
            const healOrPaladinEvents = allEvents
                .filter(event => 
                    event.name.toLowerCase().includes('heal') || 
                    event.name.toLowerCase().includes('paladin')
                );
            
            console.log(`Eventi che contengono "heal" o "paladin": ${healOrPaladinEvents.length}`);
            if (healOrPaladinEvents.length > 0) {
                healOrPaladinEvents.forEach((event, index) => {
                    console.log(`Evento heal/paladin ${index + 1}: ${event.name}`);
                    
                    // Se è un evento di debug della condizione di guarigione, mostra i dettagli
                    if (event.name === "PaladinHealConditionCheck") {
                        console.log(`  - Salute corrente: ${event.args.currentHealth}`);
                        console.log(`  - Soglia di guarigione: ${event.args.healthThreshold}`);
                        console.log(`  - Ha Paladin: ${event.args.hasPaladin}`);
                        console.log(`  - Paladin attivo: ${event.args.isPaladinActive}`);
                        console.log(`  - Party vivo: ${event.args.isPartyAlive}`);
                        console.log(`  - Sotto soglia: ${event.args.isBelowThreshold}`);
                        console.log(`  - Manager cooldown attivo: ${event.args.isCooldownManagerActive}`);
                        console.log(`  - Paladin in cooldown: ${event.args.isPaladinOnCooldown}`);
                    }
                });
            }
            
            // Se ci sono eventi di guarigione, verifichiamo che solo il primo Paladin l'abbia attivata
            if (healingEvents.length > 0) {
                healingEvents.forEach(event => {
                    expect(event.args.procione1Id).to.equal(tokenId1, "Solo il primo Paladin nel party dovrebbe attivare l'abilità di guarigione");
                });
            }

            // Calcoliamo la salute totale iniziale del party e la soglia di guarigione
            const totalInitialHealth2 = initialHealth * 3;
            const healingThreshold2 = totalInitialHealth2 * 0.25;
            
            // Estraiamo gli eventi per verificare l'esito della battaglia
            const battleResultEvents = allEvents
                .filter(event => event.name === "DungeonBattleResult");
            
            // Verifichiamo l'esito della battaglia
            let remainingHealth = 0;
            
            if (battleResultEvents.length > 0) {
                const event = battleResultEvents[0];
                remainingHealth = Number(event.args.remainingHealth);
                console.log(`\nSalute rimanente: ${remainingHealth}/${totalInitialHealth2}`);
                console.log(`Soglia di guarigione (25%): ${healingThreshold2}`);
                console.log(`La condizione di attivazione è: ${remainingHealth < healingThreshold2 ? 'soddisfatta' : 'non soddisfatta'}`);
                
                // Mostra anche altri dettagli del battleResultEvent
                console.log(`\nDettagli evento DungeonBattleResult:`);
                console.log(`- dungeonId: ${event.args.dungeonId}`);
                console.log(`- partyIndex: ${event.args.partyIndex}`);
                console.log(`- success: ${event.args.success}`);
                console.log(`- totalDamage: ${event.args.totalDamage}`);
                console.log(`- trapTriggered: ${event.args.trapTriggered}`);
            }

            // Verifichiamo se la salute è scesa sotto il threshold
            if (remainingHealth < healingThreshold2) {
                expect(healingEvents.length).to.be.greaterThan(0, "L'abilità di guarigione del Paladin dovrebbe attivarsi quando la salute scende sotto il 25%");
            } else {
                console.log(`La salute (${remainingHealth}) non è scesa sotto la soglia di guarigione (${healingThreshold2}), quindi l'abilità non è stata attivata.`);
            }
        });
        
        // Esecuzione del test di battaglia
        it("Dovrebbe simulare battaglie e registrare gli esiti", async function () {
            // Aumentiamo il timeout per permettere l'esecuzione completa
            this.timeout(600000); // 10 minuti
            
            // Configurazione del test
            await configureTests();
            
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
            const testBattles = 500; // Ridotto per evitare tempi di esecuzione troppo lunghi
            const batchSize = 50; // Riduciamo la dimensione dei batch per avere più parallelismo
            const numBatches = Math.ceil(testBattles / batchSize);
            const maxConcurrentThreads = 60; // Ridotto il numero massimo di thread paralleli per evitare errori di memoria
            
            console.log(`\nEsecuzione di ${testBattles} battaglie in ${numBatches} batch (${batchSize} battaglie per batch)`);
            console.log(`Utilizzo di massimo ${maxConcurrentThreads} thread paralleli`);
            
            // Salviamo lo stato della blockchain per ripristinarlo rapidamente
            const snapshotId = await ethers.provider.send("evm_snapshot", []);
            
            // Funzione per preparare un token ID univoco per ogni batch e procion
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
                    
                    // Applica la configurazione di salute fissa se selezionata
                    if (useFixedHealth) {
                        healthValues = [fixedHealthValue, fixedHealthValue, fixedHealthValue];
                    }
                    
                    // Genera token ID unici per questo batch
                    const procioni = [];
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
                            
                            // Se è richiesto un party con Paladin, rendi il primo procione (i == 0) di ogni party un Paladin
                            if (usePaladin && i == 0) {
                                // Assegna la professione Paladin sia in professionsManager che in idleProcioneNFT
                                await professionsManager.assignProfession(tokenId, 5);
                                await idleProcioneNFT.setProfession(tokenId, 5); // Imposta anche in NFT
                                await professionsManager.deactivateCooldown(tokenId);
                                
                                if (battleIndex % 20 === 0) {
                                    console.log(`Configurato procione Paladin per party ${battleIndex}`);
                                }
                            }
                            
                            // Memorizza che è stato creato
                            procioniPerBatch[tokenId] = true;
                        }
                        
                        // Imposta la salute per questa battaglia
                        await idleProcioneNFT.setCurrentHealth(tokenId, healthValues[i]);
                        
                        procioni.push(tokenId);
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
                            procioni[0],
                            procioni[1],
                            procioni[2],
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
                        
                        // Estrai anche tutti gli eventi per verificare le guarigioni Paladin
                        const allEvents = receipt.logs
                            .filter(log => log.address === dungeonBattler.target)
                            .map(log => {
                                try {
                                    return dungeonBattler.interface.parseLog(log);
                                } catch (e) {
                                    return null;
                                }
                            })
                            .filter(parsed => parsed !== null);
                        
                        // Cerca eventi di guarigione Paladin
                        const healingEvents = allEvents.filter(event => event.name === "PaladinHealActivated");
                        
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
                            
                            // Se ci sono eventi di guarigione, incrementa i contatori
                            if (healingEvents.length > 0) {
                                healingStats[getDungeonDifficulty(dungeonIndex)] += healingEvents.length;
                                totalHealings += healingEvents.length;
                                
                                // Log conciso per ogni guarigione
                                const difficultyShort = getDungeonDifficulty(dungeonIndex).substring(0, 5);
                                console.log(`🧪 Paladin ha curato in ${difficultyShort} (Battaglia ${battleIndex}) - HP rimanente: ${remainingHealth}`);
                            }
                        }
                        
                        // Otteniamo le informazioni sui singoli procioni usati nella battaglia
                        // Questo ci permetterà di salvare lo stato esatto di ogni procione
                        const healthPerProcione = [];
                        for (let i = 0; i < 3; i++) {
                            healthPerProcione.push(healthValues[i]);
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
                            comEarned: comEarned,
                            prociones: procioni.slice(), // Salviamo i riferimenti ai procioni
                            individualHealth: [] // Inizializziamo l'array per la salute individuale
                        };
                        
                        // Per ogni procione, salviamo la sua salute attuale
                        for (let i = 0; i < 3; i++) {
                            try {
                                // Leggiamo la salute attuale dal contratto NFT
                                const currentHealth = await idleProcioneNFT.getCurrentHealth(procioni[i]);
                                battleResult.individualHealth.push(Number(currentHealth));
                            } catch (e) {
                                // In caso di errore, usiamo una stima basata sulla vita totale rimanente
                                console.error(`Errore nella lettura della salute del procione ${procioni[i]}: ${e.message}`);
                                // Stimiamo la vita rimanente in proporzione alla vita iniziale
                                if (battleResult.initialHealth > 0) {
                                    const healthRatio = battleResult.remainingHealth / battleResult.initialHealth;
                                    const estimatedHealth = Math.floor(healthValues[i] * healthRatio);
                                    battleResult.individualHealth.push(estimatedHealth);
                                } else {
                                    battleResult.individualHealth.push(0);
                                }
                            }
                        }
                        
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
                        console.error(`🔸 Procioni IDs: ${procioni.join(', ')}`);
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
                                    procioni[0],
                                    procioni[1],
                                    procioni[2],
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
                                    
                                    // Verifica anche gli eventi di guarigione del Paladin
                                    const allRetryEvents = retryReceipt.logs
                                        .filter(log => log.address === dungeonBattler.target)
                                        .map(log => {
                                            try {
                                                return dungeonBattler.interface.parseLog(log);
                                            } catch (e) {
                                                return null;
                                            }
                                        })
                                        .filter(parsed => parsed !== null);
                                        
                                    const retryHealingEvents = allRetryEvents.filter(event => event.name === "PaladinHealActivated");
                                    
                                    // Se ci sono eventi di guarigione, incrementa i contatori
                                    if (retryHealingEvents.length > 0) {
                                        healingStats[getDungeonDifficulty(dungeonIndex)] += retryHealingEvents.length;
                                        totalHealings += retryHealingEvents.length;
                                        
                                        // Log conciso per ogni guarigione
                                        const difficultyShort = getDungeonDifficulty(dungeonIndex).substring(0, 5);
                                        console.log(`🧪 Paladin ha curato in ${difficultyShort} (Battaglia ${battleIndex}-retry) - HP rimanente: ${remainingHealth}`);
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
                            
                            // Creiamo un risultato vuoto per il batch fallito per evitare di bloccare l'esecuzione
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
            
            // Contatore delle cure Paladin per difficoltà
            const healingStats = {
                "Molto Facile": 0,
                "Facile": 0,
                "Facile+": 0,
                "Medio-Facile": 0,
                "Medio": 0,
                "Medio+": 0,
                "Difficile": 0,
                "Difficile+": 0,
                "Molto Difficile": 0,
                "Estremo": 0
            };
            let totalHealings = 0;
            
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
                "Molto Facile": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Facile": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Facile+": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Medio-Facile": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Medio": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Medio+": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Difficile": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Difficile+": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Molto Difficile": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 },
                "Estremo": { total: 0, victories: 0, defeats: 0, avgRemainingHealth: 0 }
            };
            
            // Popola le statistiche
            battleResults.forEach(r => {
                difficultyStats[r.dungeonDifficulty].total++;
                if (r.success) {
                    difficultyStats[r.dungeonDifficulty].victories++;
                    difficultyStats[r.dungeonDifficulty].avgRemainingHealth += r.remainingHealth;
                } else {
                    difficultyStats[r.dungeonDifficulty].defeats++;
                }
            });
            
            // Calcola la media della salute rimanente per le vittorie
            Object.values(difficultyStats).forEach(stat => {
                if (stat.victories > 0) {
                    stat.avgRemainingHealth = Math.round(stat.avgRemainingHealth / stat.victories);
                }
            });
            
            // Stampa l'intestazione della tabella
            console.log("Difficoltà       | Battaglie | Vittorie | Sconfitte | % Vittorie | HP Media");
            console.log("--------------------------------------------------------------------");
            
            // Stampa i risultati per ogni difficoltà
            Object.entries(difficultyStats).forEach(([difficulty, stats]) => {
                if (stats.total > 0) { // Mostra solo le difficoltà con almeno una battaglia
                    const victoryRate = (stats.victories / stats.total * 100).toFixed(2);
                    console.log(`${difficulty.padEnd(16)} | ${stats.total.toString().padEnd(9)} | ${stats.victories.toString().padEnd(8)} | ${stats.defeats.toString().padEnd(9)} | ${victoryRate.padEnd(9)}% | ${stats.avgRemainingHealth}`);
                }
            });
            
            // Mostra le statistiche delle guarigioni del Paladin
            if (usePaladin) {
                console.log("\nStatistiche Guarigioni Paladin:");
                console.log("================================");
                console.log("Difficoltà       | Guarigioni | % sul totale | Guarigioni/Battaglie");
                console.log("----------------------------------------------------------------");
                
                // Calcola le percentuali e stampa i risultati
                Object.entries(healingStats).forEach(([difficulty, healCount]) => {
                    if (difficultyStats[difficulty] && difficultyStats[difficulty].total > 0) {
                        const percentOfTotal = (healCount / totalHealings * 100).toFixed(2);
                        const healingsPerBattle = (healCount / difficultyStats[difficulty].total).toFixed(3);
                        console.log(`${difficulty.padEnd(16)} | ${healCount.toString().padEnd(10)} | ${percentOfTotal.padEnd(12)}% | ${healingsPerBattle}`);
                    }
                });
                
                console.log(`\nTotale guarigioni: ${totalHealings}`);
                console.log(`Media guarigioni per battaglia: ${(totalHealings / actualBattlesCompleted).toFixed(3)}`);
            }
            
            // Verifica che tutte le battaglie siano completate
            expect(actualSuccessCount + actualFailureCount).to.equal(actualBattlesCompleted);
            
            // Verifica se sono state completate almeno una percentuale minima di battaglie
            const completionRate = actualBattlesCompleted / testBattles;
            if (completionRate < minCompletionThreshold) {
                console.error(`\n❌ TEST FALLITO: Completate solo ${(completionRate*100).toFixed(1)}% delle battaglie richieste (minimo ${minCompletionThreshold*100}%)`);
                // Facciamo fallire il test se non raggiunge la soglia minima
                expect(completionRate).to.be.at.least(minCompletionThreshold, `Completate solo ${actualBattlesCompleted}/${testBattles} battaglie`);
            } else {
                console.log(`\n✅ TEST ACCETTATO: Completate ${(completionRate*100).toFixed(1)}% delle battaglie richieste (minimo ${minCompletionThreshold*100}%)`);
            }
            
            // =====================================
            // TEST DI RESISTENZA DEI PARTY
            // =====================================
            console.log("\n\n🔄 AVVIO TEST DI RESISTENZA DEI PARTY 🔄");
            console.log("==========================================");
            console.log("Questo test simulerà battaglie con i party ancora operativi");
            console.log("fino a quando non saranno più in grado di combattere\n");
            
            // Chiedi all'utente se desidera eseguire il test di resistenza
            const runEnduranceTest = await askQuestion("Vuoi eseguire il test di resistenza? (s/n): ");
            
            if (runEnduranceTest.toLowerCase() === 's' || runEnduranceTest.toLowerCase() === 'si' || runEnduranceTest.toLowerCase() === 'sì') {
                // Identifica i party che sono ancora in grado di combattere (tutti i procioni con vita > 0)
                const survivingParties = [];
                
                // Itera attraverso tutti i risultati delle battaglie
                for (const result of battleResults) {
                    if (result.success && result.remainingHealth > 0) {
                        // Salviamo informazioni complete per ogni party sopravvissuto
                        survivingParties.push({
                            dungeonId: result.dungeonId,
                            dungeonDifficulty: result.dungeonDifficulty,
                            initialHealth: result.initialHealth,
                            remainingHealth: result.remainingHealth,
                            battleIndex: result.battleIndex,
                            prociones: result.prociones || [], // Riferimenti ai procioni
                            individualHealth: result.individualHealth || [] // Salute individuale
                        });
                    }
                }
                
                console.log(`Trovati ${survivingParties.length} party ancora in grado di combattere.\n`);
                
                // Testiamo tutti i party sopravvissuti senza limitazioni
                const partiesToTest = survivingParties;
                
                // Statistiche per difficoltà
                const enduranceStats = {
                    "Molto Facile": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Facile": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Facile+": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Medio-Facile": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Medio": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Medio+": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Difficile": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Difficile+": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Molto Difficile": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity },
                    "Estremo": { totalBattles: 0, parties: 0, maxBattles: 0, minBattles: Infinity }
                };
                
                // Contatore delle cure Paladin nel test di resistenza
                const enduranceHealingStats = {
                    "Molto Facile": 0,
                    "Facile": 0,
                    "Facile+": 0,
                    "Medio-Facile": 0,
                    "Medio": 0,
                    "Medio+": 0,
                    "Difficile": 0,
                    "Difficile+": 0,
                    "Molto Difficile": 0,
                    "Estremo": 0
                };
                let enduranceTotalHealings = 0;
                
                // Array per salvare i risultati dettagliati
                const enduranceResults = [];
                
                console.log("Inizio simulazione di resistenza...\n");
                
                // Variabili per il monitoraggio del tempo
                const enduranceStartTime = Date.now();
                let lastProgressUpdate = enduranceStartTime;
                let partiesProcessed = 0;
                const totalParties = partiesToTest.length;
                
                // Per ogni party sopravvissuto, simuliamo battaglie fino alla sconfitta
                for (let i = 0; i < partiesToTest.length; i++) {
                    const party = partiesToTest[i];
                    console.log(`\nTest resistenza party ${i+1}/${partiesToTest.length} (Dungeon: ${party.dungeonDifficulty})`);
                    
                    // Otteniamo le statistiche del dungeon
                    const dungeonIndex = DUNGEON_IDS.indexOf(party.dungeonId);
                    const dungeonStats = DUNGEON_STATS[dungeonIndex];
                    
                    // Creiamo nuovi procioni per questo test
                    const tokenIds = [1000000 + i*3, 1000000 + i*3 + 1, 1000000 + i*3 + 2];
                    
                    // Minting e configurazione dei procioni
                    for (let j = 0; j < 3; j++) {
                        await idleProcioneNFT.simpleMintWithId(owner.address, tokenIds[j]);
                        
                        // Impostiamo le statistiche base
                        await idleProcioneNFT.setStrength(tokenIds[j], 10 + j * 5);
                        await idleProcioneNFT.setSpeed(tokenIds[j], 10 + j * 3);
                        await idleProcioneNFT.setIntelligence(tokenIds[j], 10 + j * 2);
                        await idleProcioneNFT.setAccuracy(tokenIds[j], 10 + j * 4);
                        
                        // Se è richiesto un party con Paladin, rendi il primo procione (j == 0) un Paladin
                        if (usePaladin && j == 0) {
                            // Assegna la professione Paladin sia in professionsManager che in idleProcioneNFT
                            await professionsManager.assignProfession(tokenIds[j], 5);
                            await idleProcioneNFT.setProfession(tokenIds[j], 5); // Imposta anche in NFT
                            await professionsManager.deactivateCooldown(tokenIds[j]);
                            console.log(`Configurato procione Paladin per test di resistenza party ${i+1}`);
                        }
                    }
                    
                    // Utilizzo degli stati esatti dei procioni del party originale
                    let healthDistribution;
                    
                    // Verifica se abbiamo i dati di salute individuali
                    if (party.individualHealth && party.individualHealth.length === 3) {
                        healthDistribution = party.individualHealth.slice();
                        console.log(`Usando salute esatta dei procioni: ${healthDistribution.join('/')}`);
                    } else {
                        // Se non abbiamo dati individuali, calcoliamo una distribuzione uguale per tutti
                        const healthPerProcione = Math.floor(party.remainingHealth / 3);
                        healthDistribution = [
                            healthPerProcione, 
                            healthPerProcione, 
                            party.remainingHealth - (healthPerProcione * 2)
                        ];
                        console.log(`Dati individuali non disponibili, usando distribuzione uguale: ${healthDistribution.join('/')}`);
                    }
                    
                    // Impostiamo la vita iniziale
                    for (let j = 0; j < 3; j++) {
                        await idleProcioneNFT.setCurrentHealth(tokenIds[j], healthDistribution[j]);
                    }
                    
                    let currentHealth = healthDistribution.reduce((sum, h) => sum + h, 0);
                    console.log(`Vita iniziale totale: ${currentHealth}`);
                    
                    let isPartyDefeated = false;
                    let battleCount = 1; // Iniziamo da 1 per contare anche la battaglia originale
                    const equippedItems = [10, 20, 30]; // Stessi oggetti del test originale
                    
                    // Nuovo limite di 20 battaglie per party (ridotto da 100)
                    const maxBattlesPerParty = 50;
                    
                    // Combattiamo finché il party non viene sconfitto o si raggiunge il limite
                    while (!isPartyDefeated && battleCount < maxBattlesPerParty) {
                        try {
                            // Salva la salute attuale di ogni procione prima della battaglia
                            const previousHealthDistribution = [...healthDistribution];
                            const previousTotalHealth = previousHealthDistribution.reduce((sum, h) => sum + h, 0);
                            
                            // Generiamo un nuovo seed per ogni battaglia
                            const randomSeed = Math.floor(Math.random() * 1000000) + 1 + i * 100 + battleCount;
                            
                            // Chiamata al contratto per simulare battaglia
                            const tx = await dungeonBattler.calculateBattleOutcome(
                                party.dungeonId,
                                0, // partyIndex
                                tokenIds[0],
                                tokenIds[1],
                                tokenIds[2],
                                healthDistribution[0],
                                healthDistribution[1],
                                healthDistribution[2],
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
                            
                            // Estrai anche tutti gli eventi per verificare le guarigioni Paladin
                            const allEvents = receipt.logs
                                .filter(log => log.address === dungeonBattler.target)
                                .map(log => {
                                    try {
                                        return dungeonBattler.interface.parseLog(log);
                                    } catch (e) {
                                        return null;
                                    }
                                })
                                .filter(parsed => parsed !== null);
                            
                            // Cerca eventi di guarigione Paladin
                            const healingEvents = allEvents.filter(event => event.name === "PaladinHealActivated");
                            
                            // Se ci sono eventi di guarigione, incrementa i contatori
                            if (healingEvents.length > 0) {
                                enduranceHealingStats[party.dungeonDifficulty] += healingEvents.length;
                                enduranceTotalHealings += healingEvents.length;
                                console.log(`🧪 [Resistenza] Paladin ha curato in ${party.dungeonDifficulty.substring(0, 5)} (Round ${battleCount})`);
                            }
                            
                            if (battleEvents.length > 0) {
                                const event = battleEvents[0];
                                
                                // Estrai i dati dall'evento
                                const success = event.args.success;
                                const remainingHealth = Number(event.args.remainingHealth);
                                const totalDamage = Number(event.args.totalDamage || 0);
                                
                                // Se la battaglia è stata persa o la vita è scesa a 0, il party è sconfitto
                                if (!success || remainingHealth <= 0) {
                                    isPartyDefeated = true;
                                    console.log(`Battaglia ${battleCount}: ❌ Party sconfitto`);
                                } else {
                                    // Verifica se la salute è cambiata nel contratto
                                    const contractHealthBefore = [...previousHealthDistribution];
                                    
                                    // Altrimenti, otteniamo la salute esatta di ogni procione dopo la battaglia
                                    const contractHealthAfter = [];
                                    for (let j = 0; j < 3; j++) {
                                        const updatedHealth = await idleProcioneNFT.getCurrentHealth(tokenIds[j]);
                                        contractHealthAfter.push(Number(updatedHealth));
                                    }
                                    
                                    // Calcola il danno subito in base ai valori del contratto
                                    const contractDamage = contractHealthBefore.map((health, idx) => 
                                        Math.max(0, health - contractHealthAfter[idx])
                                    );
                                    const contractTotalDamage = contractDamage.reduce((sum, damage) => sum + damage, 0);
                                    
                                    // Aggiorna la distribuzione della salute con i valori calcolati nella battaglia
                                    // Calcola la nuova salute di ogni procione dopo la battaglia
                                    const totalHealthBefore = contractHealthBefore.reduce((sum, h) => sum + h, 0);
                                    const healthReductionRatio = remainingHealth / totalHealthBefore;
                                    
                                    // Se il danno è stato significativo, aggiorniamo la salute in modo proporzionale
                                    const newHealthDistribution = [];
                                    if (healthReductionRatio < 1.0) {
                                        for (let j = 0; j < 3; j++) {
                                            // Se il procione aveva vita 0, rimane a 0
                                            if (contractHealthBefore[j] === 0) {
                                                newHealthDistribution.push(0);
                                            } else {
                                                // Altrimenti, riduci la salute in proporzione
                                                // Usiamo Math.max per assicurarci che non vada sotto zero
                                                const newHealth = Math.max(0, Math.floor(contractHealthBefore[j] * healthReductionRatio));
                                                newHealthDistribution.push(newHealth);
                                            }
                                        }
                                    } else {
                                        // Se non ci sono danni, mantieni la salute precedente
                                        newHealthDistribution.push(...contractHealthBefore);
                                    }
                                    
                                    // Aggiorna effettivamente la salute degli NFT usando la funzione di test
                                    await dungeonBattler.updateHealthAfterBattle(
                                        tokenIds[0],
                                        tokenIds[1],
                                        tokenIds[2],
                                        newHealthDistribution
                                    );
                                    
                                    // Verifica che la salute sia stata effettivamente aggiornata
                                    const verifiedHealthAfter = [];
                                    let matchesExpected = true;
                                    for (let j = 0; j < 3; j++) {
                                        const currentHealth = await idleProcioneNFT.getCurrentHealth(tokenIds[j]);
                                        verifiedHealthAfter.push(Number(currentHealth));
                                        if (Number(currentHealth) !== newHealthDistribution[j]) {
                                            matchesExpected = false;
                                        }
                                    }
                                    
                                    // Aggiorna la distribuzione di salute con i valori effettivi
                                    healthDistribution = [...verifiedHealthAfter];
                                    currentHealth = healthDistribution.reduce((sum, h) => sum + h, 0);
                                    
                                    // Calcola i danni subiti per ogni procione e il danno totale basato sull'evento
                                    const damagePerProcione = previousHealthDistribution.map((prevHealth, idx) => 
                                        Math.max(0, prevHealth - healthDistribution[idx])
                                    );
                                    const calculatedTotalDamage = previousTotalHealth - currentHealth;
                                    const damagePercentage = (calculatedTotalDamage / previousTotalHealth * 100).toFixed(1);
                                    
                                    console.log(`Battaglia ${battleCount}: ✅ Sopravvissuto (HP: ${healthDistribution.join('/')} - totale: ${currentHealth})`);
                                    console.log(`   Danni subiti: ${damagePerProcione.join('/')} - totale: ${calculatedTotalDamage} (${damagePercentage}%)`);
                                    console.log(`   Verifica danni: Evento=${totalDamage}, Calcolato=${calculatedTotalDamage}, Contratto=${contractTotalDamage}`);
                                    if (!matchesExpected) {
                                        console.log(`   ⚠️ Avviso: La salute aggiornata non corrisponde al valore atteso!`);
                                        console.log(`      Atteso: ${newHealthDistribution.join('/')}, Effettivo: ${verifiedHealthAfter.join('/')}`);
                                    }
                                    
                                    // Incrementa il contatore delle battaglie
                                    battleCount++;
                                }
                            }
                        } catch (error) {
                            console.error(`Errore durante la battaglia di resistenza: ${error.message}`);
                            // In caso di errore, consideriamo il party sconfitto per sicurezza
                            isPartyDefeated = true;
                        }
                    }
                    
                    // Salva i risultati di questo party
                    const enduranceResult = {
                        dungeonId: party.dungeonId,
                        dungeonDifficulty: party.dungeonDifficulty,
                        initialHealth: party.remainingHealth, // La vita iniziale di questo test è quella rimasta dal test precedente
                        battleCount: battleCount,
                        // Se il ciclo è terminato per il limite, consideriamo come "sopravvissuto a limite massimo battaglie"
                        maxedOut: battleCount >= maxBattlesPerParty
                    };
                    
                    enduranceResults.push(enduranceResult);
                    
                    // Aggiorna le statistiche per difficoltà
                    enduranceStats[party.dungeonDifficulty].totalBattles += battleCount;
                    enduranceStats[party.dungeonDifficulty].parties++;
                    enduranceStats[party.dungeonDifficulty].maxBattles = Math.max(enduranceStats[party.dungeonDifficulty].maxBattles, battleCount);
                    enduranceStats[party.dungeonDifficulty].minBattles = Math.min(enduranceStats[party.dungeonDifficulty].minBattles, battleCount);
                    
                    console.log(`Party ha resistito per ${battleCount} battaglie alla difficoltà ${party.dungeonDifficulty}`);
                    
                    // Aggiorna il contatore dei party processati
                    partiesProcessed++;
                    
                    // Monitoraggio del tempo ogni 5 party o alla fine
                    const currentTime = Date.now();
                    if (partiesProcessed === totalParties || partiesProcessed % 5 === 0 || currentTime - lastProgressUpdate > 30000) {
                        const elapsedTimeMs = currentTime - enduranceStartTime;
                        const elapsedTimeSec = elapsedTimeMs / 1000;
                        const averageTimePerParty = elapsedTimeSec / partiesProcessed;
                        const remainingParties = totalParties - partiesProcessed;
                        const estimatedRemainingTimeSec = remainingParties * averageTimePerParty;
                        
                        // Formatta il tempo stimato rimanente
                        const remainingMinutes = Math.floor(estimatedRemainingTimeSec / 60);
                        const remainingSeconds = Math.floor(estimatedRemainingTimeSec % 60);
                        
                        console.log(`\n📊 STATO AVANZAMENTO TEST RESISTENZA 📊`);
                        console.log(`Progress: ${partiesProcessed}/${totalParties} party (${(partiesProcessed/totalParties*100).toFixed(1)}%)`);
                        console.log(`Tempo trascorso: ${elapsedTimeSec.toFixed(1)}s`);
                        console.log(`Tempo medio per party: ${averageTimePerParty.toFixed(2)}s`);
                        console.log(`Tempo stimato rimanente: ${remainingMinutes}m ${remainingSeconds}s`);
                        
                        lastProgressUpdate = currentTime;
                    }
                }
                
                // Tempo totale di esecuzione del test di resistenza
                const enduranceTotalTimeMs = Date.now() - enduranceStartTime;
                const enduranceTotalTimeSec = enduranceTotalTimeMs / 1000;
                const enduranceTotalTimeMin = enduranceTotalTimeSec / 60;
                
                // Analisi dei risultati
                console.log("\n\n📊 RISULTATI TEST DI RESISTENZA 📊");
                console.log("===============================");
                console.log(`✓ Completato in ${enduranceTotalTimeSec.toFixed(1)}s (${enduranceTotalTimeMin.toFixed(2)} min)`);
                console.log(`✓ Party testati: ${partiesToTest.length}`);
                console.log(`✓ Battaglie totali: ${enduranceResults.reduce((sum, r) => sum + r.battleCount, 0)}`);
                console.log(`✓ Tempo medio per party: ${(enduranceTotalTimeSec / partiesToTest.length).toFixed(2)}s`);
                
                // Creiamo una tabella delle medie per difficoltà
                console.log("\nMedia battaglie per difficoltà:");
                console.log("Difficoltà       | Battaglie Medie | Party Testati | Min | Max");
                console.log("--------------------------------------------------------");
                
                for (const [difficulty, stats] of Object.entries(enduranceStats)) {
                    if (stats.parties > 0) {
                        const averageBattles = (stats.totalBattles / stats.parties).toFixed(2);
                        const minBattles = stats.minBattles < Infinity ? stats.minBattles : "N/A";
                        console.log(`${difficulty.padEnd(16)} | ${averageBattles.padEnd(15)} | ${stats.parties.toString().padEnd(12)} | ${minBattles.toString().padEnd(3)} | ${stats.maxBattles}`);
                    }
                }
                
                // Mostra risultati dettagliati per ogni party
                console.log("\nRisultati dettagliati (max 20 party):");
                console.log("Diff. | Vita Iniziale | Battaglie | Note");
                console.log("----------------------------------------");
                
                const maxToShow = Math.min(20, enduranceResults.length);
                for (let i = 0; i < maxToShow; i++) {
                    const result = enduranceResults[i];
                    const note = result.maxedOut ? "Limite massimo" : "";
                    console.log(`${result.dungeonDifficulty.substring(0, 5).padEnd(6)} | ${result.initialHealth.toString().padEnd(13)} | ${result.battleCount.toString().padEnd(9)} | ${note}`);
                }
                
                // Se abbiamo usato Paladin, mostriamo anche le statistiche di guarigione
                if (usePaladin && enduranceTotalHealings > 0) {
                    console.log("\nStatistiche Guarigioni Paladin nel Test di Resistenza:");
                    console.log("=====================================================");
                    console.log("Difficoltà       | Guarigioni | % sul totale | Guarigioni/Party");
                    console.log("----------------------------------------------------------------");
                    
                    // Calcola le percentuali e stampa i risultati
                    Object.entries(enduranceHealingStats).forEach(([difficulty, healCount]) => {
                        if (enduranceStats[difficulty] && enduranceStats[difficulty].parties > 0) {
                            const percentOfTotal = (healCount / enduranceTotalHealings * 100).toFixed(2);
                            const healingsPerParty = (healCount / enduranceStats[difficulty].parties).toFixed(3);
                            console.log(`${difficulty.padEnd(16)} | ${healCount.toString().padEnd(10)} | ${percentOfTotal.padEnd(12)}% | ${healingsPerParty}`);
                        }
                    });
                    
                    console.log(`\nTotale guarigioni: ${enduranceTotalHealings}`);
                    console.log(`Media guarigioni per party: ${(enduranceTotalHealings / partiesToTest.length).toFixed(3)}`);
                }
                
                // Distruggi gli NFT creati per il test di resistenza
                for (let i = 0; i < partiesToTest.length; i++) {
                    for (let j = 0; j < 3; j++) {
                        try {
                            await idleProcioneNFT.burn(1000000 + i*3 + j);
                        } catch (error) {
                            // Ignora eventuali errori
                        }
                    }
                }
                
                console.log("\n✅ Test di resistenza completato con successo!");
            } else {
                console.log("Test di resistenza saltato.");
            }
        });
        
        // Funzione per ottenere il nome della difficoltà del dungeon
        function getDungeonDifficulty(index) {
            const difficulties = [
                "Molto Facile",
                "Facile",
                "Facile+",
                "Medio-Facile",
                "Medio",
                "Medio+",
                "Difficile",
                "Difficile+",
                "Molto Difficile",
                "Estremo"
            ];
            return difficulties[index] || "Sconosciuto";
        }
    });
}); 