const { expect, anyValue } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DungeonManager", function () {
    let dungeonManager;
    let craftingManager;
    let idleProcioneNFT;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy del mock CraftingManager
        const CraftingManager = await ethers.getContractFactory("contracts/mocks/MockCraftingManager.sol:MockCraftingManager");
        craftingManager = await CraftingManager.deploy();

        // Deploy del mock IdleProcioneNFT
        const MockIdleProcioneNFT = await ethers.getContractFactory("contracts/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        idleProcioneNFT = await MockIdleProcioneNFT.deploy();

        // Deploy del DungeonManager
        const DungeonManager = await ethers.getContractFactory("DungeonManager");
        dungeonManager = await DungeonManager.deploy(await idleProcioneNFT.getAddress(), await craftingManager.getAddress());
    });

    describe("Inizializzazione", function () {
        it("Dovrebbe impostare correttamente il proprietario", async function () {
            expect(await dungeonManager.owner()).to.equal(owner.address);
        });

        it("Dovrebbe impostare correttamente l'indirizzo del CraftingManager", async function () {
            expect(await dungeonManager.craftingManager()).to.equal(await craftingManager.getAddress());
        });
    });

    describe("Gestione Dungeon", function () {
        const dungeonId = 1;
        const itemsRequired = [1, 2, 3];
        const dungeonStats = [100, 200, 300, 400];
        const timeDuration = 3600;
        const numberOfItemsRequired = 3;

        beforeEach(async function () {
            // Imposta le ricette come valide nel mock
            for (const recipeId of itemsRequired) {
                await craftingManager.setRecipeValidity(recipeId, true);
            }

            await dungeonManager.initializeDungeon(
                dungeonId,
                itemsRequired,
                dungeonStats,
                timeDuration,
                numberOfItemsRequired
            );
        });

        it("Dovrebbe inizializzare correttamente un dungeon", async function () {
            const dungeon = await dungeonManager.getDungeon(dungeonId);
            expect(dungeon.initialized).to.be.true;
            expect(dungeon.itemsRequired).to.deep.equal(itemsRequired);
            expect(dungeon.dungeonStats).to.deep.equal(dungeonStats);
            expect(dungeon.timeDuration).to.equal(timeDuration);
            expect(dungeon.numberOfItemsRequired).to.equal(numberOfItemsRequired);
        });

        it("Dovrebbe aggiornare correttamente le statistiche del dungeon", async function () {
            const newStats = [150, 250, 350, 450];
            await dungeonManager.updateDungeonStats(dungeonId, newStats);
            
            const dungeon = await dungeonManager.getDungeon(dungeonId);
            expect(dungeon.dungeonStats).to.deep.equal(newStats);
        });

        it("Dovrebbe aggiornare correttamente gli oggetti richiesti", async function () {
            const newItems = [4, 5, 6];
            const newNumberRequired = 3;

            // Imposta le nuove ricette come valide
            for (const recipeId of newItems) {
                await craftingManager.setRecipeValidity(recipeId, true);
            }

            await dungeonManager.updateDungeonItems(dungeonId, newItems, newNumberRequired);
            
            const dungeon = await dungeonManager.getDungeon(dungeonId);
            expect(dungeon.itemsRequired).to.deep.equal(newItems);
            expect(dungeon.numberOfItemsRequired).to.equal(newNumberRequired);
        });

        it("Dovrebbe aggiornare correttamente il tempo del dungeon", async function () {
            const newTime = 7200;
            await dungeonManager.updateDungeonTime(dungeonId, newTime);
            
            const dungeon = await dungeonManager.getDungeon(dungeonId);
            expect(dungeon.timeDuration).to.equal(newTime);
        });

        it("Dovrebbe restituire correttamente i requisiti del dungeon", async function () {
            const [items, numRequired] = await dungeonManager.getDungeonRequirements(dungeonId);
            expect(items).to.deep.equal(itemsRequired);
            expect(numRequired).to.equal(numberOfItemsRequired);
        });

        it("Dovrebbe restituire correttamente le statistiche del dungeon", async function () {
            const stats = await dungeonManager.getStatistics(dungeonId);
            expect(stats).to.deep.equal(dungeonStats);
        });

        it("Non dovrebbe permettere l'inizializzazione con ricette non valide", async function () {
            const invalidRecipeIds = [7, 8, 9];
            await expect(
                dungeonManager.initializeDungeon(2, invalidRecipeIds, dungeonStats, timeDuration, 3)
            ).to.be.revertedWithCustomError(dungeonManager, "InvalidRecipeIds");
        });
    });

    describe("Gestione degli errori", function () {
        it("Non dovrebbe permettere l'inizializzazione con durata zero", async function () {
            const validItems = [1, 2, 3];
            for (const recipeId of validItems) {
                await craftingManager.setRecipeValidity(recipeId, true);
            }

            await expect(
                dungeonManager.initializeDungeon(1, validItems, [100, 200, 300, 400], 0, 3)
            ).to.be.revertedWith("La durata deve essere maggiore di zero");
        });

        it("Non dovrebbe permettere l'aggiornamento delle statistiche di un dungeon non inizializzato", async function () {
            await expect(
                dungeonManager.updateDungeonStats(999, [150, 250, 350, 450])
            ).to.be.revertedWith("Dungeon non inizializzato");
        });

        it("Non dovrebbe permettere l'aggiornamento degli oggetti di un dungeon non inizializzato", async function () {
            const validItems = [4, 5, 6];
            for (const recipeId of validItems) {
                await craftingManager.setRecipeValidity(recipeId, true);
            }

            await expect(
                dungeonManager.updateDungeonItems(999, validItems, 3)
            ).to.be.revertedWith("Dungeon non inizializzato");
        });

        it("Non dovrebbe permettere l'aggiornamento del tempo di un dungeon non inizializzato", async function () {
            await expect(
                dungeonManager.updateDungeonTime(999, 7200)
            ).to.be.revertedWith("Dungeon non inizializzato");
        });

        it("Non dovrebbe permettere l'aggiornamento del tempo a zero", async function () {
            const dungeonId = 1;
            const validItems = [1, 2, 3];
            for (const recipeId of validItems) {
                await craftingManager.setRecipeValidity(recipeId, true);
            }

            await dungeonManager.initializeDungeon(dungeonId, validItems, [100, 200, 300, 400], 3600, 3);
            
            await expect(
                dungeonManager.updateDungeonTime(dungeonId, 0)
            ).to.be.revertedWith("La durata deve essere maggiore di zero");
        });
    });

    describe("Gestione Party", function () {
        const dungeonId = 1;
        const itemsRequired = [1, 2, 3];
        const dungeonStats = [100, 200, 300, 400];
        const timeDuration = 3600;
        const numberOfItemsRequired = 3;
        let procioneIds;

        beforeEach(async function () {
            // Mint di 3 procioni per i test
            procioneIds = [0, 1, 2];
            for (const id of procioneIds) {
                await idleProcioneNFT.mint(addr1.address, id);
            }

            // Imposta le ricette come valide nel mock
            for (const recipeId of itemsRequired) {
                await craftingManager.setRecipeValidity(recipeId, true);
            }

            // Inizializza il dungeon
            await dungeonManager.initializeDungeon(
                dungeonId,
                itemsRequired,
                dungeonStats,
                timeDuration,
                numberOfItemsRequired
            );
        });

        it("Dovrebbe avviare correttamente un dungeon con oggetti", async function () {
            const currentTime = await time.latest();
            const expectedEndTime = currentTime + timeDuration;

            const tx = await dungeonManager.connect(addr1).startDungeon(
                dungeonId,
                procioneIds,
                itemsRequired
            );

            // Verifica l'evento
            await expect(tx)
                .to.emit(dungeonManager, "DungeonStarted")
                .withArgs(
                    dungeonId, 
                    procioneIds[0], 
                    procioneIds[1], 
                    procioneIds[2], 
                    itemsRequired, 
                    await time.latest() + timeDuration
                );

            // Verifica lo stato dei procioni
            for (const id of procioneIds) {
                expect(await idleProcioneNFT.getDungeonStatus(id)).to.be.true;
            }

            // Verifica il party
            const party = (await dungeonManager.dungeonParties(dungeonId, 0));
            expect(party.dungeonId).to.equal(dungeonId);
            expect(party.procione1Id).to.equal(procioneIds[0]);
            expect(party.procione2Id).to.equal(procioneIds[1]);
            expect(party.procione3Id).to.equal(procioneIds[2]);
            expect(party.procione1Health).to.equal(100);
            expect(party.procione2Health).to.equal(100);
            expect(party.procione3Health).to.equal(100);
            expect(party.endTime).to.be.closeTo(expectedEndTime, 5); // Aumentiamo la tolleranza a 5 secondi
        });

        it("Dovrebbe avviare correttamente un dungeon senza oggetti", async function () {
            // Aggiorna il dungeon per non richiedere oggetti
            await dungeonManager.updateDungeonItems(dungeonId, [], 0);

            const currentTime = await time.latest();
            const expectedEndTime = currentTime + timeDuration;

            const tx = await dungeonManager.connect(addr1).startDungeon(
                dungeonId,
                procioneIds,
                []
            );

            // Verifica l'evento
            await expect(tx)
                .to.emit(dungeonManager, "DungeonStarted")
                .withArgs(
                    dungeonId, 
                    procioneIds[0], 
                    procioneIds[1], 
                    procioneIds[2], 
                    [], 
                    await time.latest() + timeDuration
                );

            // Verifica lo stato dei procioni
            for (const id of procioneIds) {
                expect(await idleProcioneNFT.getDungeonStatus(id)).to.be.true;
            }

            // Verifica il party
            const party = (await dungeonManager.dungeonParties(dungeonId, 0));
            expect(party.dungeonId).to.equal(dungeonId);
            expect(party.procione1Id).to.equal(procioneIds[0]);
            expect(party.procione2Id).to.equal(procioneIds[1]);
            expect(party.procione3Id).to.equal(procioneIds[2]);
            expect(party.procione1Health).to.equal(100);
            expect(party.procione2Health).to.equal(100);
            expect(party.procione3Health).to.equal(100);
            expect(party.endTime).to.be.closeTo(expectedEndTime, 5); // Aumentiamo la tolleranza a 5 secondi
        });

        it("Non dovrebbe permettere l'avvio con procioni non posseduti", async function () {
            await expect(
                dungeonManager.connect(addr2).startDungeon(dungeonId, procioneIds, itemsRequired)
            ).to.be.revertedWithCustomError(dungeonManager, "InvalidNFTOwner");
        });

        it("Non dovrebbe permettere l'avvio con procioni con salute 0", async function () {
            await idleProcioneNFT.setCurrentHealth(procioneIds[0], 0);

            await expect(
                dungeonManager.connect(addr1).startDungeon(dungeonId, procioneIds, itemsRequired)
            ).to.be.revertedWithCustomError(dungeonManager, "InvalidHealth");
        });

        it("Non dovrebbe permettere l'avvio con numero errato di oggetti", async function () {
            await expect(
                dungeonManager.connect(addr1).startDungeon(dungeonId, procioneIds, [1, 2])
            ).to.be.revertedWithCustomError(dungeonManager, "InvalidItemCount");
        });

        it("Non dovrebbe permettere l'avvio con oggetti non validi", async function () {
            const invalidItems = [4, 5, 6]; // ID non validi

            await expect(
                dungeonManager.connect(addr1).startDungeon(dungeonId, procioneIds, invalidItems)
            ).to.be.revertedWithCustomError(dungeonManager, "InvalidRecipeIds");
        });

        it("Non dovrebbe permettere l'avvio di un dungeon non inizializzato", async function () {
            await expect(
                dungeonManager.connect(addr1).startDungeon(999, procioneIds, itemsRequired)
            ).to.be.revertedWithCustomError(dungeonManager, "DungeonNotInitialized");
        });
    });
}); 