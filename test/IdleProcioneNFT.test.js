const { expect } = require("chai");
const { ethers, upgrades, network } = require("hardhat");
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
    let randomnessConsumer;
    let mockOracle;
    let ReentrancyAttacker;
    let mockBreedingContract;
    let statsLibTest;
    let signer;

    // Parametri per il deploy
    const NAME = "IdleProcioneNFT";
    const SYMBOL = "IPNFT";
    const MAX_FAC_GEN = 100;
    const MAX_CLASS_GEN = 100;

    async function deployFixture() {
        const [_owner, _addr1, _addr2] = await ethers.getSigners();
        
        // Deploy RandomnessConsumer
        const RandomnessConsumer = await ethers.getContractFactory("RandomnessConsumer");
        signer = ethers.Wallet.createRandom();
        const _randomnessConsumer = await RandomnessConsumer.deploy(signer.address);

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
            await _randomnessConsumer.getAddress()
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        return { 
            idleProcioneNFT: _idleProcioneNFT,
            owner: _owner, 
            addr1: _addr1, 
            addr2: _addr2,
            randomnessConsumer: _randomnessConsumer,
            statsLibTest: _statsLibTest,
            signer: signer
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployFixture);
        
        // Deploy del mock Oracle
        const MockOracle = await ethers.getContractFactory("MockOracle");
        mockOracle = await MockOracle.deploy();

        // Deploy mock breeding contract
        const MockBreedingContract = await ethers.getContractFactory("MockBreedingContract");
        mockBreedingContract = await MockBreedingContract.deploy(await fixture.idleProcioneNFT.getAddress());

        // Assegna i valori alle variabili globali
        IdleProcioneNFT = fixture.idleProcioneNFT;
        idleProcioneNFT = fixture.idleProcioneNFT;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        addrs = [];
        randomnessConsumer = fixture.randomnessConsumer;
        mockOracle = mockOracle;
        mockBreedingContract = mockBreedingContract;
        statsLibTest = fixture.statsLibTest;
        signer = fixture.signer;

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
        // Funzione per generare una firma valida per il numero casuale
        async function createValidSignature(sender, timestamp, mintCount) {
            // Calcoliamo il requestId esattamente come nel contratto
            const requestId = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [sender, timestamp, mintCount]
            );
            
            // Il contratto RandomnessConsumer.consumeRandomness si aspetta una firma di (randomNumber, timestamp)
            // dove randomNumber è il requestId
            const message = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, timestamp]
            );
            
            // Firma il messaggio. Il metodo signMessage aggiunge automaticamente il prefisso EIP-191
            // che corrisponde a ciò che il contratto verifica con MessageHashUtils.toEthSignedMessageHash
            return signer.signMessage(ethers.getBytes(message));
        }

        it("Should allow whitelisted addresses to mint in phase 1", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Incrementa il tempo per evitare conflitti di timestamp
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await idleProcioneNFT.connect(addr1).randomMint(signature);
            
            expect(await idleProcioneNFT.ownerOf(0)).to.equal(addr1.address);
        });

        it("Should not allow non-whitelisted addresses to mint in phase 1", async function () {
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Incrementa il tempo per evitare conflitti di timestamp
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await expect(idleProcioneNFT.connect(addr1).randomMint(signature))
                .to.be.revertedWithCustomError(idleProcioneNFT, "NotWhitelisted");
        });

        it("Should not allow minting when random mint is paused", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.setRandomMintPaused(true);
            
            // Incrementa il tempo per evitare conflitti di timestamp
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await expect(idleProcioneNFT.connect(addr1).randomMint(signature))
                .to.be.revertedWithCustomError(idleProcioneNFT, "RandomMintPaused");
        });

        it("Should not allow minting beyond MINT_PER_WALLET limit", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Aumenta i limiti di generazione
            await idleProcioneNFT.setMaxGenLimits(10000, 10000);
            
            let currentTime = await time.latest();
            
            // Esegue 3 mint (il limite per wallet)
            for(let i = 0; i < 3; i++) {
                currentTime += 100;
                const timestamp = currentTime;
                const mintCount = await idleProcioneNFT.getRandomMintCount();
                const signature = await createValidSignature(addr1.address, timestamp, mintCount);
                
                await time.increaseTo(timestamp - 1);
                await idleProcioneNFT.connect(addr1).randomMint(signature);
            }
            
            // Il quarto mint dovrebbe fallire
            currentTime += 100;
            const timestamp = currentTime;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await expect(idleProcioneNFT.connect(addr1).randomMint(signature))
                .to.be.revertedWithCustomError(idleProcioneNFT, "WalletLimitReached");
        });

        it("Should track random mint count correctly", async function () {
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Aumenta i limiti di generazione
            await idleProcioneNFT.setMaxGenLimits(10000, 10000);
            
            let currentTime = await time.latest();
            
            // Esegue 3 mint (il limite per wallet)
            for(let i = 0; i < 3; i++) {
                currentTime += 100;
                const timestamp = currentTime;
                const mintCount = await idleProcioneNFT.getRandomMintCount();
                const signature = await createValidSignature(addr1.address, timestamp, mintCount);
                
                await time.increaseTo(timestamp - 1);
                await idleProcioneNFT.connect(addr1).randomMint(signature);
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
            const MockToken = await ethers.getContractFactory("contracts/test/mocks/MockERC20.sol:MockERC20");
            const mockToken = await MockToken.deploy("Mock Token", "MTK");
            
            // Mint tokens directly to the contract instead of transferring
            await mockToken.mint(idleProcioneNFT.target, parseEther("100"));
            
            // Get initial balance
            const initialBalance = await mockToken.balanceOf(owner.address);
            
            // Rescue tokens
            const amount = parseEther("100");
            await idleProcioneNFT.rescueERC20(mockToken.target, amount);
            
            // Check final balance
            const finalBalance = await mockToken.balanceOf(owner.address);
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
        // Funzione per generare una firma valida per il numero casuale
        async function createValidSignature(sender, timestamp, mintCount) {
            // Calcoliamo il requestId esattamente come nel contratto
            const requestId = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [sender, timestamp, mintCount]
            );
            
            // Il contratto RandomnessConsumer.consumeRandomness si aspetta una firma di (randomNumber, timestamp)
            // dove randomNumber è il requestId
            const message = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, timestamp]
            );
            
            // Firma il messaggio. Il metodo signMessage aggiunge automaticamente il prefisso EIP-191
            // che corrisponde a ciò che il contratto verifica con MessageHashUtils.toEthSignedMessageHash
            return signer.signMessage(ethers.getBytes(message));
        }

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
            
            // Incrementa il tempo per evitare conflitti di timestamp
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await idleProcioneNFT.connect(addr1).randomMint(signature);
            
            await expect(idleProcioneNFT.connect(addr1).updateProcioneData(0, 123))
                .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
        });
    });

    describe("Current Health Management", function() {
        let tokenId;
        let authorizedContract;

        // Funzione per generare una firma valida per il numero casuale
        async function createValidSignature(sender, timestamp, mintCount) {
            // Calcoliamo il requestId esattamente come nel contratto
            const requestId = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [sender, timestamp, mintCount]
            );
            
            // Il contratto RandomnessConsumer.consumeRandomness si aspetta una firma di (randomNumber, timestamp)
            // dove randomNumber è il requestId
            const message = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, timestamp]
            );
            
            // Firma il messaggio. Il metodo signMessage aggiunge automaticamente il prefisso EIP-191
            // che corrisponde a ciò che il contratto verifica con MessageHashUtils.toEthSignedMessageHash
            return signer.signMessage(ethers.getBytes(message));
        }

        beforeEach(async function() {
            // Deploy un contratto mock autorizzato
            const MockAuthorizedContract = await ethers.getContractFactory("MockBreedingContract");
            authorizedContract = await MockAuthorizedContract.deploy(await idleProcioneNFT.getAddress());
            await authorizedContract.waitForDeployment();

            // Mint un NFT per i test
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Incrementa il tempo per evitare conflitti di timestamp
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await idleProcioneNFT.connect(addr1).randomMint(signature);
            
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

    describe("Dungeon Management", function() {
        let tokenId;
        let mockDungeonManager;

        // Funzione per generare una firma valida per il numero casuale
        async function createValidSignature(sender, timestamp, mintCount) {
            // Calcoliamo il requestId esattamente come nel contratto
            const requestId = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [sender, timestamp, mintCount]
            );
            
            // Il contratto RandomnessConsumer.consumeRandomness si aspetta una firma di (randomNumber, timestamp)
            // dove randomNumber è il requestId
            const message = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, timestamp]
            );
            
            // Firma il messaggio. Il metodo signMessage aggiunge automaticamente il prefisso EIP-191
            // che corrisponde a ciò che il contratto verifica con MessageHashUtils.toEthSignedMessageHash
            return signer.signMessage(ethers.getBytes(message));
        }

        beforeEach(async function() {
            // Deploy un mock DungeonManager
            const MockDungeonManager = await ethers.getContractFactory("MockDungeonManager");
            mockDungeonManager = await MockDungeonManager.deploy();
            await mockDungeonManager.waitForDeployment();

            // Mint un NFT per i test
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Incrementa il tempo per evitare conflitti di timestamp
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const signature = await createValidSignature(addr1.address, timestamp, mintCount);
            
            await time.increaseTo(timestamp - 1);
            await idleProcioneNFT.connect(addr1).randomMint(signature);
            
            tokenId = 0;
        });

        it("Should allow owner to set DungeonManager", async function() {
            const dungeonManagerAddress = await mockDungeonManager.getAddress();
            await expect(idleProcioneNFT.setDungeonManager(dungeonManagerAddress))
                .to.emit(idleProcioneNFT, "DungeonManagerUpdated")
                .withArgs(ethers.ZeroAddress, dungeonManagerAddress)
                .and.to.emit(idleProcioneNFT, "HealthModifierAuthorized")
                .withArgs(dungeonManagerAddress, true);

            expect(await idleProcioneNFT.dungeonManager()).to.equal(dungeonManagerAddress);
            expect(await idleProcioneNFT.authorizedHealthModifiers(dungeonManagerAddress)).to.be.true;
        });

        it("Should revoke authorization from old DungeonManager when setting new one", async function() {
            // Set first DungeonManager
            const firstDungeonManager = await mockDungeonManager.getAddress();
            await idleProcioneNFT.setDungeonManager(firstDungeonManager);

            // Deploy and set second DungeonManager
            const MockDungeonManager2 = await ethers.getContractFactory("MockDungeonManager");
            const secondDungeonManager = await MockDungeonManager2.deploy();
            const secondAddress = await secondDungeonManager.getAddress();

            await expect(idleProcioneNFT.setDungeonManager(secondAddress))
                .to.emit(idleProcioneNFT, "DungeonManagerUpdated")
                .withArgs(firstDungeonManager, secondAddress)
                .and.to.emit(idleProcioneNFT, "HealthModifierAuthorized")
                .withArgs(firstDungeonManager, false)
                .and.to.emit(idleProcioneNFT, "HealthModifierAuthorized")
                .withArgs(secondAddress, true);

            expect(await idleProcioneNFT.authorizedHealthModifiers(firstDungeonManager)).to.be.false;
            expect(await idleProcioneNFT.authorizedHealthModifiers(secondAddress)).to.be.true;
        });

        it("Should prevent non-owner from setting DungeonManager", async function() {
            const dungeonManagerAddress = await mockDungeonManager.getAddress();
            await expect(idleProcioneNFT.connect(addr1).setDungeonManager(dungeonManagerAddress))
                .to.be.revertedWithCustomError(idleProcioneNFT, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });

        it("Should prevent setting zero address as DungeonManager", async function() {
            await expect(idleProcioneNFT.setDungeonManager(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(idleProcioneNFT, "InvalidAddress");
        });

        it("Should allow DungeonManager to set dungeon status", async function() {
            const dungeonManagerAddress = await mockDungeonManager.getAddress();
            await idleProcioneNFT.setDungeonManager(dungeonManagerAddress);

            // Impersoniamo il DungeonManager usando l'owner
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [dungeonManagerAddress],
            });
            const dungeonManagerSigner = await ethers.getSigner(dungeonManagerAddress);

            // Finanziamo il DungeonManager con ETH per il gas
            await owner.sendTransaction({
                to: dungeonManagerAddress,
                value: ethers.parseEther("10.0")
            });

            // Set status to true (in dungeon)
            await expect(idleProcioneNFT.connect(dungeonManagerSigner).setDungeonStatus(tokenId, true))
                .to.emit(idleProcioneNFT, "DungeonStatusChanged")
                .withArgs(tokenId, true)
                .and.to.emit(idleProcioneNFT, "DataUpdated");

            expect(await idleProcioneNFT.getDungeonStatus(tokenId)).to.be.true;

            // Set status back to false (not in dungeon)
            await expect(idleProcioneNFT.connect(dungeonManagerSigner).setDungeonStatus(tokenId, false))
                .to.emit(idleProcioneNFT, "DungeonStatusChanged")
                .withArgs(tokenId, false)
                .and.to.emit(idleProcioneNFT, "DataUpdated");

            expect(await idleProcioneNFT.getDungeonStatus(tokenId)).to.be.false;

            await network.provider.request({
                method: "hardhat_stopImpersonatingAccount",
                params: [dungeonManagerAddress],
            });
        });

        it("Should prevent unauthorized addresses from setting dungeon status", async function() {
            await expect(idleProcioneNFT.connect(addr1).setDungeonStatus(tokenId, true))
                .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedDungeonManager");
        });

        it("Should prevent setting dungeon status for non-existent tokens", async function() {
            const dungeonManagerAddress = await mockDungeonManager.getAddress();
            await idleProcioneNFT.setDungeonManager(dungeonManagerAddress);

            // Impersoniamo il DungeonManager usando l'owner
            await network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [dungeonManagerAddress],
            });
            const dungeonManagerSigner = await ethers.getSigner(dungeonManagerAddress);

            // Finanziamo il DungeonManager con ETH per il gas
            await owner.sendTransaction({
                to: dungeonManagerAddress,
                value: ethers.parseEther("10.0")
            });

            await expect(idleProcioneNFT.connect(dungeonManagerSigner).setDungeonStatus(999, true))
                .to.be.revertedWithCustomError(idleProcioneNFT, "TokenNotExists");

            await network.provider.request({
                method: "hardhat_stopImpersonatingAccount",
                params: [dungeonManagerAddress],
            });
        });

        it("Should allow DungeonManager to modify health", async function() {
            const dungeonManagerAddress = await mockDungeonManager.getAddress();
            await idleProcioneNFT.setDungeonManager(dungeonManagerAddress);

            // Get initial health
            const data = await idleProcioneNFT.getProcioneData(tokenId);
            const initialHealth = await statsLibTest.getCurrentHealth(data);

            // Modify health
            const healthToSubtract = 10n;
            await expect(mockDungeonManager.modifyHealth(idleProcioneNFT.target, tokenId, healthToSubtract, false))
                .to.emit(idleProcioneNFT, "CurrentHealthModified")
                .and.to.emit(idleProcioneNFT, "DataUpdated");

            const newData = await idleProcioneNFT.getProcioneData(tokenId);
            const newHealth = await statsLibTest.getCurrentHealth(newData);
            expect(newHealth).to.equal(initialHealth > healthToSubtract ? initialHealth - healthToSubtract : 0n);
        });
    });

    // Helper per creare firme valide per il test
    async function createValidSignature(address, timestamp, mintCount) {
        // Calcoliamo il requestId esattamente come nel contratto
        const requestId = ethers.solidityPackedKeccak256(
            ["address", "uint256", "uint256"],
            [address, timestamp, mintCount]
        );
        
        // Il contratto RandomnessConsumer.consumeRandomness si aspetta una firma di (randomNumber, timestamp)
        // dove randomNumber è il requestId
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "uint256"],
            [requestId, timestamp]
        );
        
        // Firma il messaggio. Il metodo signMessage aggiunge automaticamente il prefisso EIP-191
        // che corrisponde a ciò che il contratto verifica con MessageHashUtils.toEthSignedMessageHash
        return signer.signMessage(ethers.getBytes(message));
    }

    describe("Sistema Fenotipo", function() {
        let randomNumber;
        
        beforeEach(async function() {
            await loadFixture(deployFixture);
            
            // Imposta l'indirizzo eggContract
            await idleProcioneNFT.setEggContract(await mockBreedingContract.getAddress());
            
            // Imposta un randomness consumer mock
            randomNumber = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
            
            // Whitelist per i test
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            
            // Imposta altri parametri per i test del fenotipo
            await idleProcioneNFT.connect(owner).setBaseTokenURI("https://api.idle-procione.com/token/");
            
            // Imposta i nomi dei tratti per i test
            await idleProcioneNFT.connect(owner).setTraitName(0, 0, "Testa Normale");
            await idleProcioneNFT.connect(owner).setTraitName(0, 1, "Testa Rara");
            await idleProcioneNFT.connect(owner).setTraitName(1, 0, "Pelo Marrone");
            await idleProcioneNFT.connect(owner).setTraitName(1, 1, "Pelo Nero");
            await idleProcioneNFT.connect(owner).setTraitName(2, 0, "Stella Normale");
            await idleProcioneNFT.connect(owner).setTraitName(3, 0, "Arma Base");
            await idleProcioneNFT.connect(owner).setTraitName(4, 0, "Accessorio Standard");
            
            // Imposta URI base per le immagini
            await idleProcioneNFT.connect(owner).setImageBaseURI("HEAD", "https://api.idle-procione.com/images/head/");
            await idleProcioneNFT.connect(owner).setImageBaseURI("FUR", "https://api.idle-procione.com/images/fur/");
            await idleProcioneNFT.connect(owner).setImageBaseURI("STAR", "https://api.idle-procione.com/images/star/");
            await idleProcioneNFT.connect(owner).setImageBaseURI("WEAPON", "https://api.idle-procione.com/images/weapon/");
            await idleProcioneNFT.connect(owner).setImageBaseURI("ACCESSORY", "https://api.idle-procione.com/images/accessory/");
        });
        
        async function mintProcione() {
            // Imposta la fase e la whitelist
            await idleProcioneNFT.connect(owner).setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.connect(owner).setPhaseStatus(1, true);
            
            // Ottieni il timestamp corrente e incrementalo
            const currentTime = await time.latest();
            const timestamp = currentTime + 100;
            await time.setNextBlockTimestamp(timestamp);
            
            // Calcola il requestId come nel contratto
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const requestId = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [addr1.address, timestamp, mintCount]
            );
            
            // Genera un messaggio con il formato corretto per il contratto RandomnessConsumer
            const message = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, timestamp]
            );
            
            // Firma il messaggio
            const signature = await signer.signMessage(ethers.getBytes(message));
            
            // Mint di un procione per i test
            const tx = await idleProcioneNFT.connect(addr1).randomMint(signature);
            await tx.wait();
            
            // Ritorna l'ID del token generato
            return 0; // Primo token mintato
        }
        
        it("Dovrebbe generare un fenotipo durante il mint", async function() {
            const tokenId = await mintProcione();
            
            // Verifica che esista un fenotipo per il token
            const fenotipo = await idleProcioneNFT.getFenotipo(tokenId);
            
            // Verifica che il fenotipo sia un array di lunghezza 5
            expect(fenotipo.length).to.equal(5);
            
            // Verifica che ogni valore del fenotipo sia un numero valido (0-9)
            for (let i = 0; i < 5; i++) {
                expect(fenotipo[i]).to.be.gte(0);
                expect(fenotipo[i]).to.be.lte(9);
            }
        });
        
        it("Dovrebbe memorizzare correttamente i nomi dei tratti", async function() {
            const tokenId = await mintProcione();
            
            // Ottieni il fenotipo
            const fenotipo = await idleProcioneNFT.getFenotipo(tokenId);
            
            // Ottieni i nomi dei tratti
            const traitNames = await idleProcioneNFT.getTraitNames(tokenId);
            
            // Verifica che i nomi corrispondano ai valori impostati nel beforeEach
            if (fenotipo[0] === 0n) {
                expect(traitNames[0]).to.equal("Testa Normale");
            } else if (fenotipo[0] === 1n) {
                expect(traitNames[0]).to.equal("Testa Rara");
            }
            
            if (fenotipo[1] === 0n) {
                expect(traitNames[1]).to.equal("Pelo Marrone");
            } else if (fenotipo[1] === 1n) {
                expect(traitNames[1]).to.equal("Pelo Nero");
            }
        });
        
        it("Dovrebbe rilevare tratti recessivi nascosti di valore", async function() {
            // Mint di un procione
            const tokenId = await mintProcione();
            
            // In questo test non possiamo garantire che ci siano tratti recessivi nascosti
            // (dipende dal generatore casuale), quindi verifichiamo solo che la funzione
            // non lanci errori e restituisca un valore booleano
            const hasHiddenTraits = await idleProcioneNFT.hasHiddenRecessiveTraits(tokenId);
            expect(typeof hasHiddenTraits).to.equal('boolean');
        });
        
        it("Dovrebbe generare un fenotipo anche durante mint da uovo", async function() {
            // Crea un mock per gli eventi emessi
            const mockEggContract = await ethers.getContractFactory("MockBreedingContract");
            const eggContract = await mockEggContract.deploy(await idleProcioneNFT.getAddress());
            await eggContract.waitForDeployment();
            
            // Imposta l'indirizzo del contratto uovo
            await idleProcioneNFT.connect(owner).setEggContract(await eggContract.getAddress());
            
            // Simula la creazione di un NFT da un uovo
            const tx = await eggContract.testMintFromEgg(addr1.address);
            const receipt = await tx.wait();
            
            // L'evento ProcioneMinted viene emesso con tokenId = 0
            const tokenId = 0;
            
            // Verifica che esista un fenotipo per il token mintato da uovo
            const fenotipo = await idleProcioneNFT.getFenotipo(tokenId);
            
            // Verifica le stesse proprietà del test precedente
            expect(fenotipo.length).to.equal(5);
            
            for (let i = 0; i < 5; i++) {
                expect(fenotipo[i]).to.be.gte(0);
                expect(fenotipo[i]).to.be.lte(9);
            }
        });
        
        it("Dovrebbe rispettare le regole di dominanza nel fenotipo", async function() {
            // Questo test è più complicato perché dipende dal generatore casuale
            // e richiede di conoscere la genetica interna del token.
            // In un test reale, potremmo voler usare un NFT con genetica controllata.
            
            // Come semplificazione, verifichiamo solo che il fenotipo sia generato
            // e che ogni attributo abbia un valore valido
            const tokenId = await mintProcione();
            const fenotipo = await idleProcioneNFT.getFenotipo(tokenId);
            
            for (let i = 0; i < 5; i++) {
                expect(fenotipo[i]).to.be.gte(0);
                expect(fenotipo[i]).to.be.lte(9);
            }
        });
        
        it("Dovrebbe rifiutare le chiamate ai metodi del fenotipo per token inesistenti", async function() {
            const nonExistentTokenId = 9999;
            
            // getFenotipo
            await expect(
                idleProcioneNFT.getFenotipo(nonExistentTokenId)
            ).to.be.revertedWithCustomError(idleProcioneNFT, "TokenNotExists");
            
            // getTraitNames
            await expect(
                idleProcioneNFT.getTraitNames(nonExistentTokenId)
            ).to.be.revertedWithCustomError(idleProcioneNFT, "TokenNotExists");
            
            // hasHiddenRecessiveTraits
            await expect(
                idleProcioneNFT.hasHiddenRecessiveTraits(nonExistentTokenId)
            ).to.be.revertedWithCustomError(idleProcioneNFT, "TokenNotExists");
        });
        
        it("Dovrebbe consentire solo all'owner di impostare i nomi dei tratti", async function() {
            // Tentativo di impostare un nome da un account non owner
            await expect(
                idleProcioneNFT.connect(addr1).setTraitName(0, 2, "Testa Aliena")
            ).to.be.revertedWithCustomError(idleProcioneNFT, "OwnableUnauthorizedAccount");
            
            // L'owner può impostare un nome
            await idleProcioneNFT.connect(owner).setTraitName(0, 2, "Testa Aliena");
            
            // Verifica che il nome sia stato impostato correttamente
            // Purtroppo non possiamo verificarlo direttamente perché non abbiamo un getter
            // per un singolo nome, ma solo per tutti i nomi di un token
        });
        
        it("Dovrebbe emettere eventi corretti durante la creazione del fenotipo", async function() {
            // Imposta la fase e la whitelist
            await idleProcioneNFT.connect(owner).setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.connect(owner).setPhaseStatus(1, true);
            
            // Ottieni il timestamp corrente e incrementalo
            const currentTime = await time.latest();
            const timestamp = currentTime + 200;
            await time.setNextBlockTimestamp(timestamp);
            
            // Calcola il requestId come nel contratto
            const mintCount = await idleProcioneNFT.getRandomMintCount();
            const requestId = ethers.solidityPackedKeccak256(
                ["address", "uint256", "uint256"],
                [addr1.address, timestamp, mintCount]
            );
            
            // Genera un messaggio con il formato corretto per il contratto RandomnessConsumer
            const message = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, timestamp]
            );
            
            // Firma il messaggio
            const signature = await signer.signMessage(ethers.getBytes(message));
            
            // Il mint dovrebbe emettere l'evento FenotipoStabilito
            await expect(
                idleProcioneNFT.connect(addr1).randomMint(signature)
            ).to.emit(idleProcioneNFT, "FenotipoStabilito");
        });
    });
}); 
 