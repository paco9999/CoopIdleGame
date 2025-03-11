const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdleProcioneBreeding", function () {
    let IdleProcioneBreeding;
    let idleProcioneBreeding;
    let MockNFT;
    let mockNFT;
    let MockEgg;
    let mockEgg;
    let RewardToken;
    let rewardToken;
    let GovToken;
    let govToken;
    let owner;
    let addr1;
    let addr2;
    let treasury;

    // Costanti per il test
    const BASE_COST = ethers.utils.parseEther("100");
    const GOV_BASE_COST = ethers.utils.parseEther("10");
    const INCUBATION_TIME = 5 * 24 * 60 * 60; // 5 giorni in secondi

    beforeEach(async function () {
        [owner, addr1, addr2, treasury] = await ethers.getSigners();

        // Deploy dei token mock
        RewardToken = await ethers.getContractFactory("MockERC20");
        rewardToken = await RewardToken.deploy("Reward Token", "RWD");
        await rewardToken.deployed();

        GovToken = await ethers.getContractFactory("MockERC20");
        govToken = await GovToken.deploy("Gov Token", "GOV");
        await govToken.deployed();

        // Deploy del mock NFT
        MockNFT = await ethers.getContractFactory("MockIdleProcioneNFT");
        mockNFT = await MockNFT.deploy();
        await mockNFT.deployed();

        // Deploy del mock Egg
        MockEgg = await ethers.getContractFactory("MockIdleProcioneEgg");
        mockEgg = await MockEgg.deploy();
        await mockEgg.deployed();

        // Deploy del contratto principale
        IdleProcioneBreeding = await ethers.getContractFactory("IdleProcioneBreeding");
        idleProcioneBreeding = await IdleProcioneBreeding.deploy(
            mockNFT.address,
            mockEgg.address,
            rewardToken.address,
            govToken.address,
            treasury.address,
            BASE_COST,
            GOV_BASE_COST
        );
        await idleProcioneBreeding.deployed();

        // Setup iniziale
        await rewardToken.mint(addr1.address, ethers.utils.parseEther("1000"));
        await govToken.mint(addr1.address, ethers.utils.parseEther("1000"));
        await rewardToken.connect(addr1).approve(idleProcioneBreeding.address, ethers.constants.MaxUint256);
        await govToken.connect(addr1).approve(idleProcioneBreeding.address, ethers.constants.MaxUint256);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneBreeding.nftContract()).to.equal(mockNFT.address);
            expect(await idleProcioneBreeding.eggContract()).to.equal(mockEgg.address);
            expect(await idleProcioneBreeding.rewardToken()).to.equal(rewardToken.address);
            expect(await idleProcioneBreeding.govToken()).to.equal(govToken.address);
            expect(await idleProcioneBreeding.treasuryAddress()).to.equal(treasury.address);
            expect(await idleProcioneBreeding.baseCost()).to.equal(BASE_COST);
            expect(await idleProcioneBreeding.govBaseCost()).to.equal(GOV_BASE_COST);
        });

        it("Dovrebbe fallire con indirizzi zero", async function () {
            await expect(IdleProcioneBreeding.deploy(
                ethers.constants.AddressZero,
                mockEgg.address,
                rewardToken.address,
                govToken.address,
                treasury.address,
                BASE_COST,
                GOV_BASE_COST
            )).to.be.revertedWithCustomError(idleProcioneBreeding, "InvalidAddress");
        });
    });

    describe("Breeding", function () {
        beforeEach(async function () {
            // Mint di due NFT per addr1
            await mockNFT.mint(addr1.address, 1);
            await mockNFT.mint(addr1.address, 2);
            
            // Setup dei breeding slots
            await mockNFT.setBreedingSlots(1, 3);
            await mockNFT.setBreedingSlots(2, 3);
        });

        it("Dovrebbe permettere il breeding tra due procioni validi", async function () {
            await expect(idleProcioneBreeding.connect(addr1).breed(1, 2))
                .to.emit(idleProcioneBreeding, "BreedingInitiated")
                .withArgs(1, 2, 0, expect.any(Number), expect.any(Number));

            // Verifica dei breeding slots aggiornati
            const parent1Data = await mockNFT.getProcioneData(1);
            const parent2Data = await mockNFT.getProcioneData(2);
            expect(StatsLib.extractField(parent1Data, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION)).to.equal(2);
            expect(StatsLib.extractField(parent2Data, StatsLib.BREEDING_MASK, StatsLib.BREEDING_POSITION)).to.equal(2);
        });

        it("Non dovrebbe permettere il breeding con lo stesso procione", async function () {
            await expect(idleProcioneBreeding.connect(addr1).breed(1, 1))
                .to.be.revertedWithCustomError(idleProcioneBreeding, "SameParentNotAllowed");
        });

        it("Non dovrebbe permettere il breeding senza breeding slots", async function () {
            await mockNFT.setBreedingSlots(1, 0);
            await expect(idleProcioneBreeding.connect(addr1).breed(1, 2))
                .to.be.revertedWithCustomError(idleProcioneBreeding, "InsufficientBreedingSlots");
        });

        it("Non dovrebbe permettere il breeding senza token sufficienti", async function () {
            await rewardToken.connect(addr1).transfer(owner.address, await rewardToken.balanceOf(addr1.address));
            await expect(idleProcioneBreeding.connect(addr1).breed(1, 2))
                .to.be.revertedWithCustomError(idleProcioneBreeding, "TransferFailed");
        });

        it("Dovrebbe incrementare correttamente il breed count", async function () {
            await idleProcioneBreeding.connect(addr1).breed(1, 2);
            expect(await idleProcioneBreeding.getBreedCount(1)).to.equal(1);
            expect(await idleProcioneBreeding.getBreedCount(2)).to.equal(1);
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di aggiornare i costi", async function () {
            const newBaseCost = ethers.utils.parseEther("200");
            const newGovBaseCost = ethers.utils.parseEther("20");

            await expect(idleProcioneBreeding.setCosts(newBaseCost, newGovBaseCost))
                .to.emit(idleProcioneBreeding, "CostsUpdated")
                .withArgs(newBaseCost, newGovBaseCost);

            expect(await idleProcioneBreeding.baseCost()).to.equal(newBaseCost);
            expect(await idleProcioneBreeding.govBaseCost()).to.equal(newGovBaseCost);
        });

        it("Non dovrebbe permettere a non-owner di aggiornare i costi", async function () {
            await expect(idleProcioneBreeding.connect(addr1).setCosts(0, 0))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Dovrebbe permettere all'owner di aggiornare il treasury", async function () {
            await expect(idleProcioneBreeding.setTreasury(addr2.address))
                .to.emit(idleProcioneBreeding, "TreasuryUpdated")
                .withArgs(addr2.address);

            expect(await idleProcioneBreeding.treasuryAddress()).to.equal(addr2.address);
        });

        it("Non dovrebbe permettere di impostare un treasury address zero", async function () {
            await expect(idleProcioneBreeding.setTreasury(ethers.constants.AddressZero))
                .to.be.revertedWithCustomError(idleProcioneBreeding, "InvalidAddress");
        });

        it("Dovrebbe permettere all'owner di mettere in pausa e riprendere il contratto", async function () {
            await idleProcioneBreeding.pause();
            expect(await idleProcioneBreeding.paused()).to.be.true;

            await idleProcioneBreeding.unpause();
            expect(await idleProcioneBreeding.paused()).to.be.false;
        });

        it("Non dovrebbe permettere il breeding quando il contratto è in pausa", async function () {
            await idleProcioneBreeding.pause();
            await expect(idleProcioneBreeding.connect(addr1).breed(1, 2))
                .to.be.revertedWith("Pausable: paused");
        });
    });
}); 