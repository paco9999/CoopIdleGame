const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FactionClassLib", function () {
    let FactionClassLibTest;
    let factionClassLibTest;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy del contratto di test
        const FactionClassLibTestFactory = await ethers.getContractFactory("FactionClassLibTest");
        factionClassLibTest = await FactionClassLibTestFactory.deploy();
        await factionClassLibTest.waitForDeployment();
    });

    describe("Enums", function () {
        it("Dovrebbe avere i valori corretti per le Fazioni", async function () {
            expect(await factionClassLibTest.Faction_NONE()).to.equal(0);
            expect(await factionClassLibTest.Faction_GUARDIAN()).to.equal(1);
            expect(await factionClassLibTest.Faction_SHADOW()).to.equal(2);
            expect(await factionClassLibTest.Faction_MYSTIC()).to.equal(3);
            expect(await factionClassLibTest.Faction_WILD()).to.equal(4);
        });

        it("Dovrebbe avere i valori corretti per le Classi", async function () {
            expect(await factionClassLibTest.Class_NONE()).to.equal(0);
            expect(await factionClassLibTest.Class_WARRIOR()).to.equal(1);
            expect(await factionClassLibTest.Class_ROGUE()).to.equal(2);
            expect(await factionClassLibTest.Class_MAGE()).to.equal(3);
            expect(await factionClassLibTest.Class_RANGER()).to.equal(4);
            expect(await factionClassLibTest.Class_TANK()).to.equal(5);
        });
    });

    describe("Limiti di Generazione", function () {
        it("Dovrebbe impostare correttamente i limiti massimi", async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
            const [maxFactionGen, maxClassGen] = await factionClassLibTest.getMaxGenLimits();
            expect(maxFactionGen).to.equal(100n);
            expect(maxClassGen).to.equal(100n);
        });

        it("Non dovrebbe accettare limiti invalidi", async function () {
            await expect(
                factionClassLibTest.setMaxGenLimits(0, 100)
            ).to.be.revertedWith("Limiti non validi");
        });

        it("Dovrebbe verificare correttamente la disponibilità degli slot", async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
            expect(await factionClassLibTest.hasAvailableSlots()).to.equal(true);
        });
    });

    describe("Generazione Fazioni", function () {
        beforeEach(async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
        });

        it("Dovrebbe generare fazioni valide", async function () {
            const tx = await factionClassLibTest.generateValidFaction();
            const receipt = await tx.wait();
            const event = receipt.logs[0];
            const decodedEvent = factionClassLibTest.interface.parseLog(event);
            expect(decodedEvent.name).to.equal("FactionGenerated");
            expect(decodedEvent.args.factionId).to.be.within(1, 4);
        });

        it("Dovrebbe incrementare i contatori correttamente", async function () {
            const initialCount = await factionClassLibTest.getFacGen();
            await factionClassLibTest.generateValidFaction();
            const finalCount = await factionClassLibTest.getFacGen();
            expect(finalCount).to.equal(initialCount + 1n);
        });

        it("Dovrebbe distribuire le fazioni equamente", async function () {
            const counts = Array(5).fill(0);
            for (let i = 0; i < 50; i++) {
                const tx = await factionClassLibTest.generateValidFaction();
                const receipt = await tx.wait();
                const event = receipt.logs[0];
                const decodedEvent = factionClassLibTest.interface.parseLog(event);
                counts[decodedEvent.args.factionId]++;
            }
            counts.forEach((count, index) => {
                if (index === 0) {
                    expect(count).to.equal(0); // NONE non dovrebbe mai essere generato
                } else {
                    expect(count).to.be.at.most(20);
                }
            });
        });

        it("Dovrebbe fallire quando si raggiunge il limite", async function () {
            await factionClassLibTest.setMaxGenLimits(1, 100);
            await factionClassLibTest.generateValidFaction();
            await expect(
                factionClassLibTest.generateValidFaction()
            ).to.be.revertedWith("Limite fazioni raggiunto");
        });
    });

    describe("Generazione Classi", function () {
        beforeEach(async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
        });

        it("Dovrebbe generare classi valide", async function () {
            const tx = await factionClassLibTest.generateValidClass();
            const receipt = await tx.wait();
            const event = receipt.logs[0];
            const decodedEvent = factionClassLibTest.interface.parseLog(event);
            expect(decodedEvent.name).to.equal("ClassGenerated");
            expect(decodedEvent.args.classId).to.be.within(1, 5);
        });

        it("Dovrebbe incrementare i contatori correttamente", async function () {
            const initialCount = await factionClassLibTest.getClassGen();
            await factionClassLibTest.generateValidClass();
            const finalCount = await factionClassLibTest.getClassGen();
            expect(finalCount).to.equal(initialCount + 1n);
        });

        it("Dovrebbe distribuire le classi equamente", async function () {
            const counts = Array(6).fill(0);
            for (let i = 0; i < 50; i++) {
                const tx = await factionClassLibTest.generateValidClass();
                const receipt = await tx.wait();
                const event = receipt.logs[0];
                const decodedEvent = factionClassLibTest.interface.parseLog(event);
                counts[decodedEvent.args.classId]++;
            }
            counts.forEach((count, index) => {
                if (index === 0) {
                    expect(count).to.equal(0); // NONE non dovrebbe mai essere generato
                } else {
                    expect(count).to.be.at.most(20);
                }
            });
        });

        it("Dovrebbe fallire quando si raggiunge il limite", async function () {
            await factionClassLibTest.setMaxGenLimits(100, 1);
            await factionClassLibTest.generateValidClass();
            await expect(
                factionClassLibTest.generateValidClass()
            ).to.be.revertedWith("Limite classi raggiunto");
        });
    });

    describe("Generazione Combinata", function () {
        beforeEach(async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
        });

        it("Dovrebbe gestire correttamente la generazione di fazioni e classi insieme", async function () {
            const tx = await factionClassLibTest.generateValidFactionAndClass();
            const receipt = await tx.wait();
            const events = receipt.logs;

            const decodedFactionEvent = factionClassLibTest.interface.parseLog(events[0]);
            const decodedClassEvent = factionClassLibTest.interface.parseLog(events[1]);

            expect(decodedFactionEvent.name).to.equal("FactionGenerated");
            expect(decodedClassEvent.name).to.equal("ClassGenerated");
            expect(decodedFactionEvent.args.factionId).to.be.within(1, 4);
            expect(decodedClassEvent.args.classId).to.be.within(1, 5);
        });

        it("Dovrebbe mantenere la distribuzione equa anche con generazione combinata", async function () {
            const factionCounts = Array(5).fill(0);
            const classCounts = Array(6).fill(0);

            for (let i = 0; i < 50; i++) {
                const tx = await factionClassLibTest.generateValidFactionAndClass();
                const receipt = await tx.wait();
                const events = receipt.logs;

                const decodedFactionEvent = factionClassLibTest.interface.parseLog(events[0]);
                const decodedClassEvent = factionClassLibTest.interface.parseLog(events[1]);

                factionCounts[decodedFactionEvent.args.factionId]++;
                classCounts[decodedClassEvent.args.classId]++;
            }

            factionCounts.forEach((count, index) => {
                if (index === 0) {
                    expect(count).to.equal(0); // NONE non dovrebbe mai essere generato
                } else {
                    expect(count).to.be.at.most(20);
                }
            });
            classCounts.forEach((count, index) => {
                if (index === 0) {
                    expect(count).to.equal(0); // NONE non dovrebbe mai essere generato
                } else {
                    expect(count).to.be.at.most(20);
                }
            });
        });
    });
}); 