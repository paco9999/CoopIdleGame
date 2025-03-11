const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GeneticsLib", function () {
    let GeneticsLibTest;
    let geneticsLibTest;
    let owner;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        // Deploy del contratto di test
        GeneticsLibTest = await ethers.getContractFactory("GeneticsLibTest");
        geneticsLibTest = await GeneticsLibTest.deploy();
        await geneticsLibTest.deployed();

        // Inizializza i limiti dei tratti
        await geneticsLibTest.initializeTraitLimits();
    });

    describe("Costanti e Maschere", function () {
        it("Dovrebbe avere le maschere corrette", async function () {
            expect(await geneticsLibTest.ALLELE_MASK()).to.equal((1n << 6n) - 1n);
            expect(await geneticsLibTest.TRAIT_ID_MASK()).to.equal((1n << 4n) - 1n);
            expect(await geneticsLibTest.TRAIT_TYPE_MASK()).to.equal((1n << 2n) - 1n);
        });

        it("Dovrebbe avere le posizioni corrette per gli alleli", async function () {
            expect(await geneticsLibTest.HEAD_MOTHER_POSITION()).to.equal(0);
            expect(await geneticsLibTest.HEAD_FATHER_POSITION()).to.equal(6);
            expect(await geneticsLibTest.FUR_MOTHER_POSITION()).to.equal(12);
            expect(await geneticsLibTest.FUR_FATHER_POSITION()).to.equal(18);
            expect(await geneticsLibTest.STAR_MOTHER_POSITION()).to.equal(24);
            expect(await geneticsLibTest.STAR_FATHER_POSITION()).to.equal(30);
            expect(await geneticsLibTest.WEAPON_MOTHER_POSITION()).to.equal(36);
            expect(await geneticsLibTest.WEAPON_FATHER_POSITION()).to.equal(42);
            expect(await geneticsLibTest.ACC_MOTHER_POSITION()).to.equal(48);
            expect(await geneticsLibTest.ACC_FATHER_POSITION()).to.equal(54);
        });

        it("Dovrebbe avere i limiti massimi corretti", async function () {
            expect(await geneticsLibTest.MAX_DOMINANT()).to.equal(4000);
            expect(await geneticsLibTest.MAX_RECESSIVE()).to.equal(1334);
            expect(await geneticsLibTest.MAX_MINOR_RECESSIVE()).to.equal(666);
        });
    });

    describe("Manipolazione dei Campi", function () {
        it("Dovrebbe impostare e estrarre correttamente i campi", async function () {
            const data = 0;
            const value = 42;
            const mask = await geneticsLibTest.TRAIT_ID_MASK();
            const position = await geneticsLibTest.HEAD_MOTHER_POSITION();

            const updatedData = await geneticsLibTest.setField(data, value, mask, position);
            const extractedValue = await geneticsLibTest.extractField(updatedData, mask, position);

            expect(extractedValue).to.equal(value);
        });

        it("Dovrebbe mantenere gli altri campi inalterati", async function () {
            let data = 0;
            const value1 = 42;
            const value2 = 24;
            const mask = await geneticsLibTest.TRAIT_ID_MASK();
            const position1 = await geneticsLibTest.HEAD_MOTHER_POSITION();
            const position2 = await geneticsLibTest.HEAD_FATHER_POSITION();

            data = await geneticsLibTest.setField(data, value1, mask, position1);
            data = await geneticsLibTest.setField(data, value2, mask, position2);

            const extracted1 = await geneticsLibTest.extractField(data, mask, position1);
            const extracted2 = await geneticsLibTest.extractField(data, mask, position2);

            expect(extracted1).to.equal(value1);
            expect(extracted2).to.equal(value2);
        });
    });

    describe("Generazione dei Tratti", function () {
        it("Dovrebbe generare tipi di tratti validi", async function () {
            const traitType = await geneticsLibTest.generateValidTraitType(123, 0);
            expect(traitType).to.be.lte(2);

            const count = await geneticsLibTest.getDominantCount();
            expect(count).to.equal(traitType === 0 ? 1 : 0);
        });

        it("Dovrebbe generare ID tratti validi", async function () {
            const traitId = await geneticsLibTest.generateValidTraitId(123, 0, 0);
            expect(traitId).to.be.lte(9);

            const count = await geneticsLibTest.getTraitCount(0, traitId);
            expect(count).to.equal(0);
        });

        it("Dovrebbe generare alleli validi", async function () {
            const allele = await geneticsLibTest.generateAllele(123, 0, 0);
            
            const traitType = allele >> 4;
            const traitId = allele & ((1 << 4) - 1);

            expect(traitType).to.be.lte(2);
            expect(traitId).to.be.lte(9);
        });

        it("Dovrebbe rispettare i limiti dei tratti", async function () {
            // Genera tratti fino al limite
            const partType = 0;
            const traitId = 0;
            const limit = await geneticsLibTest.getTraitLimit(partType, traitId);

            for (let i = 0; i < limit; i++) {
                try {
                    await geneticsLibTest.generateValidTraitId(i, 0, partType);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            // Il prossimo dovrebbe fallire
            await expect(
                geneticsLibTest.generateValidTraitId(limit + 1, 0, partType)
            ).to.be.revertedWith("Nessun ID tratto disponibile per questa parte");
        });

        it("Dovrebbe rispettare i limiti dei tipi di tratti", async function () {
            // Genera tratti dominanti fino al limite
            const maxDominant = await geneticsLibTest.MAX_DOMINANT();
            for (let i = 0; i < maxDominant; i++) {
                try {
                    await geneticsLibTest.generateValidTraitType(i, 0);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            // Il prossimo dovrebbe fallire
            await expect(
                geneticsLibTest.generateValidTraitType(maxDominant + 1, 0)
            ).to.be.revertedWith("Nessun tipo di carattere disponibile");
        });
    });

    describe("Limiti dei Tratti", function () {
        it("Dovrebbe inizializzare correttamente i limiti", async function () {
            // Verifica i limiti per i tratti comuni (0-3)
            for (let i = 0; i < 4; i++) {
                expect(await geneticsLibTest.getTraitLimit(0, i)).to.equal(700);
                expect(await geneticsLibTest.getTraitLimit(1, i)).to.equal(700);
                expect(await geneticsLibTest.getTraitLimit(2, i)).to.equal(700);
                expect(await geneticsLibTest.getTraitLimit(3, i)).to.equal(700);
                expect(await geneticsLibTest.getTraitLimit(4, i)).to.equal(700);
            }

            // Verifica i limiti per i tratti rari (4-6)
            for (let i = 4; i < 7; i++) {
                expect(await geneticsLibTest.getTraitLimit(0, i)).to.equal(600);
                expect(await geneticsLibTest.getTraitLimit(1, i)).to.equal(600);
                expect(await geneticsLibTest.getTraitLimit(2, i)).to.equal(600);
                expect(await geneticsLibTest.getTraitLimit(3, i)).to.equal(600);
                expect(await geneticsLibTest.getTraitLimit(4, i)).to.equal(600);
            }

            // Verifica i limiti per i tratti epici (7-8)
            for (let i = 7; i < 9; i++) {
                expect(await geneticsLibTest.getTraitLimit(0, i)).to.equal(500);
                expect(await geneticsLibTest.getTraitLimit(1, i)).to.equal(500);
                expect(await geneticsLibTest.getTraitLimit(2, i)).to.equal(500);
                expect(await geneticsLibTest.getTraitLimit(3, i)).to.equal(500);
                expect(await geneticsLibTest.getTraitLimit(4, i)).to.equal(500);
            }

            // Verifica i limiti per i tratti leggendari (9)
            expect(await geneticsLibTest.getTraitLimit(0, 9)).to.equal(400);
            expect(await geneticsLibTest.getTraitLimit(1, 9)).to.equal(400);
            expect(await geneticsLibTest.getTraitLimit(2, 9)).to.equal(400);
            expect(await geneticsLibTest.getTraitLimit(3, 9)).to.equal(400);
            expect(await geneticsLibTest.getTraitLimit(4, 9)).to.equal(400);
        });
    });
});