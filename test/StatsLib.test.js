const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StatsLib", function () {
    let StatsLibTest;
    let statsLibTest;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy del contratto di test
        StatsLibTest = await ethers.getContractFactory("StatsLibTest");
        statsLibTest = await StatsLibTest.deploy();
        await statsLibTest.waitForDeployment();
    });

    describe("Masks e Positions", function () {
        it("Dovrebbe avere le maschere corrette", async function () {
            expect(await statsLibTest.MASK_LEVEL()).to.equal(0xFFn);
            expect(await statsLibTest.MASK_XP()).to.equal(0xFFFFn << 8n);
            expect(await statsLibTest.MASK_BREEDING_SLOTS()).to.equal(0xFFn << 24n);
            expect(await statsLibTest.MASK_BREEDING_COOLDOWN()).to.equal(0xFFFFFFFFn << 32n);
            expect(await statsLibTest.MASK_BREEDING_COUNT()).to.equal(0xFFFFn << 64n);
            expect(await statsLibTest.MASK_BREEDING_PARTNER()).to.equal(0xFFFFFFFFn << 80n);
            expect(await statsLibTest.MASK_BREEDING_TIMESTAMP()).to.equal(0xFFFFFFFFn << 112n);
            expect(await statsLibTest.MASK_FACTION()).to.equal(0xFFn << 144n);
            expect(await statsLibTest.MASK_CLASS()).to.equal(0xFFn << 152n);
            expect(await statsLibTest.MASK_RARITY()).to.equal(0xFFn << 160n);
            expect(await statsLibTest.MASK_GENERATION()).to.equal(0xFFn << 168n);
            expect(await statsLibTest.MASK_GENDER()).to.equal(0x1n << 176n);
        });

        it("Dovrebbe avere le posizioni corrette", async function () {
            expect(await statsLibTest.POS_LEVEL()).to.equal(0n);
            expect(await statsLibTest.POS_XP()).to.equal(8n);
            expect(await statsLibTest.POS_BREEDING_SLOTS()).to.equal(24n);
            expect(await statsLibTest.POS_BREEDING_COOLDOWN()).to.equal(32n);
            expect(await statsLibTest.POS_BREEDING_COUNT()).to.equal(64n);
            expect(await statsLibTest.POS_BREEDING_PARTNER()).to.equal(80n);
            expect(await statsLibTest.POS_BREEDING_TIMESTAMP()).to.equal(112n);
            expect(await statsLibTest.POS_FACTION()).to.equal(144n);
            expect(await statsLibTest.POS_CLASS()).to.equal(152n);
            expect(await statsLibTest.POS_RARITY()).to.equal(160n);
            expect(await statsLibTest.POS_GENERATION()).to.equal(168n);
            expect(await statsLibTest.POS_GENDER()).to.equal(176n);
        });

        it("Dovrebbe avere i limiti massimi corretti", async function () {
            expect(await statsLibTest.MAX_LEVEL()).to.equal(100n);
            expect(await statsLibTest.MAX_XP()).to.equal(65535n);
            expect(await statsLibTest.MAX_BREEDING_SLOTS()).to.equal(10n);
            expect(await statsLibTest.MAX_BREEDING_COUNT()).to.equal(10n);
            expect(await statsLibTest.MAX_FACTION()).to.equal(4n);
            expect(await statsLibTest.MAX_CLASS()).to.equal(4n);
            expect(await statsLibTest.MAX_RARITY()).to.equal(4n);
            expect(await statsLibTest.MAX_GENERATION()).to.equal(100n);
        });
    });

    describe("Manipolazione dei Campi", function () {
        it("Dovrebbe impostare e estrarre correttamente i campi", async function () {
            let data = 0n;

            // Test per ogni campo
            data = await statsLibTest.setLevel(data, 50n);
            expect(await statsLibTest.getLevel(data)).to.equal(50n);

            data = await statsLibTest.setXP(data, 1000n);
            expect(await statsLibTest.getXP(data)).to.equal(1000n);

            data = await statsLibTest.setBreedingSlots(data, 5n);
            expect(await statsLibTest.getBreedingSlots(data)).to.equal(5n);

            data = await statsLibTest.setBreedingCooldown(data, 1234567890n);
            expect(await statsLibTest.getBreedingCooldown(data)).to.equal(1234567890n);

            data = await statsLibTest.setBreedingCount(data, 3n);
            expect(await statsLibTest.getBreedingCount(data)).to.equal(3n);

            data = await statsLibTest.setBreedingPartner(data, 42n);
            expect(await statsLibTest.getBreedingPartner(data)).to.equal(42n);

            data = await statsLibTest.setBreedingTimestamp(data, 1234567890n);
            expect(await statsLibTest.getBreedingTimestamp(data)).to.equal(1234567890n);

            data = await statsLibTest.setFaction(data, 2n);
            expect(await statsLibTest.getFaction(data)).to.equal(2n);

            data = await statsLibTest.setClass(data, 3n);
            expect(await statsLibTest.getClass(data)).to.equal(3n);

            data = await statsLibTest.setRarity(data, 1n);
            expect(await statsLibTest.getRarity(data)).to.equal(1n);

            data = await statsLibTest.setGeneration(data, 1n);
            expect(await statsLibTest.getGeneration(data)).to.equal(1n);

            data = await statsLibTest.setGender(data, true);
            expect(await statsLibTest.getGender(data)).to.equal(true);
        });

        it("Dovrebbe mantenere gli altri campi inalterati", async function () {
            let data = 0n;

            // Imposta tutti i campi
            data = await statsLibTest.setLevel(data, 50n);
            data = await statsLibTest.setXP(data, 1000n);
            data = await statsLibTest.setBreedingSlots(data, 5n);
            data = await statsLibTest.setBreedingCooldown(data, 1234567890n);
            data = await statsLibTest.setBreedingCount(data, 3n);
            data = await statsLibTest.setBreedingPartner(data, 42n);
            data = await statsLibTest.setBreedingTimestamp(data, 1234567890n);
            data = await statsLibTest.setFaction(data, 2n);
            data = await statsLibTest.setClass(data, 3n);
            data = await statsLibTest.setRarity(data, 1n);
            data = await statsLibTest.setGeneration(data, 1n);
            data = await statsLibTest.setGender(data, true);

            // Modifica un campo e verifica che gli altri rimangano invariati
            data = await statsLibTest.setLevel(data, 60n);
            expect(await statsLibTest.getLevel(data)).to.equal(60n);
            expect(await statsLibTest.getXP(data)).to.equal(1000n);
            expect(await statsLibTest.getBreedingSlots(data)).to.equal(5n);
            expect(await statsLibTest.getBreedingCooldown(data)).to.equal(1234567890n);
            expect(await statsLibTest.getBreedingCount(data)).to.equal(3n);
            expect(await statsLibTest.getBreedingPartner(data)).to.equal(42n);
            expect(await statsLibTest.getBreedingTimestamp(data)).to.equal(1234567890n);
            expect(await statsLibTest.getFaction(data)).to.equal(2n);
            expect(await statsLibTest.getClass(data)).to.equal(3n);
            expect(await statsLibTest.getRarity(data)).to.equal(1n);
            expect(await statsLibTest.getGeneration(data)).to.equal(1n);
            expect(await statsLibTest.getGender(data)).to.equal(true);
        });
    });
}); 