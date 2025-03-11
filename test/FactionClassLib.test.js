const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FactionClassLib", function () {
    let FactionClassLibTest;
    let factionClassLibTest;
    let owner;
    let addr1;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        // Deploy del contratto di test
        FactionClassLibTest = await ethers.getContractFactory("FactionClassLibTest");
        factionClassLibTest = await FactionClassLibTest.deploy();
        await factionClassLibTest.deployed();
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
            expect(await factionClassLibTest.getMaxFactionGen()).to.equal(100);
            expect(await factionClassLibTest.getMaxClassGen()).to.equal(100);
        });

        it("Non dovrebbe accettare limiti invalidi", async function () {
            await expect(factionClassLibTest.setMaxGenLimits(0, 100))
                .to.be.revertedWith("Limiti non validi");
            await expect(factionClassLibTest.setMaxGenLimits(100, 0))
                .to.be.revertedWith("Limiti non validi");
        });

        it("Dovrebbe verificare correttamente la disponibilità degli slot", async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
            expect(await factionClassLibTest.hasAvailableSlots()).to.be.true;

            // Genera fino al limite
            const maxFactions = 100;
            for (let i = 0; i < maxFactions; i++) {
                try {
                    await factionClassLibTest.generateValidFaction(i, 0);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            // Verifica che non ci siano più slot disponibili
            expect(await factionClassLibTest.getFacGen()).to.equal(100);
            expect(await factionClassLibTest.hasAvailableSlots()).to.be.false;
        });
    });

    describe("Generazione Fazioni", function () {
        beforeEach(async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
        });

        it("Dovrebbe generare fazioni valide", async function () {
            const faction = await factionClassLibTest.generateValidFaction(123, 0);
            expect(faction).to.be.gt(0);
            expect(faction).to.be.lte(4);
        });

        it("Dovrebbe incrementare i contatori correttamente", async function () {
            await factionClassLibTest.generateValidFaction(123, 0);
            expect(await factionClassLibTest.getFacGen()).to.equal(1);
        });

        it("Dovrebbe distribuire le fazioni equamente", async function () {
            // Genera 40 fazioni (10 per tipo)
            for (let i = 0; i < 40; i++) {
                try {
                    await factionClassLibTest.generateValidFaction(i, 0);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            // Verifica che ogni fazione abbia circa lo stesso numero
            const counts = await Promise.all([1, 2, 3, 4].map(f => 
                factionClassLibTest.getFactionCount(f)
            ));
            
            // Verifica che nessuna fazione superi il 30% del totale
            const total = counts.reduce((a, b) => a + b, 0);
            counts.forEach(count => {
                expect(count).to.be.lte(total * 0.3);
            });
        });

        it("Dovrebbe fallire quando si raggiunge il limite", async function () {
            await factionClassLibTest.setMaxGenLimits(4, 100);
            
            // Genera 4 fazioni
            for (let i = 0; i < 4; i++) {
                await factionClassLibTest.generateValidFaction(i, 0);
            }

            // La quinta dovrebbe fallire
            await expect(factionClassLibTest.generateValidFaction(5, 0))
                .to.be.revertedWith("Limite fazioni raggiunto");
        });
    });

    describe("Generazione Classi", function () {
        beforeEach(async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
        });

        it("Dovrebbe generare classi valide", async function () {
            const class_ = await factionClassLibTest.generateValidClass(123, 0);
            expect(class_).to.be.gt(0);
            expect(class_).to.be.lte(5);
        });

        it("Dovrebbe incrementare i contatori correttamente", async function () {
            await factionClassLibTest.generateValidClass(123, 0);
            expect(await factionClassLibTest.getClassGen()).to.equal(1);
        });

        it("Dovrebbe distribuire le classi equamente", async function () {
            // Genera 50 classi (10 per tipo)
            for (let i = 0; i < 50; i++) {
                try {
                    await factionClassLibTest.generateValidClass(i, 0);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            // Verifica che ogni classe abbia circa lo stesso numero
            const counts = await Promise.all([1, 2, 3, 4, 5].map(c => 
                factionClassLibTest.getClassCount(c)
            ));
            
            // Verifica che nessuna classe superi il 25% del totale
            const total = counts.reduce((a, b) => a + b, 0);
            counts.forEach(count => {
                expect(count).to.be.lte(total * 0.25);
            });
        });

        it("Dovrebbe fallire quando si raggiunge il limite", async function () {
            await factionClassLibTest.setMaxGenLimits(100, 5);
            
            // Genera 5 classi
            for (let i = 0; i < 5; i++) {
                await factionClassLibTest.generateValidClass(i, 0);
            }

            // La sesta dovrebbe fallire
            await expect(factionClassLibTest.generateValidClass(6, 0))
                .to.be.revertedWith("Limite classi raggiunto");
        });
    });

    describe("Generazione Combinata", function () {
        beforeEach(async function () {
            await factionClassLibTest.setMaxGenLimits(100, 100);
        });

        it("Dovrebbe gestire correttamente la generazione di fazioni e classi insieme", async function () {
            // Genera alcune combinazioni
            for (let i = 0; i < 10; i++) {
                const faction = await factionClassLibTest.generateValidFaction(i, 0);
                const class_ = await factionClassLibTest.generateValidClass(i, 0);

                expect(faction).to.be.gt(0);
                expect(faction).to.be.lte(4);
                expect(class_).to.be.gt(0);
                expect(class_).to.be.lte(5);
            }

            // Verifica i contatori
            expect(await factionClassLibTest.getFacGen()).to.equal(10);
            expect(await factionClassLibTest.getClassGen()).to.equal(10);
        });

        it("Dovrebbe mantenere la distribuzione equa anche con generazione combinata", async function () {
            // Genera 40 combinazioni
            for (let i = 0; i < 40; i++) {
                try {
                    await factionClassLibTest.generateValidFaction(i, 0);
                    await factionClassLibTest.generateValidClass(i, 0);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            // Verifica le distribuzioni
            const factionCounts = await Promise.all([1, 2, 3, 4].map(f => 
                factionClassLibTest.getFactionCount(f)
            ));
            const classCounts = await Promise.all([1, 2, 3, 4, 5].map(c => 
                factionClassLibTest.getClassCount(c)
            ));

            // Verifica che le distribuzioni siano ragionevolmente eque
            const totalFactions = factionCounts.reduce((a, b) => a + b, 0);
            const totalClasses = classCounts.reduce((a, b) => a + b, 0);

            factionCounts.forEach(count => {
                expect(count).to.be.lte(totalFactions * 0.3);
            });
            classCounts.forEach(count => {
                expect(count).to.be.lte(totalClasses * 0.25);
            });
        });
    });
}); 