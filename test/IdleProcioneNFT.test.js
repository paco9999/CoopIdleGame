const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { parseEther } = ethers;

describe("IdleProcioneNFT", function () {
    let IdleProcioneNFT;
    let idleProcioneNFT;
    let ProfessionsManager;
    let professionsManager;
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

        // Deploy ProfessionsManager with proxy
        const ProfessionsManagerFactory = await ethers.getContractFactory("ProfessionsManager");
        const _professionsManager = await upgrades.deployProxy(ProfessionsManagerFactory, [
            await _idleProcioneNFT.getAddress()
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Set ProfessionsManager in IdleProcioneNFT
        await _idleProcioneNFT.setProfessionsContract(await _professionsManager.getAddress());

        return { 
            idleProcioneNFT: _idleProcioneNFT,
            professionsManager: _professionsManager,
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

        // Deploy mock breeding contract
        const MockBreedingContract = await ethers.getContractFactory("MockBreedingContract");
        mockBreedingContract = await MockBreedingContract.deploy();

        // Assegna i valori alle variabili globali
        IdleProcioneNFT = fixture.idleProcioneNFT;
        idleProcioneNFT = fixture.idleProcioneNFT;
        ProfessionsManager = fixture.professionsManager;
        professionsManager = fixture.professionsManager;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        addrs = [];
        vrfCoordinator = fixture.mockVRFCoordinator;
        mockVRFCoordinator = fixture.mockVRFCoordinator;
        mockLinkToken = fixture.mockLinkToken;
        mockOracle = mockOracle;
        mockBreedingContract = mockBreedingContract;

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

    describe("Data Management", function () {
        describe("updateProcioneData", function () {
            it("Dovrebbe fallire se levelUpContract non è impostato", async function () {
                await expect(idleProcioneNFT.updateProcioneData(0, 123))
                    .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
            });

            it("Dovrebbe fallire se chiamato da un indirizzo non autorizzato", async function () {
                await idleProcioneNFT.setLevelUpContract(addr1.address);
                await expect(idleProcioneNFT.updateProcioneData(0, 123))
                    .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
            });

            it("Dovrebbe fallire per token non esistenti", async function () {
                await idleProcioneNFT.setLevelUpContract(addr1.address);
                await expect(idleProcioneNFT.connect(addr1).updateProcioneData(999, 123))
                    .to.be.revertedWithCustomError(idleProcioneNFT, "TokenNotExists");
            });

            it("Dovrebbe aggiornare i dati correttamente quando chiamato dal levelUpContract", async function () {
                await idleProcioneNFT.setLevelUpContract(addr1.address);
                
                // Mint di un token per il test
                await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
                await idleProcioneNFT.setPhaseStatus(1, true);
                await idleProcioneNFT.connect(addr2).randomMint();
                
                // Simula una risposta VRF per completare il mint
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const tokenId = 0;
                const newData = 123;
                
                await idleProcioneNFT.connect(addr1).updateProcioneData(tokenId, newData);
                expect(await idleProcioneNFT.getProcioneData(tokenId)).to.equal(newData);
            });

            it("Dovrebbe emettere l'evento corretto con i vecchi e nuovi valori del levelUpContract", async function () {
                const oldContract = addr1.address;
                const newContract = addr2.address;
                
                await idleProcioneNFT.setLevelUpContract(oldContract);
                await expect(idleProcioneNFT.setLevelUpContract(newContract))
                    .to.emit(idleProcioneNFT, "LevelUpContractUpdated")
                    .withArgs(oldContract, newContract);
            });

            it("Non dovrebbe permettere reentracy nell'aggiornamento dei dati", async function () {
                // Mint di un token per il test
                await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
                await idleProcioneNFT.setPhaseStatus(1, true);
                await idleProcioneNFT.connect(addr1).randomMint();
                
                // Simula una risposta VRF per completare il mint
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const attacker = await ReentrancyAttacker.deploy(idleProcioneNFT.target);
                
                // Non impostiamo il levelUpContract come attacker
                // Questo dovrebbe causare l'errore UnauthorizedCaller
                
                const tokenId = 0;
                const newData = 123;

                await expect(attacker.attack(tokenId, newData))
                    .to.be.revertedWithCustomError(idleProcioneNFT, "UnauthorizedCaller");
            });
        });
    });

    describe("Professioni", function () {
        let tokenId;
        
        beforeEach(async function () {
            // Setup iniziale per i test delle professioni
            await idleProcioneNFT.setWhitelistPhase1([addr1.address, addr2.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            // Simula risposta VRF per completare il mint
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;
            
            // Setup del contratto di breeding
            await idleProcioneNFT.setEggContract(mockBreedingContract.target);

            // Setup del levelUpContract per permettere l'aggiornamento dei dati
            await idleProcioneNFT.setLevelUpContract(owner.address);
        });

        describe("Assegnazione Professione", function () {
            it("Dovrebbe permettere di assegnare una professione quando tutti i requisiti sono soddisfatti", async function () {
                // Setup dei requisiti
                const data = await idleProcioneNFT.getProcioneData(tokenId);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId, newData);
                
                // Simula breeding count
                await mockBreedingContract.setBreedCount(tokenId, 2);
                
                await expect(professionsManager.connect(addr1).assignProfession(tokenId, 1))
                    .to.emit(professionsManager, "ProfessionAssigned")
                    .withArgs(tokenId, 1);

                const [profession,,] = await idleProcioneNFT.getProfessionInfo(tokenId);
                expect(profession).to.equal(1);
            });

            it("Non dovrebbe permettere di assegnare una professione se il limite è stato raggiunto", async function () {
                // Imposta un limite basso per test
                await professionsManager.setProfessionLimit(1, 1);
                
                // Setup per il primo procione
                const data = await idleProcioneNFT.getProcioneData(tokenId);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId, newData);
                await mockBreedingContract.setBreedCount(tokenId, 2);
                
                // Assegna la professione al primo procione
                await professionsManager.connect(addr1).assignProfession(tokenId, 1);
                
                // Mint e setup del secondo procione
                await idleProcioneNFT.connect(addr2).randomMint();
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const tokenId2 = 1;
                const data2 = await idleProcioneNFT.getProcioneData(tokenId2);
                let newData2 = await idleProcioneNFT.setLevel(data2, 5);
                await idleProcioneNFT.updateProcioneData(tokenId2, newData2);
                await mockBreedingContract.setBreedCount(tokenId2, 2);
                
                // Tenta di assegnare la stessa professione al secondo procione
                await expect(professionsManager.connect(addr2).assignProfession(tokenId2, 1))
                    .to.be.revertedWithCustomError(professionsManager, "ProfessionLimitReached");
            });
        });

        describe("Gestione Esperienza e Livelli", function () {
            beforeEach(async function () {
                // Setup dei requisiti per la professione
                const data = await idleProcioneNFT.getProcioneData(tokenId);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId, newData);
                
                // Simula breeding count
                await mockBreedingContract.setBreedCount(tokenId, 2);
                
                // Assegna la professione
                await professionsManager.connect(addr1).assignProfession(tokenId, 1);
            });

            it("Dovrebbe permettere di aggiungere esperienza", async function () {
                await professionsManager.connect(addr1).addProfessionExp(tokenId, 100);
                
                const [, , exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
                expect(exp).to.equal(100);
            });

            it("Dovrebbe limitare l'esperienza al massimo consentito", async function () {
                await professionsManager.connect(addr1).addProfessionExp(tokenId, 70000);
                
                const [, , exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
                expect(exp).to.equal(65535); // Massimo valore per 16 bit
            });

            it("Dovrebbe permettere il level up quando c'è abbastanza esperienza", async function () {
                // Aggiungi esperienza sufficiente per il level up
                await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
                
                await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                    .to.emit(professionsManager, "ProfessionLevelUp")
                    .withArgs(tokenId, 2);
                
                const [, level, exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
                expect(level).to.equal(2);
                expect(exp).to.equal(0); // L'exp dovrebbe essere resettata
            });

            it("Non dovrebbe permettere il level up con esperienza insufficiente", async function () {
                await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                    .to.be.revertedWithCustomError(professionsManager, "InsufficientExp");
            });
        });

        describe("Rimozione Professione", function () {
            beforeEach(async function () {
                // Setup dei requisiti per la professione
                const data = await idleProcioneNFT.getProcioneData(tokenId);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId, newData);
                await mockBreedingContract.setBreedCount(tokenId, 2);
                await professionsManager.connect(addr1).assignProfession(tokenId, 1);
            });

            it("Solo l'owner può rimuovere una professione", async function () {
                await expect(professionsManager.connect(addr1).removeProfession(tokenId))
                    .to.be.revertedWithCustomError(professionsManager, "OwnableUnauthorizedAccount")
                    .withArgs(addr1.address);
            });

            it("Dovrebbe rimuovere correttamente una professione", async function () {
                await professionsManager.removeProfession(tokenId);
                
                const [profession,,] = await idleProcioneNFT.getProfessionInfo(tokenId);
                expect(profession).to.equal(0); // NONE
                
                const members = await professionsManager.getProfessionMembers(1);
                expect(members.length).to.equal(0);
            });
        });

        describe("View Functions", function () {
            beforeEach(async function () {
                // Setup dei requisiti per la professione
                const data = await idleProcioneNFT.getProcioneData(tokenId);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId, newData);
                await mockBreedingContract.setBreedCount(tokenId, 2);
                await professionsManager.connect(addr1).assignProfession(tokenId, 1);
            });

            it("Dovrebbe restituire i membri di una professione ordinati per livello", async function () {
                // Mint e setup del secondo procione
                await idleProcioneNFT.connect(addr2).randomMint();
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const tokenId2 = 1;
                const data2 = await idleProcioneNFT.getProcioneData(tokenId2);
                let newData2 = await idleProcioneNFT.setLevel(data2, 5);
                await idleProcioneNFT.updateProcioneData(tokenId2, newData2);
                await mockBreedingContract.setBreedCount(tokenId2, 2);
                await professionsManager.connect(addr2).assignProfession(tokenId2, 1);
                
                // Level up del secondo procione
                await professionsManager.connect(addr2).addProfessionExp(tokenId2, 400);
                await professionsManager.connect(addr2).professionLevelUp(tokenId2);
                
                const members = await professionsManager.getProfessionMembers(1);
                expect(members.length).to.equal(2);
                expect(members[0]).to.equal(tokenId2); // Il procione con livello più alto dovrebbe essere primo
                expect(members[1]).to.equal(tokenId);
            });

            it("Dovrebbe restituire il limite corretto per una professione", async function () {
                const limit = await professionsManager.getProfessionLimit(1);
                expect(limit).to.equal(1000); // Limite di default
            });

            it("Dovrebbe restituire il numero corretto di membri per una professione", async function () {
                const count = await professionsManager.getProfessionMemberCount(1);
                expect(count).to.equal(1);
            });
        });
    });
}); 