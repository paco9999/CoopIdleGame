const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProfessionsManager", function () {
    let IdleProcioneNFT;
    let idleProcioneNFT;
    let ProfessionsManager;
    let professionsManager;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let mockBreedingContract;
    let mockCraftingManager;
    let mockVRFCoordinator;

    async function deployFixture() {
        const [_owner, _addr1, _addr2] = await ethers.getSigners();

        // Deploy mock VRF coordinator
        const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
        const _mockVRFCoordinator = await MockVRFCoordinator.deploy();

        // Deploy IdleProcioneNFT
        const IdleProcioneNFTFactory = await ethers.getContractFactory("IdleProcioneNFT");
        const _idleProcioneNFT = await upgrades.deployProxy(IdleProcioneNFTFactory, [
            "IdleProcioneNFT",
            "IPNFT",
            100,
            100,
            await _mockVRFCoordinator.getAddress(),
            ethers.keccak256(ethers.toUtf8Bytes("keyHash")),
            1
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Deploy ProfessionsManager
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
            mockVRFCoordinator: _mockVRFCoordinator,
            owner: _owner,
            addr1: _addr1,
            addr2: _addr2
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployFixture);
        
        // Deploy mock breeding contract
        const MockBreedingContract = await ethers.getContractFactory("MockBreedingContract");
        mockBreedingContract = await MockBreedingContract.deploy();

        // Deploy mock crafting manager
        const MockCraftingManager = await ethers.getContractFactory("MockCraftingManager");
        mockCraftingManager = await MockCraftingManager.deploy();

        // Assegna i valori alle variabili globali
        IdleProcioneNFT = fixture.idleProcioneNFT;
        idleProcioneNFT = fixture.idleProcioneNFT;
        ProfessionsManager = fixture.professionsManager;
        professionsManager = fixture.professionsManager;
        mockVRFCoordinator = fixture.mockVRFCoordinator;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        addrs = [];

        // Setup del contratto di breeding
        await idleProcioneNFT.setEggContract(mockBreedingContract.target);
        await idleProcioneNFT.setLevelUpContract(owner.address);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente il contratto NFT", async function () {
            expect(await professionsManager.nftContract()).to.equal(idleProcioneNFT.target);
        });

        it("Dovrebbe impostare il limite di default per le professioni", async function () {
            expect(await professionsManager.getProfessionLimit(1)).to.equal(1000);
        });

        it("Dovrebbe impostare correttamente il professionBaseStep", async function () {
            expect(await professionsManager.professionBaseStep()).to.equal(100);
        });
    });

    describe("Gestione Professioni", function () {
        let tokenId;

        beforeEach(async function () {
            // Setup per il mint e i requisiti base
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            // Setup dei requisiti per la professione
            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
        });

        it("Dovrebbe permettere di assegnare una professione quando i requisiti sono soddisfatti", async function () {
            await expect(professionsManager.connect(addr1).assignProfession(tokenId, 1))
                .to.emit(professionsManager, "ProfessionAssigned")
                .withArgs(tokenId, 1);
        });

        it("Non dovrebbe permettere di assegnare una professione se il limite è stato raggiunto", async function () {
            await professionsManager.setProfessionLimit(1, 1);
            await professionsManager.connect(addr1).assignProfession(tokenId, 1);

            // Mint e setup del secondo procione
            await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
            await idleProcioneNFT.connect(addr2).randomMint();
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            const tokenId2 = 1;
            const data2 = await idleProcioneNFT.getProcioneData(tokenId2);
            let newData2 = await idleProcioneNFT.setLevel(data2, 5);
            await idleProcioneNFT.updateProcioneData(tokenId2, newData2);
            await mockBreedingContract.setBreedCount(tokenId2, 2);

            await expect(professionsManager.connect(addr2).assignProfession(tokenId2, 1))
                .to.be.revertedWithCustomError(professionsManager, "ProfessionLimitReached");
        });
    });

    describe("Gestione Esperienza e Livelli", function () {
        let tokenId;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
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

        it("Dovrebbe permettere il level up con esperienza sufficiente", async function () {
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
            
            await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                .to.emit(professionsManager, "ProfessionLevelUp")
                .withArgs(tokenId, 2);

            const [, level, exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
            expect(level).to.equal(2);
            expect(exp).to.equal(0);
        });

        it("Non dovrebbe permettere il level up con esperienza insufficiente", async function () {
            await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                .to.be.revertedWithCustomError(professionsManager, "InsufficientExp");
        });
    });

    describe("Funzionalità Artisan", function () {
        let tokenId;
        let craftingManagerSigner;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione Artisan
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
            await professionsManager.connect(addr1).assignProfession(tokenId, 1); // Artisan

            // Setup del CraftingManager
            const signers = await ethers.getSigners();
            craftingManagerSigner = signers[3]; // Usa un signer diverso da owner, addr1 e addr2
            await professionsManager.setCraftingManager(craftingManagerSigner.address);
        });

        it("Dovrebbe restituire il numero corretto di slot totali per livello", async function () {
            const slots = await professionsManager.getFreeCraftingSlots(tokenId);
            expect(slots).to.equal(1); // Livello 1: 1 slot
            
            // Level up to 2
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
            await professionsManager.connect(addr1).professionLevelUp(tokenId);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(2);
        });

        it("Dovrebbe permettere di bloccare slot di crafting", async function () {
            const duration = 3600; // 1 ora
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(0);
        });

        it("Dovrebbe sbloccare gli slot dopo la scadenza", async function () {
            const duration = 3600; // 1 ora
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            
            await time.increase(duration + 1);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(1);
        });

        it("Non dovrebbe permettere di bloccare slot se non ci sono slot liberi", async function () {
            const duration = 3600;
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            
            await expect(professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration))
                .to.be.revertedWithCustomError(professionsManager, "NoFreeCraftingSlots");
        });

        it("Solo il CraftingManager dovrebbe poter bloccare slot", async function () {
            const duration = 3600;
            await expect(professionsManager.connect(addr1).lockCraftingSlot(tokenId, duration))
                .to.be.revertedWithCustomError(professionsManager, "UnauthorizedCaller");
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di impostare il limite delle professioni", async function () {
            await professionsManager.setProfessionLimit(1, 500);
            expect(await professionsManager.getProfessionLimit(1)).to.equal(500);
        });

        it("Dovrebbe permettere all'owner di impostare il CraftingManager", async function () {
            await expect(professionsManager.setCraftingManager(mockCraftingManager.target))
                .to.emit(professionsManager, "CraftingManagerUpdated")
                .withArgs(ethers.ZeroAddress, mockCraftingManager.target);
        });

        it("Non dovrebbe permettere a non-owner di chiamare funzioni admin", async function () {
            await expect(professionsManager.connect(addr1).setProfessionLimit(1, 500))
                .to.be.revertedWithCustomError(professionsManager, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });

        it("Dovrebbe permettere all'owner di mettere in pausa il contratto", async function () {
            await professionsManager.pause();
            expect(await professionsManager.paused()).to.be.true;

            await professionsManager.unpause();
            expect(await professionsManager.paused()).to.be.false;
        });
    });
}); 