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
    let ReentrancyAttacker;
    let mockBreedingContract;
    let statsLibTest;

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

        // Deploy StatsLibTest
        const StatsLibTest = await ethers.getContractFactory("StatsLibTest");
        const _statsLibTest = await StatsLibTest.deploy();

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
            mockLinkToken: _mockLinkToken,
            statsLibTest: _statsLibTest
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployFixture);
        
        // Deploy del mock Oracle
        const MockOracle = await ethers.getContractFactory("MockOracle");
        mockOracle = await MockOracle.deploy();

        // Deploy mock breeding contract
        const MockBreedingContract = await ethers.getContractFactory("MockBreedingContract");
        mockBreedingContract = await MockBreedingContract.deploy();

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
        mockBreedingContract = mockBreedingContract;
        statsLibTest = fixture.statsLibTest;

        ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
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

    describe("Minting", function () {
        it("Should allow whitelisted addresses to mint in phase 1", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            expect(await idleProcioneNFT.ownerOf(0)).to.equal(addr1.address);
        });

        it("Should not allow non-whitelisted addresses to mint in phase 1", async function () {
            await idleProcioneNFT.setPhaseStatus(1, true);
            await expect(idleProcioneNFT.connect(addr1).randomMint())
                .to.be.revertedWithCustomError(idleProcioneNFT, "NotWhitelisted");
        });

        it("Should not allow minting when random mint is paused", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.setRandomMintPaused(true);
            
            await expect(idleProcioneNFT.connect(addr1).randomMint())
                .to.be.revertedWithCustomError(idleProcioneNFT, "RandomMintPaused");
        });

        it("Should not allow minting beyond MINT_PER_WALLET limit", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Aumenta i limiti di generazione
            await idleProcioneNFT.setMaxGenLimits(10000, 10000);
            
            // Esegue 3 mint (il limite per wallet)
            for(let i = 0; i < 3; i++) {
                await idleProcioneNFT.connect(addr1).randomMint();
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            }
            
            // Il quarto mint dovrebbe fallire
            await expect(idleProcioneNFT.connect(addr1).randomMint())
                .to.be.revertedWithCustomError(idleProcioneNFT, "WalletLimitReached");
        });

        it("Should track random mint count correctly", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Aumenta i limiti di generazione
            await idleProcioneNFT.setMaxGenLimits(10000, 10000);
            
            // Esegue 3 mint (il limite per wallet)
            for(let i = 0; i < 3; i++) {
                await idleProcioneNFT.connect(addr1).randomMint();
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            }
            
            expect(await idleProcioneNFT.getRandomMintCount()).to.equal(3);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to set whitelist phase 1", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            const info = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(info[0]).to.be.true; // isWhitelistedPhase1
        });

        it("Should allow owner to set whitelist phase 2", async function () {
            await idleProcioneNFT.setWhitelistPhase2([addr1.address], true);
            const info = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(info[1]).to.be.true; // isWhitelistedPhase2
        });

        it("Should allow owner to set phase status", async function () {
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.setPhaseStatus(2, true);
        });

        it("Should allow owner to set price", async function () {
            const newPrice = parseEther("0.1");
            await idleProcioneNFT.setPrice(newPrice);
        });

        it("Should allow owner to set max generation limits", async function () {
            await idleProcioneNFT.setMaxGenLimits(200, 200);
            const [maxFacGen, maxClassGen] = await idleProcioneNFT.getMaxGenLimits();
            expect(maxFacGen).to.equal(200);
            expect(maxClassGen).to.equal(200);
        });

        it("Should allow owner to set whitelist batch", async function () {
            const addresses = [addr1.address, addr2.address];
            const phase1Status = [true, false];
            const phase2Status = [false, true];
            await idleProcioneNFT.setWhitelistBatch(addresses, phase1Status, phase2Status);
            
            const info1 = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(info1[0]).to.be.true; // isWhitelistedPhase1
            expect(info1[1]).to.be.false; // isWhitelistedPhase2
            
            const info2 = await idleProcioneNFT.getMintInfo(addr2.address);
            expect(info2[0]).to.be.false; // isWhitelistedPhase1
            expect(info2[1]).to.be.true; // isWhitelistedPhase2
        });

        it("Should allow owner to set random mint paused", async function () {
            await idleProcioneNFT.setRandomMintPaused(true);
            expect(await idleProcioneNFT.randomMintPaused()).to.be.true;
            
            await idleProcioneNFT.setRandomMintPaused(false);
            expect(await idleProcioneNFT.randomMintPaused()).to.be.false;
        });

        it("Should allow owner to withdraw", async function () {
            const amount = parseEther("1");
            await owner.sendTransaction({
                to: idleProcioneNFT.target,
                value: amount
            });
            
            const balanceBefore = await ethers.provider.getBalance(owner.address);
            await idleProcioneNFT.withdraw();
            const balanceAfter = await ethers.provider.getBalance(owner.address);
            
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("Should allow owner to rescue ERC20 tokens", async function () {
            const amount = parseEther("100");
            // Transfer tokens to the contract
            await mockLinkToken.transfer(idleProcioneNFT.target, amount);
            // Get initial balance
            const initialBalance = await mockLinkToken.balanceOf(owner.address);
            // Rescue tokens
            await idleProcioneNFT.rescueERC20(mockLinkToken.target, amount);
            // Check final balance
            const finalBalance = await mockLinkToken.balanceOf(owner.address);
            expect(finalBalance - initialBalance).to.equal(amount);
        });
    });

    describe("View Functions", function () {
        it("Should return correct mint info", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            const info = await idleProcioneNFT.getMintInfo(addr1.address);
            expect(info[0]).to.be.true; // isWhitelistedPhase1
            expect(info[2]).to.equal(0); // mintedAmount
            expect(info[3]).to.equal(3); // remainingMints
        });

        it("Should return correct random mint count", async function () {
            expect(await idleProcioneNFT.getRandomMintCount()).to.equal(0);
        });

        it("Should return correct total supply", async function () {
            expect(await idleProcioneNFT.getTotalSupply()).to.equal(0);
        });

        it("Should return correct max generation limits", async function () {
            const [maxFacGen, maxClassGen] = await idleProcioneNFT.getMaxGenLimits();
            expect(maxFacGen).to.equal(MAX_FAC_GEN);
            expect(maxClassGen).to.equal(MAX_CLASS_GEN);
        });
    });

    describe("Security", function () {
        it("Should prevent reentrancy attacks", async function () {
            const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
            const attacker = await ReentrancyAttacker.deploy(idleProcioneNFT.target);
            
            await idleProcioneNFT.setWhitelistPhase1([attacker.target], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            await expect(attacker.attack(0, 123))
                .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
        });

        it("Should prevent unauthorized access to admin functions", async function () {
            await expect(idleProcioneNFT.connect(addr1).setWhitelistPhase1([addr2.address], true))
                .to.be.revertedWithCustomError(idleProcioneNFT, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });

        it("Should prevent unauthorized updates to procione data", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            await expect(idleProcioneNFT.connect(addr1).updateProcioneData(0, 123))
                .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
        });
    });

    describe("Current Health Management", function() {
        let tokenId;
        let authorizedContract;

        beforeEach(async function() {
            // Deploy un contratto mock autorizzato
            const MockAuthorizedContract = await ethers.getContractFactory("MockBreedingContract");
            authorizedContract = await MockAuthorizedContract.deploy();
            await authorizedContract.waitForDeployment();

            // Mint un NFT per i test
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            tokenId = 0;
        });

        it("Should allow owner to authorize health modifiers", async function() {
            const contractAddress = await authorizedContract.getAddress();
            await idleProcioneNFT.setHealthModifierAuthorization(contractAddress, true);
            expect(await idleProcioneNFT.authorizedHealthModifiers(contractAddress)).to.be.true;
        });

        it("Should prevent unauthorized contracts from modifying health", async function() {
            await expect(idleProcioneNFT.connect(addr1).modifyCurrentHealth(tokenId, 10, true))
                .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
        });

        it("Should prevent modifying health for non-existent tokens", async function() {
            const contractAddress = await authorizedContract.getAddress();
            await idleProcioneNFT.setHealthModifierAuthorization(contractAddress, true);
            await expect(authorizedContract.modifyHealth(idleProcioneNFT.target, 999, 10, true))
                .to.be.revertedWithCustomError(idleProcioneNFT, "TokenNotExists");
        });

        it("Should correctly modify health within limits", async function() {
            const contractAddress = await authorizedContract.getAddress();
            await idleProcioneNFT.setHealthModifierAuthorization(contractAddress, true);
            
            // Get initial data and max health
            const initialData = await idleProcioneNFT.getProcioneData(tokenId);
            const initialHealth = await statsLibTest.getCurrentHealth(initialData);
            const maxHealth = await statsLibTest.extractField(
                initialData, 
                await statsLibTest.getHealthMask(), 
                await statsLibTest.getHealthPosition()
            );
            
            // Add health
            const healthToAdd = 10n;
            await authorizedContract.modifyHealth(idleProcioneNFT.target, tokenId, healthToAdd, true);
            let newData = await idleProcioneNFT.getProcioneData(tokenId);
            let newHealth = await statsLibTest.getCurrentHealth(newData);
            const expectedAddHealth = initialHealth + healthToAdd > maxHealth ? maxHealth : initialHealth + healthToAdd;
            expect(newHealth).to.equal(expectedAddHealth);
            
            // Subtract health
            const healthToSubtract = 5n;
            await authorizedContract.modifyHealth(idleProcioneNFT.target, tokenId, healthToSubtract, false);
            newData = await idleProcioneNFT.getProcioneData(tokenId);
            newHealth = await statsLibTest.getCurrentHealth(newData);
            const expectedHealth = expectedAddHealth > healthToSubtract ? 
                expectedAddHealth - healthToSubtract : 
                0n;
            expect(newHealth).to.equal(expectedHealth);
        });

        it("Should emit correct events when modifying health", async function() {
            const contractAddress = await authorizedContract.getAddress();
            await idleProcioneNFT.setHealthModifierAuthorization(contractAddress, true);
            
            const initialData = await idleProcioneNFT.getProcioneData(tokenId);
            const initialHealth = await statsLibTest.getCurrentHealth(initialData);
            const maxHealth = await statsLibTest.extractField(
                initialData, 
                await statsLibTest.getHealthMask(), 
                await statsLibTest.getHealthPosition()
            );
            
            const healthToAdd = 10n;
            const expectedHealth = initialHealth + healthToAdd > maxHealth ? 
                maxHealth : 
                initialHealth + healthToAdd;
            
            await expect(authorizedContract.modifyHealth(idleProcioneNFT.target, tokenId, healthToAdd, true))
                .to.emit(idleProcioneNFT, "CurrentHealthModified")
                .withArgs(tokenId, initialHealth, expectedHealth)
                .and.to.emit(idleProcioneNFT, "DataUpdated");
        });

        it("Should not exceed maximum health", async function() {
            const contractAddress = await authorizedContract.getAddress();
            await idleProcioneNFT.setHealthModifierAuthorization(contractAddress, true);
            
            const data = await idleProcioneNFT.getProcioneData(tokenId);
            const maxHealth = await statsLibTest.extractField(
                data, 
                await statsLibTest.getHealthMask(), 
                await statsLibTest.getHealthPosition()
            );
            
            // Try to add more than max health
            await authorizedContract.modifyHealth(idleProcioneNFT.target, tokenId, maxHealth + BigInt(100), true);
            
            const newData = await idleProcioneNFT.getProcioneData(tokenId);
            const newHealth = await statsLibTest.getCurrentHealth(newData);
            expect(newHealth).to.equal(maxHealth);
        });

        it("Should not go below zero health", async function() {
            const contractAddress = await authorizedContract.getAddress();
            await idleProcioneNFT.setHealthModifierAuthorization(contractAddress, true);
            
            // Try to subtract more than current health
            await authorizedContract.modifyHealth(idleProcioneNFT.target, tokenId, 1000, false);
            
            const newData = await idleProcioneNFT.getProcioneData(tokenId);
            const newHealth = await statsLibTest.getCurrentHealth(newData);
            expect(newHealth).to.equal(0);
        });
    });
}); 
 