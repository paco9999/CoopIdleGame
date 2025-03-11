const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdleProcioneBreeding", function () {
    let IdleProcioneBreeding;
    let idleProcioneBreeding;
    let MockIdleProcioneNFT;
    let mockIdleProcioneNFT;
    let MockIdleProcioneEgg;
    let mockIdleProcioneEgg;
    let RewardToken;
    let rewardToken;
    let GovToken;
    let govToken;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    // Costanti per il test
    const BASE_FEE = ethers.parseEther("0.1");
    const INCREMENTO_FEE = ethers.parseEther("0.05");
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
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy dei token mock
        RewardToken = await ethers.getContractFactory("MockERC20");
        rewardToken = await RewardToken.deploy("Reward Token", "RWD");
        await rewardToken.waitForDeployment();

        GovToken = await ethers.getContractFactory("MockERC20");
        govToken = await GovToken.deploy("Gov Token", "GOV");
        await govToken.waitForDeployment();

        // Deploy dei contratti mock
        MockIdleProcioneNFT = await ethers.getContractFactory("MockIdleProcioneNFT");
        mockIdleProcioneNFT = await MockIdleProcioneNFT.deploy();
        await mockIdleProcioneNFT.waitForDeployment();

        MockIdleProcioneEgg = await ethers.getContractFactory("MockIdleProcioneEgg");
        mockIdleProcioneEgg = await MockIdleProcioneEgg.deploy();
        await mockIdleProcioneEgg.waitForDeployment();

        // Deploy del contratto principale
        IdleProcioneBreeding = await ethers.getContractFactory("IdleProcioneBreeding");
        idleProcioneBreeding = await IdleProcioneBreeding.deploy(
            await mockIdleProcioneNFT.getAddress(),
            await mockIdleProcioneEgg.getAddress(),
            owner.address,
            BASE_FEE,
            INCREMENTO_FEE
        );
        await idleProcioneBreeding.waitForDeployment();

        // Setup iniziale
        await rewardToken.mint(addr1.address, ethers.parseEther("1000"));
        await govToken.mint(addr1.address, ethers.parseEther("1000"));
        await rewardToken.connect(addr1).approve(await idleProcioneBreeding.getAddress(), ethers.MaxUint256);
        await govToken.connect(addr1).approve(await idleProcioneBreeding.getAddress(), ethers.MaxUint256);

        // Setup dei mock
        await mockIdleProcioneNFT.setApprovalForAll(await idleProcioneBreeding.getAddress(), true);
        await mockIdleProcioneEgg.setBreedingContract(await idleProcioneBreeding.getAddress());

        // Mint di un NFT per addr1 e setup dei dati iniziali
        await mockIdleProcioneNFT.mint(addr1.address, 1);
        const initialData = await createInitialData(30); // 30 XP
        await mockIdleProcioneNFT.updateProcioneData(1, initialData);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneBreeding.nftContract()).to.equal(await mockIdleProcioneNFT.getAddress());
            expect(await idleProcioneBreeding.eggContract()).to.equal(await mockIdleProcioneEgg.getAddress());
            expect(await idleProcioneBreeding.treasury()).to.equal(owner.address);
            expect(await idleProcioneBreeding.baseFee()).to.equal(BASE_FEE);
            expect(await idleProcioneBreeding.incrementoFee()).to.equal(INCREMENTO_FEE);
        });

        it("Dovrebbe fallire con parametri invalidi", async function () {
            await expect(
                IdleProcioneBreeding.deploy(
                    ethers.ZeroAddress,
                    await mockIdleProcioneEgg.getAddress(),
                    owner.address,
                    BASE_FEE,
                    INCREMENTO_FEE
                )
            ).to.be.revertedWith("Indirizzo NFT non valido");

            await expect(
                IdleProcioneBreeding.deploy(
                    await mockIdleProcioneNFT.getAddress(),
                    ethers.ZeroAddress,
                    owner.address,
                    BASE_FEE,
                    INCREMENTO_FEE
                )
            ).to.be.revertedWith("Indirizzo Egg non valido");

            await expect(
                IdleProcioneBreeding.deploy(
                    await mockIdleProcioneNFT.getAddress(),
                    await mockIdleProcioneEgg.getAddress(),
                    ethers.ZeroAddress,
                    BASE_FEE,
                    INCREMENTO_FEE
                )
            ).to.be.revertedWith("Indirizzo Treasury non valido");
        });
    });

    describe("Breeding", function () {
        beforeEach(async function () {
            // Mint di due Procioni per il breeding
            await mockIdleProcioneNFT.mint(addr1.address);
            await mockIdleProcioneNFT.mint(addr1.address);
        });

        it("Dovrebbe permettere il breeding tra due Procioni", async function () {
            const fee = BASE_FEE;
            await idleProcioneBreeding.connect(addr1).breed(1, 2, { value: fee });

            expect(await mockIdleProcioneEgg.ownerOf(1)).to.equal(addr1.address);
        });

        it("Non dovrebbe permettere il breeding con fee insufficiente", async function () {
            const fee = BASE_FEE.sub(1);
            await expect(
                idleProcioneBreeding.connect(addr1).breed(1, 2, { value: fee })
            ).to.be.revertedWith("Fee insufficiente");
        });

        it("Non dovrebbe permettere il breeding con lo stesso Procione", async function () {
            await expect(
                idleProcioneBreeding.connect(addr1).breed(1, 1, { value: BASE_FEE })
            ).to.be.revertedWith("Non puoi accoppiare un Procione con se stesso");
        });

        it("Non dovrebbe permettere il breeding con Procioni non posseduti", async function () {
            await expect(
                idleProcioneBreeding.connect(addr2).breed(1, 2, { value: BASE_FEE })
            ).to.be.revertedWith("Non sei il proprietario di entrambi i Procioni");
        });

        it("Non dovrebbe permettere il breeding con Procioni in cooldown", async function () {
            await idleProcioneBreeding.connect(addr1).breed(1, 2, { value: BASE_FEE });
            await expect(
                idleProcioneBreeding.connect(addr1).breed(1, 2, { value: BASE_FEE })
            ).to.be.revertedWith("Procione in cooldown");
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di aggiornare il treasury", async function () {
            await idleProcioneBreeding.connect(owner).setTreasury(addr1.address);
            expect(await idleProcioneBreeding.treasury()).to.equal(addr1.address);
        });

        it("Dovrebbe permettere all'owner di aggiornare i costi", async function () {
            const newBaseFee = ethers.parseEther("20");
            const newIncrementoFee = ethers.parseEther("10");

            await expect(idleProcioneBreeding.setCosts(newBaseFee, newIncrementoFee))
                .to.emit(idleProcioneBreeding, "CostsUpdated")
                .withArgs(newBaseFee, newIncrementoFee);

            expect(await idleProcioneBreeding.baseFee()).to.equal(newBaseFee);
            expect(await idleProcioneBreeding.incrementoFee()).to.equal(newIncrementoFee);
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