const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { parseEther } = ethers;

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
    const NAME = "IdleProcioneNFT";
    const SYMBOL = "IPNFT";
    const MAX_FAC_GEN = 100;
    const MAX_CLASS_GEN = 100;
    const VRF_COORDINATOR = "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D";
    const KEY_HASH = "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15";
    const SUBSCRIPTION_ID = 1;

    async function deployFixture() {
        const [_owner, _addr1, _addr2] = await ethers.getSigners();
        
        // Deploy mock contracts
        const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
        const _mockVRFCoordinator = await MockVRFCoordinator.deploy();

        const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
        const _mockLinkToken = await MockLinkToken.deploy();

        // Deploy IdleProcioneNFT with proxy
        const IdleProcioneNFTFactory = await ethers.getContractFactory("IdleProcioneNFT");
        const _idleProcioneNFT = await upgrades.deployProxy(IdleProcioneNFTFactory, [
            NAME,
            SYMBOL,
            MAX_FAC_GEN,
            MAX_CLASS_GEN,
            await _mockVRFCoordinator.getAddress(),
            ethers.keccak256(ethers.toUtf8Bytes("keyHash")),
            1 // subscriptionId
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        return { 
            idleProcioneNFT: _idleProcioneNFT, 
            owner: _owner, 
            addr1: _addr1, 
            addr2: _addr2, 
            mockVRFCoordinator: _mockVRFCoordinator, 
            mockLinkToken: _mockLinkToken 
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployFixture);
        
        // Deploy del mock Oracle
        const MockOracle = await ethers.getContractFactory("MockOracle");
        mockOracle = await MockOracle.deploy();

        // Assegna i valori alle variabili globali
        IdleProcioneNFT = fixture.idleProcioneNFT;
        idleProcioneNFT = fixture.idleProcioneNFT;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        addrs = [];
        vrfCoordinator = fixture.mockVRFCoordinator;
        mockVRFCoordinator = fixture.mockVRFCoordinator;
        mockLinkToken = fixture.mockLinkToken;
        mockOracle = mockOracle;
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
            await idleProcioneNFT.setPhaseStatus(1, true);

            const [isWhitelistedPhase1] = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(isWhitelistedPhase1).to.be.true;
        });

        it("Should add addresses to whitelist phase 2", async function () {
            const addresses = [addr1.address, addr2.address];
            await idleProcioneNFT.setWhitelistPhase2(addresses, true);
            await idleProcioneNFT.setPhaseStatus(2, true);

            const [, isWhitelistedPhase2] = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(isWhitelistedPhase2).to.be.true;
        });

        it("Should set phase status correctly", async function () {
            const addresses = [addr1.address];
            await idleProcioneNFT.setWhitelistPhase1(addresses, true);
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
            await idleProcioneNFT.setPrice(parseEther("0.1"));
        });

        it("Should allow whitelisted user to mint", async function () {
            await expect(idleProcioneNFT.connect(addr1).randomMint())
                .to.emit(idleProcioneNFT, "RandomMintRequested");

            // Simula la risposta del VRF
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
        });

        it("Should not allow non-whitelisted user to mint", async function () {
            await expect(idleProcioneNFT.connect(addr2).randomMint())
                .to.be.revertedWithCustomError(idleProcioneNFT, "NotWhitelisted");
        });

        it("Should not allow minting with insufficient payment in phase 2", async function () {
            // Setup phase 2
            await idleProcioneNFT.setWhitelistPhase2([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, false);
            await idleProcioneNFT.setPhaseStatus(2, true);
            
            await expect(idleProcioneNFT.connect(addr1).randomMint({
                value: parseEther("0.05")
            })).to.be.revertedWithCustomError(idleProcioneNFT, "InsufficientPayment");
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
                .to.be.revertedWithCustomError(idleProcioneNFT, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
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
            const initialBalance = await ethers.provider.getBalance(owner.address);
            
            // Invia ETH al contratto
            await addr1.sendTransaction({
                to: idleProcioneNFT.target,
                value: parseEther("1.0")
            });

            await idleProcioneNFT.withdraw();
            const finalBalance = await ethers.provider.getBalance(owner.address);
            
            expect(finalBalance).to.be.gt(initialBalance);
        });

        it("Should allow owner to rescue ERC20 tokens", async function () {
            const amount = parseEther("1000000");
            
            // Invia LINK al contratto
            await mockLinkToken.transfer(idleProcioneNFT.target, amount);
            const contractBalance = await mockLinkToken.balanceOf(idleProcioneNFT.target);
            expect(contractBalance).to.equal(amount);

            // Salva il saldo iniziale dell'owner
            const initialBalance = await mockLinkToken.balanceOf(owner.address);

            // Esegui il rescue
            const tx = await idleProcioneNFT.rescueERC20(mockLinkToken.target, amount);
            await tx.wait();

            // Verifica il saldo finale
            const finalBalance = await mockLinkToken.balanceOf(owner.address);
            expect(finalBalance - initialBalance).to.equal(amount);
        });
    });
}); 