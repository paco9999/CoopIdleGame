const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdleProcioneNFT", function () {
    let IdleProcioneNFT;
    let idleProcioneNFT;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let vrfCoordinator;
    let mockVRFCoordinator;
    let mockLinkToken;
    let mockOracle;

    // Parametri per il deploy
    const NAME = "Idle Procione";
    const SYMBOL = "IP";
    const MAX_FAC_GEN = 1000;
    const MAX_CLASS_GEN = 1200;
    const VRF_COORDINATOR = "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D";
    const KEY_HASH = "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15";
    const SUBSCRIPTION_ID = 1;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy del mock VRF Coordinator
        const MockVRFCoordinatorV2 = await ethers.getContractFactory("MockVRFCoordinatorV2");
        mockVRFCoordinator = await MockVRFCoordinatorV2.deploy();
        await mockVRFCoordinator.deployed();

        // Deploy del mock LINK token
        const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
        mockLinkToken = await MockLinkToken.deploy();
        await mockLinkToken.deployed();

        // Deploy del mock Oracle
        const MockOracle = await ethers.getContractFactory("MockOracle");
        mockOracle = await MockOracle.deploy();
        await mockOracle.deployed();

        // Deploy del contratto principale
        IdleProcioneNFT = await ethers.getContractFactory("IdleProcioneNFT");
        idleProcioneNFT = await IdleProcioneNFT.deploy(
            mockVRFCoordinator.address,
            KEY_HASH,
            SUBSCRIPTION_ID
        );
        await idleProcioneNFT.deployed();

        // Inizializzazione del contratto
        await idleProcioneNFT.initialize(
            NAME,
            SYMBOL,
            MAX_FAC_GEN,
            MAX_CLASS_GEN
        );
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await idleProcioneNFT.owner()).to.equal(owner.address);
        });

        it("Should set the correct name and symbol", async function () {
            expect(await idleProcioneNFT.name()).to.equal(NAME);
            expect(await idleProcioneNFT.symbol()).to.equal(SYMBOL);
        });

        it("Should initialize with correct max generation limits", async function () {
            const [maxFacGen, maxClassGen] = await idleProcioneNFT.getMaxGenLimits();
            expect(maxFacGen).to.equal(MAX_FAC_GEN);
            expect(maxClassGen).to.equal(MAX_CLASS_GEN);
        });
    });

    describe("Whitelist Management", function () {
        it("Should add addresses to whitelist phase 1", async function () {
            const addresses = [addr1.address, addr2.address];
            await idleProcioneNFT.setWhitelistPhase1(addresses, true);

            const [isWhitelistedPhase1] = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(isWhitelistedPhase1).to.be.true;
        });

        it("Should add addresses to whitelist phase 2", async function () {
            const addresses = [addr1.address, addr2.address];
            await idleProcioneNFT.setWhitelistPhase2(addresses, true);

            const [, isWhitelistedPhase2] = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(isWhitelistedPhase2).to.be.true;
        });

        it("Should set phase status correctly", async function () {
            await idleProcioneNFT.setPhaseStatus(1, true);
            const [isWhitelistedPhase1] = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(isWhitelistedPhase1).to.be.true;
        });
    });

    describe("Minting", function () {
        beforeEach(async function () {
            // Setup whitelist
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.setPrice(ethers.utils.parseEther("0.1"));
        });

        it("Should allow whitelisted user to mint", async function () {
            await expect(idleProcioneNFT.connect(addr1).randomMint({
                value: ethers.utils.parseEther("0.1")
            })).to.emit(idleProcioneNFT, "RandomMintRequested");

            // Simula la risposta del VRF
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWords(requestId, [ethers.utils.randomBytes(32)]);
        });

        it("Should not allow non-whitelisted user to mint", async function () {
            await expect(idleProcioneNFT.connect(addr2).randomMint({
                value: ethers.utils.parseEther("0.1")
            })).to.be.revertedWith("Not whitelisted");
        });

        it("Should not allow minting with insufficient payment", async function () {
            await expect(idleProcioneNFT.connect(addr1).randomMint({
                value: ethers.utils.parseEther("0.05")
            })).to.be.revertedWith("Insufficient payment");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to pause and unpause", async function () {
            await idleProcioneNFT.pause();
            expect(await idleProcioneNFT.paused()).to.be.true;

            await idleProcioneNFT.unpause();
            expect(await idleProcioneNFT.paused()).to.be.false;
        });

        it("Should allow owner to set level up contract", async function () {
            await idleProcioneNFT.setLevelUpContract(addr1.address);
            expect(await idleProcioneNFT.levelUpContract()).to.equal(addr1.address);
        });

        it("Should allow owner to set egg contract", async function () {
            await idleProcioneNFT.setEggContract(addr1.address);
            expect(await idleProcioneNFT.eggContract()).to.equal(addr1.address);
        });

        it("Should not allow non-owner to call admin functions", async function () {
            await expect(idleProcioneNFT.connect(addr1).pause())
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });

    describe("View Functions", function () {
        it("Should return correct total supply", async function () {
            expect(await idleProcioneNFT.getTotalSupply()).to.equal(0);
        });

        it("Should return correct random mint count", async function () {
            expect(await idleProcioneNFT.getRandomMintCount()).to.equal(0);
        });

        it("Should return correct mint info", async function () {
            const [isWhitelistedPhase1, isWhitelistedPhase2, mintedAmount, remainingMints] = 
                await idleProcioneNFT.getMintInfo(addr1.address);
            
            expect(isWhitelistedPhase1).to.be.false;
            expect(isWhitelistedPhase2).to.be.false;
            expect(mintedAmount).to.equal(0);
            expect(remainingMints).to.equal(3); // MINT_PER_WALLET
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow owner to withdraw ETH", async function () {
            const initialBalance = await owner.getBalance();
            
            // Invia ETH al contratto
            await addr1.sendTransaction({
                to: idleProcioneNFT.address,
                value: ethers.utils.parseEther("1.0")
            });

            await idleProcioneNFT.withdraw();
            const finalBalance = await owner.getBalance();
            
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should allow owner to rescue ERC20 tokens", async function () {
            const initialBalance = await mockLinkToken.balanceOf(owner.address);
            
            // Invia LINK al contratto
            await mockLinkToken.transfer(idleProcioneNFT.address, ethers.utils.parseEther("1.0"));

            await idleProcioneNFT.rescueERC20(mockLinkToken.address, ethers.utils.parseEther("1.0"));
            const finalBalance = await mockLinkToken.balanceOf(owner.address);
            
            expect(finalBalance).to.be.gt(initialBalance);
        });
    });
}); 