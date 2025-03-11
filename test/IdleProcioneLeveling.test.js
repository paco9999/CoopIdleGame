const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdleProcioneLeveling", function () {
    let IdleProcioneLeveling;
    let idleProcioneLeveling;
    let MockNFT;
    let mockNFT;
    let RewardToken;
    let rewardToken;
    let owner;
    let addr1;
    let addr2;
    let treasury;

    // Costanti per il test
    const BASE_FEE = ethers.parseEther("10");
    const INCREMENTO_FEE = ethers.parseEther("5");
    const MAX_LEVEL = 50;

    // Costanti per le maschere
    const XP_MASK = "0xFFFFFFFF";
    const LEVEL_MASK = "0xFF";
    const HEALTH_MASK = "0xFF";
    const STRENGTH_MASK = "0xFF";
    const SPEED_MASK = "0xFF";
    const INTELLIGENCE_MASK = "0xFF";
    const ACCURACY_MASK = "0xFF";
    const BREEDING_MASK = "0xFF";

    // Costanti per le posizioni
    const XP_POSITION = "0";
    const LEVEL_POSITION = "32";
    const HEALTH_POSITION = "40";
    const STRENGTH_POSITION = "48";
    const SPEED_POSITION = "56";
    const INTELLIGENCE_POSITION = "64";
    const ACCURACY_POSITION = "72";
    const BREEDING_POSITION = "80";

    beforeEach(async function () {
        [owner, addr1, addr2, treasury] = await ethers.getSigners();

        // Deploy del mock NFT
        MockNFT = await ethers.getContractFactory("MockIdleProcioneNFT");
        mockNFT = await MockNFT.deploy();
        await mockNFT.waitForDeployment();

        // Deploy del token di reward
        RewardToken = await ethers.getContractFactory("MockERC20");
        rewardToken = await RewardToken.deploy("Reward Token", "RWD");
        await rewardToken.waitForDeployment();

        // Deploy del contratto principale
        IdleProcioneLeveling = await ethers.getContractFactory("IdleProcioneLeveling");
        idleProcioneLeveling = await IdleProcioneLeveling.deploy(
            await mockNFT.getAddress(),
            await rewardToken.getAddress(),
            treasury.address,
            BASE_FEE,
            INCREMENTO_FEE,
            MAX_LEVEL
        );
        await idleProcioneLeveling.waitForDeployment();

        // Setup iniziale
        await rewardToken.mint(addr1.address, ethers.parseEther("1000"));
        await rewardToken.connect(addr1).approve(await idleProcioneLeveling.getAddress(), ethers.MaxUint256);

        // Mint di un NFT per addr1 e setup dei dati iniziali
        await mockNFT.mint(addr1.address, 1);
        const initialData = await createInitialData(30); // 30 XP
        await mockNFT.updateProcioneData(1, initialData);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneLeveling.nftContract()).to.equal(await mockNFT.getAddress());
            expect(await idleProcioneLeveling.rToken()).to.equal(await rewardToken.getAddress());
            expect(await idleProcioneLeveling.treasuryAddress()).to.equal(treasury.address);
            expect(await idleProcioneLeveling.baseFee()).to.equal(BASE_FEE);
            expect(await idleProcioneLeveling.incrementoFee()).to.equal(INCREMENTO_FEE);
            expect(await idleProcioneLeveling.maxLevel()).to.equal(MAX_LEVEL);
        });

        it("Dovrebbe fallire con parametri invalidi", async function () {
            await expect(IdleProcioneLeveling.deploy(
                ethers.ZeroAddress,
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                MAX_LEVEL
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidAddress");

            await expect(IdleProcioneLeveling.deploy(
                await mockNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                0
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");

            await expect(IdleProcioneLeveling.deploy(
                await mockNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                100
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");
        });
    });

    describe("Level Up", function () {
        it("Dovrebbe permettere il level up quando ci sono XP sufficienti", async function () {
            const tx = await idleProcioneLeveling.connect(addr1).levelUp(1);
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return idleProcioneLeveling.interface.parseLog(log).name === "LevelUp";
                } catch (e) {
                    return false;
                }
            });
            const parsedEvent = idleProcioneLeveling.interface.parseLog(event);
            expect(parsedEvent.args.tokenId).to.equal(1);
            expect(parsedEvent.args.newLevel).to.equal(2);
            expect(parsedEvent.args.remainingXP).to.equal(0);

            const data = await mockNFT.getProcioneData(1);
            const level = await extractField(data, LEVEL_MASK, LEVEL_POSITION);
            expect(level).to.equal(2);
        });

        it("Non dovrebbe permettere il level up senza XP sufficienti", async function () {
            const initialData = await createInitialData(10); // 10 XP
            await mockNFT.updateProcioneData(1, initialData);

            await expect(idleProcioneLeveling.connect(addr1).levelUp(1))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InsufficientXP");
        });

        it("Non dovrebbe permettere il level up oltre il livello massimo", async function () {
            const maxLevelData = await createInitialData(1000, MAX_LEVEL);
            await mockNFT.updateProcioneData(1, maxLevelData);

            await expect(idleProcioneLeveling.connect(addr1).levelUp(1))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "MaxLevelReached");
        });

        it("Dovrebbe incrementare correttamente le statistiche", async function () {
            await idleProcioneLeveling.connect(addr1).levelUp(1);
            
            const data = await mockNFT.getProcioneData(1);
            const strength = await extractField(data, STRENGTH_MASK, STRENGTH_POSITION);
            const speed = await extractField(data, SPEED_MASK, SPEED_POSITION);
            const intelligence = await extractField(data, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
            const accuracy = await extractField(data, ACCURACY_MASK, ACCURACY_POSITION);

            expect(strength).to.equal(12); // 10 + 2
            expect(speed).to.equal(12);
            expect(intelligence).to.equal(12);
            expect(accuracy).to.equal(12);
        });

        it("Dovrebbe sbloccare slot breeding ai livelli corretti", async function () {
            // Setup per livello 2 con XP per arrivare a livello 3
            const initialData = await createInitialData(270, 2); // 270 XP necessari per livello 3
            await mockNFT.updateProcioneData(1, initialData);

            await idleProcioneLeveling.connect(addr1).levelUp(1);
            
            const data = await mockNFT.getProcioneData(1);
            const breeding = await extractField(data, BREEDING_MASK, BREEDING_POSITION);
            expect(breeding).to.equal(1); // Primo slot sbloccato al livello 3
        });

        it("Dovrebbe addebitare correttamente le fee", async function () {
            const initialTreasuryBalance = await rewardToken.balanceOf(treasury.address);
            
            await idleProcioneLeveling.connect(addr1).levelUp(1);
            
            const finalTreasuryBalance = await rewardToken.balanceOf(treasury.address);
            expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(BASE_FEE + INCREMENTO_FEE * 2n);
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di aggiornare il treasury", async function () {
            await expect(idleProcioneLeveling.setTreasury(addr2.address))
                .to.emit(idleProcioneLeveling, "TreasuryUpdated")
                .withArgs(addr2.address);

            expect(await idleProcioneLeveling.treasuryAddress()).to.equal(addr2.address);
        });

        it("Dovrebbe permettere all'owner di aggiornare i parametri delle fee", async function () {
            const newBaseFee = ethers.parseEther("20");
            const newIncrementoFee = ethers.parseEther("10");

            await expect(idleProcioneLeveling.setFeeParameters(newBaseFee, newIncrementoFee))
                .to.emit(idleProcioneLeveling, "FeeParametersUpdated")
                .withArgs(newBaseFee, newIncrementoFee);

            expect(await idleProcioneLeveling.baseFee()).to.equal(newBaseFee);
            expect(await idleProcioneLeveling.incrementoFee()).to.equal(newIncrementoFee);
        });

        it("Dovrebbe permettere all'owner di aggiornare il livello massimo", async function () {
            const newMaxLevel = 40;

            await expect(idleProcioneLeveling.setMaxLevel(newMaxLevel))
                .to.emit(idleProcioneLeveling, "MaxLevelUpdated")
                .withArgs(newMaxLevel);

            expect(await idleProcioneLeveling.maxLevel()).to.equal(newMaxLevel);
        });

        it("Non dovrebbe permettere di impostare un livello massimo invalido", async function () {
            await expect(idleProcioneLeveling.setMaxLevel(0))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");

            await expect(idleProcioneLeveling.setMaxLevel(100))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");
        });

        it("Dovrebbe permettere all'owner di mettere in pausa e riprendere il contratto", async function () {
            await idleProcioneLeveling.pause();
            expect(await idleProcioneLeveling.paused()).to.be.true;

            await idleProcioneLeveling.unpause();
            expect(await idleProcioneLeveling.paused()).to.be.false;
        });

        it("Non dovrebbe permettere il level up quando il contratto è in pausa", async function () {
            await idleProcioneLeveling.pause();
            await expect(idleProcioneLeveling.connect(addr1).levelUp(1))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "EnforcedPause");
        });
    });

    describe("View Functions", function () {
        it("Dovrebbe calcolare correttamente l'XP necessario per ogni livello", async function () {
            expect(await idleProcioneLeveling.xpForLevel(1)).to.equal(30);
            expect(await idleProcioneLeveling.xpForLevel(2)).to.equal(120);
            expect(await idleProcioneLeveling.xpForLevel(3)).to.equal(270);
        });

        it("Dovrebbe calcolare correttamente la fee per ogni livello", async function () {
            expect(await idleProcioneLeveling.calculateFee(1)).to.equal(BASE_FEE + INCREMENTO_FEE * 2n);
            expect(await idleProcioneLeveling.calculateFee(2)).to.equal(BASE_FEE + INCREMENTO_FEE * 3n);
            expect(await idleProcioneLeveling.calculateFee(3)).to.equal(BASE_FEE + INCREMENTO_FEE * 4n);
        });
    });

    // Funzioni di utilità per i test
    async function createInitialData(xp, level = 1) {
        let data = 0n;
        data = await updateField(data, xp, XP_MASK, XP_POSITION);
        data = await updateField(data, level, LEVEL_MASK, LEVEL_POSITION);
        data = await updateField(data, 100, HEALTH_MASK, HEALTH_POSITION);
        data = await updateField(data, 10, STRENGTH_MASK, STRENGTH_POSITION);
        data = await updateField(data, 10, SPEED_MASK, SPEED_POSITION);
        data = await updateField(data, 10, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
        data = await updateField(data, 10, ACCURACY_MASK, ACCURACY_POSITION);
        data = await updateField(data, 0, BREEDING_MASK, BREEDING_POSITION);
        return data;
    }

    async function updateField(data, value, mask, position) {
        return await idleProcioneLeveling.updateField(data, value, mask, position);
    }

    async function extractField(data, mask, position) {
        return await idleProcioneLeveling.extractField(data, mask, position);
    }
}); 