const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StatsLib", function () {
    let StatsLibTest;
    let statsLibTest;

    beforeEach(async function () {
        // Deploy di un contratto di test che espone le funzioni della libreria
        const StatsLib = await ethers.getContractFactory("StatsLib");
        const statsLib = await StatsLib.deploy();
        await statsLib.deployed();

        // Deploy del contratto di test che utilizza la libreria
        StatsLibTest = await ethers.getContractFactory("StatsLibTest", {
            libraries: {
                StatsLib: statsLib.address
            }
        });
        statsLibTest = await StatsLibTest.deploy();
        await statsLibTest.deployed();
    });

    describe("Masks e Positions", function () {
        it("Dovrebbe avere le maschere corrette", async function () {
            expect(await statsLibTest.XP_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.LEVEL_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.HEALTH_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.STRENGTH_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.SPEED_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.INTELLIGENCE_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.ACCURACY_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.BREEDING_MASK()).to.equal("0xFFFF");
            expect(await statsLibTest.CLASS_MASK()).to.equal("0xFF");
            expect(await statsLibTest.FACTION_MASK()).to.equal("0xFF");
            expect(await statsLibTest.GENETICS_MASK()).to.equal("0xFFFFFFFF");
        });

        it("Dovrebbe avere le posizioni corrette", async function () {
            expect(await statsLibTest.XP_POSITION()).to.equal(0);
            expect(await statsLibTest.LEVEL_POSITION()).to.equal(16);
            expect(await statsLibTest.HEALTH_POSITION()).to.equal(32);
            expect(await statsLibTest.STRENGTH_POSITION()).to.equal(48);
            expect(await statsLibTest.SPEED_POSITION()).to.equal(64);
            expect(await statsLibTest.INTELLIGENCE_POSITION()).to.equal(80);
            expect(await statsLibTest.ACCURACY_POSITION()).to.equal(96);
            expect(await statsLibTest.BREEDING_POSITION()).to.equal(112);
            expect(await statsLibTest.CLASS_POSITION()).to.equal(128);
            expect(await statsLibTest.FACTION_POSITION()).to.equal(136);
            expect(await statsLibTest.GENETICS_POSITION()).to.equal(144);
        });
    });

    describe("Operazioni sui Campi", function () {
        it("Dovrebbe estrarre correttamente i valori", async function () {
            const data = "0x000000000000000000000000000000000000000000000000000000000000FFFF"; // XP = 65535
            const xp = await statsLibTest.extractField(data, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            expect(xp).to.equal(65535);
        });

        it("Dovrebbe aggiornare correttamente i valori", async function () {
            let data = "0x0000000000000000000000000000000000000000000000000000000000000000";
            
            // Aggiorna XP a 1000
            data = await statsLibTest.updateField(data, 1000, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            let xp = await statsLibTest.extractField(data, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            expect(xp).to.equal(1000);

            // Aggiorna Level a 50
            data = await statsLibTest.updateField(data, 50, await statsLibTest.LEVEL_MASK(), await statsLibTest.LEVEL_POSITION());
            let level = await statsLibTest.extractField(data, await statsLibTest.LEVEL_MASK(), await statsLibTest.LEVEL_POSITION());
            expect(level).to.equal(50);
        });

        it("Dovrebbe gestire correttamente i valori massimi", async function () {
            let data = "0x0000000000000000000000000000000000000000000000000000000000000000";
            
            // Prova con il valore massimo per XP (65535)
            data = await statsLibTest.updateField(data, 65535, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            let xp = await statsLibTest.extractField(data, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            expect(xp).to.equal(65535);

            // Prova con il valore massimo per Genetics (4294967295)
            data = await statsLibTest.updateField(data, 4294967295, await statsLibTest.GENETICS_MASK(), await statsLibTest.GENETICS_POSITION());
            let genetics = await statsLibTest.extractField(data, await statsLibTest.GENETICS_MASK(), await statsLibTest.GENETICS_POSITION());
            expect(genetics).to.equal(4294967295);
        });

        it("Dovrebbe mantenere l'integrità dei dati durante gli aggiornamenti multipli", async function () {
            let data = "0x0000000000000000000000000000000000000000000000000000000000000000";
            
            // Aggiorna multipli campi
            data = await statsLibTest.updateField(data, 1000, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            data = await statsLibTest.updateField(data, 50, await statsLibTest.LEVEL_MASK(), await statsLibTest.LEVEL_POSITION());
            data = await statsLibTest.updateField(data, 100, await statsLibTest.HEALTH_MASK(), await statsLibTest.HEALTH_POSITION());
            data = await statsLibTest.updateField(data, 30, await statsLibTest.STRENGTH_MASK(), await statsLibTest.STRENGTH_POSITION());
            data = await statsLibTest.updateField(data, 1, await statsLibTest.CLASS_MASK(), await statsLibTest.CLASS_POSITION());
            data = await statsLibTest.updateField(data, 2, await statsLibTest.FACTION_MASK(), await statsLibTest.FACTION_POSITION());

            // Verifica che tutti i valori siano corretti
            expect(await statsLibTest.extractField(data, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION())).to.equal(1000);
            expect(await statsLibTest.extractField(data, await statsLibTest.LEVEL_MASK(), await statsLibTest.LEVEL_POSITION())).to.equal(50);
            expect(await statsLibTest.extractField(data, await statsLibTest.HEALTH_MASK(), await statsLibTest.HEALTH_POSITION())).to.equal(100);
            expect(await statsLibTest.extractField(data, await statsLibTest.STRENGTH_MASK(), await statsLibTest.STRENGTH_POSITION())).to.equal(30);
            expect(await statsLibTest.extractField(data, await statsLibTest.CLASS_MASK(), await statsLibTest.CLASS_POSITION())).to.equal(1);
            expect(await statsLibTest.extractField(data, await statsLibTest.FACTION_MASK(), await statsLibTest.FACTION_POSITION())).to.equal(2);
        });
    });

    describe("Validazioni", function () {
        it("Dovrebbe gestire correttamente i valori zero", async function () {
            let data = "0x0000000000000000000000000000000000000000000000000000000000000000";
            
            // Aggiorna e verifica un campo con valore zero
            data = await statsLibTest.updateField(data, 0, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            let xp = await statsLibTest.extractField(data, await statsLibTest.XP_MASK(), await statsLibTest.XP_POSITION());
            expect(xp).to.equal(0);
        });

        it("Dovrebbe gestire correttamente i valori al limite", async function () {
            let data = "0x0000000000000000000000000000000000000000000000000000000000000000";
            
            // Test con valori al limite per diversi campi
            const testCases = [
                { mask: "XP_MASK", position: "XP_POSITION", value: 65535 },
                { mask: "LEVEL_MASK", position: "LEVEL_POSITION", value: 65535 },
                { mask: "CLASS_MASK", position: "CLASS_POSITION", value: 255 },
                { mask: "FACTION_MASK", position: "FACTION_POSITION", value: 255 },
                { mask: "GENETICS_MASK", position: "GENETICS_POSITION", value: 4294967295 }
            ];

            for (const testCase of testCases) {
                data = await statsLibTest.updateField(
                    data,
                    testCase.value,
                    await statsLibTest[testCase.mask](),
                    await statsLibTest[testCase.position]()
                );
                const extractedValue = await statsLibTest.extractField(
                    data,
                    await statsLibTest[testCase.mask](),
                    await statsLibTest[testCase.position]()
                );
                expect(extractedValue).to.equal(testCase.value);
            }
        });
    });
}); 