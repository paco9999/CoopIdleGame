const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GeneticsLib", function () {
    let GeneticsLibTest;
    let geneticsLibTest;
    let owner;

    beforeEach(async function () {
        [owner] = await ethers.getSigners();

        // Deploy del contratto di test
        const GeneticsLibTestFactory = await ethers.getContractFactory("GeneticsLibTest");
        geneticsLibTest = await GeneticsLibTestFactory.deploy();
        await geneticsLibTest.waitForDeployment();

        // Inizializza i limiti dei tratti
        await geneticsLibTest.initializeTraitLimits();
    });

    describe("Costanti e Maschere", function () {
        it("Dovrebbe avere le maschere corrette", async function () {
            expect(await geneticsLibTest.ALLELE_MASK()).to.equal(BigInt((1 << 6) - 1));
            expect(await geneticsLibTest.TRAIT_ID_MASK()).to.equal(BigInt((1 << 4) - 1));
            expect(await geneticsLibTest.TRAIT_TYPE_MASK()).to.equal(BigInt((1 << 2) - 1));
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
            const data = BigInt(0);
            const value = BigInt(10);
            const mask = await geneticsLibTest.TRAIT_ID_MASK();
            const position = await geneticsLibTest.HEAD_MOTHER_POSITION();

            const updatedData = await geneticsLibTest.setField(data, value, mask, position);
            const extractedValue = await geneticsLibTest.extractField(updatedData, mask, position);

            expect(extractedValue).to.equal(value);
        });

        it("Dovrebbe mantenere gli altri campi inalterati", async function () {
            let data = BigInt(0);
            const value1 = BigInt(10);
            const value2 = BigInt(10);
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
            const tx = await geneticsLibTest.generateValidTraitType(123, 0);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return geneticsLibTest.interface.parseLog(log).name === "TraitTypeGenerated";
                } catch (e) {
                    return false;
                }
            });
            const parsedEvent = geneticsLibTest.interface.parseLog(event);
            const traitType = parsedEvent.args[0];
            expect(Number(traitType)).to.be.lessThanOrEqual(2);

            const count = await geneticsLibTest.getDominantCount();
            expect(Number(count)).to.equal(Number(traitType) === 0 ? 1 : 0);
        });

        it("Dovrebbe generare ID tratti validi", async function () {
            const tx = await geneticsLibTest.generateValidTraitId(123, 0, 0);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return geneticsLibTest.interface.parseLog(log).name === "TraitIdGenerated";
                } catch (e) {
                    return false;
                }
            });
            const parsedEvent = geneticsLibTest.interface.parseLog(event);
            const traitId = parsedEvent.args[0];
            expect(Number(traitId)).to.be.lessThanOrEqual(9);

            const count = await geneticsLibTest.getTraitCount(0, traitId);
            expect(Number(count)).to.equal(1);
        });

        it("Dovrebbe generare alleli validi", async function () {
            const tx = await geneticsLibTest.generateAllele(123, 0, 0);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return geneticsLibTest.interface.parseLog(log).name === "AlleleGenerated";
                } catch (e) {
                    return false;
                }
            });
            const parsedEvent = geneticsLibTest.interface.parseLog(event);
            const allele = parsedEvent.args[0];
            
            const traitType = Number((BigInt(allele) >> BigInt(4)) & BigInt((1 << 2) - 1));
            const traitId = Number(BigInt(allele) & BigInt((1 << 4) - 1));

            expect(traitType).to.be.lessThanOrEqual(2);
            expect(traitId).to.be.lessThanOrEqual(9);

            const count = await geneticsLibTest.getDominantCount();
            expect(Number(count)).to.equal(traitType === 0 ? 1 : 0);
        });

        it("Dovrebbe rispettare i limiti dei tratti", async function () {
            const partType = 0;
            const limit = await geneticsLibTest.getTraitLimit(partType, 0);
            const limitNumber = Number(limit);

            // Generiamo tratti fino al limite
            for (let i = 0; i < limitNumber * 10; i++) {
                try {
                    await geneticsLibTest.generateValidTraitId(i, 0, partType);
                } catch (e) {
                    // Se fallisce, continuiamo
                    continue;
                }
            }

            // Verifichiamo che il prossimo tentativo fallisca
            await expect(
                geneticsLibTest.generateValidTraitId(limitNumber * 10 + 1, 0, partType)
            ).to.be.revertedWith("Nessun ID tratto disponibile per questa parte");
        });

        it("Dovrebbe rispettare i limiti dei tipi di tratti", async function () {
            const maxDominant = await geneticsLibTest.MAX_DOMINANT();
            const maxDominantNumber = Number(maxDominant);

            for (let i = 0; i < maxDominantNumber; i++) {
                try {
                    await geneticsLibTest.generateValidTraitType(i, 0);
                } catch (e) {
                    // Ignora gli errori di generazione
                }
            }

            await expect(
                geneticsLibTest.generateValidTraitType(maxDominantNumber + 1, 0)
            ).to.be.revertedWith("Nessun tipo di carattere disponibile");
        });
    });

    describe("Limiti dei Tratti", function () {
        it("Dovrebbe inizializzare correttamente i limiti", async function () {
            // Verifica i limiti per i tratti comuni (0-3)
            for (let i = 0; i < 4; i++) {
                expect(Number(await geneticsLibTest.getTraitLimit(0, i))).to.equal(700);
                expect(Number(await geneticsLibTest.getTraitLimit(1, i))).to.equal(700);
                expect(Number(await geneticsLibTest.getTraitLimit(2, i))).to.equal(700);
                expect(Number(await geneticsLibTest.getTraitLimit(3, i))).to.equal(700);
                expect(Number(await geneticsLibTest.getTraitLimit(4, i))).to.equal(700);
            }

            // Verifica i limiti per i tratti rari (4-6)
            for (let i = 4; i < 7; i++) {
                expect(Number(await geneticsLibTest.getTraitLimit(0, i))).to.equal(600);
                expect(Number(await geneticsLibTest.getTraitLimit(1, i))).to.equal(600);
                expect(Number(await geneticsLibTest.getTraitLimit(2, i))).to.equal(600);
                expect(Number(await geneticsLibTest.getTraitLimit(3, i))).to.equal(600);
                expect(Number(await geneticsLibTest.getTraitLimit(4, i))).to.equal(600);
            }

            // Verifica i limiti per i tratti epici (7-8)
            for (let i = 7; i < 9; i++) {
                expect(Number(await geneticsLibTest.getTraitLimit(0, i))).to.equal(500);
                expect(Number(await geneticsLibTest.getTraitLimit(1, i))).to.equal(500);
                expect(Number(await geneticsLibTest.getTraitLimit(2, i))).to.equal(500);
                expect(Number(await geneticsLibTest.getTraitLimit(3, i))).to.equal(500);
                expect(Number(await geneticsLibTest.getTraitLimit(4, i))).to.equal(500);
            }

            // Verifica i limiti per i tratti leggendari (9)
            expect(Number(await geneticsLibTest.getTraitLimit(0, 9))).to.equal(400);
            expect(Number(await geneticsLibTest.getTraitLimit(1, 9))).to.equal(400);
            expect(Number(await geneticsLibTest.getTraitLimit(2, 9))).to.equal(400);
            expect(Number(await geneticsLibTest.getTraitLimit(3, 9))).to.equal(400);
            expect(Number(await geneticsLibTest.getTraitLimit(4, 9))).to.equal(400);
        });
    });
});