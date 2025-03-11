const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdleProcioneEgg", function () {
    let IdleProcioneEgg;
    let idleProcioneEgg;
    let MockNFT;
    let mockNFT;
    let owner;
    let addr1;
    let addr2;
    let breedingContract;

    beforeEach(async function () {
        [owner, addr1, addr2, breedingContract] = await ethers.getSigners();

        // Deploy del mock NFT
        MockNFT = await ethers.getContractFactory("MockIdleProcioneNFT");
        mockNFT = await MockNFT.deploy();
        await mockNFT.deployed();

        // Deploy del contratto principale
        IdleProcioneEgg = await ethers.getContractFactory("IdleProcioneEgg");
        idleProcioneEgg = await IdleProcioneEgg.deploy(
            "Idle Procione Egg",
            "IPE",
            mockNFT.address,
            breedingContract.address
        );
        await idleProcioneEgg.deployed();
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneEgg.name()).to.equal("Idle Procione Egg");
            expect(await idleProcioneEgg.symbol()).to.equal("IPE");
            expect(await idleProcioneEgg.nftContract()).to.equal(mockNFT.address);
            expect(await idleProcioneEgg.breedingContract()).to.equal(breedingContract.address);
        });

        it("Dovrebbe fallire con parametri invalidi", async function () {
            await expect(IdleProcioneEgg.deploy(
                "Idle Procione Egg",
                "IPE",
                ethers.constants.AddressZero,
                breedingContract.address
            )).to.be.revertedWithCustomError(idleProcioneEgg, "InvalidAddress");

            await expect(IdleProcioneEgg.deploy(
                "Idle Procione Egg",
                "IPE",
                mockNFT.address,
                ethers.constants.AddressZero
            )).to.be.revertedWithCustomError(idleProcioneEgg, "InvalidAddress");
        });
    });

    describe("Mint", function () {
        const parentId1 = 1;
        const parentId2 = 2;
        const genetics = 123;
        const hatchTime = Math.floor(Date.now() / 1000) + 3600; // 1 ora da ora

        it("Dovrebbe permettere al contratto di breeding di mintare un uovo", async function () {
            await expect(idleProcioneEgg.connect(breedingContract).mint(
                addr1.address,
                parentId1,
                parentId2,
                genetics,
                hatchTime
            )).to.emit(idleProcioneEgg, "EggCreated")
                .withArgs(0, addr1.address, parentId1, parentId2, genetics, hatchTime);

            const eggData = await idleProcioneEgg.getEggData(0);
            expect(eggData.parentId1).to.equal(parentId1);
            expect(eggData.parentId2).to.equal(parentId2);
            expect(eggData.genetics).to.equal(genetics);
            expect(eggData.hatchTime).to.equal(hatchTime);
            expect(eggData.hatched).to.be.false;
        });

        it("Non dovrebbe permettere a un utente non autorizzato di mintare un uovo", async function () {
            await expect(idleProcioneEgg.connect(addr1).mint(
                addr1.address,
                parentId1,
                parentId2,
                genetics,
                hatchTime
            )).to.be.revertedWithCustomError(idleProcioneEgg, "UnauthorizedBreeder");
        });
    });

    describe("Hatch", function () {
        const parentId1 = 1;
        const parentId2 = 2;
        const genetics = 123;
        let hatchTime;
        let eggId;

        beforeEach(async function () {
            // Setup dei dati dei genitori nel mock NFT
            const parent1Data = await createInitialData(100, 1, 1);
            const parent2Data = await createInitialData(100, 2, 2);
            await mockNFT.updateProcioneData(parentId1, parent1Data);
            await mockNFT.updateProcioneData(parentId2, parent2Data);

            // Mint dell'uovo
            hatchTime = Math.floor(Date.now() / 1000) + 3600;
            await idleProcioneEgg.connect(breedingContract).mint(
                addr1.address,
                parentId1,
                parentId2,
                genetics,
                hatchTime
            );
            eggId = 0;
        });

        it("Non dovrebbe permettere la schiusa prima del tempo", async function () {
            await expect(idleProcioneEgg.connect(addr1).hatch(eggId))
                .to.be.revertedWithCustomError(idleProcioneEgg, "EggNotReadyToHatch");
        });

        it("Dovrebbe permettere la schiusa dopo il tempo di incubazione", async function () {
            // Avanza il tempo di 1 ora
            await time.increase(3600);

            await expect(idleProcioneEgg.connect(addr1).hatch(eggId))
                .to.emit(idleProcioneEgg, "EggHatched")
                .withArgs(eggId, expect.any(Number), addr1.address);

            const eggData = await idleProcioneEgg.getEggData(eggId);
            expect(eggData.hatched).to.be.true;
        });

        it("Non dovrebbe permettere la schiusa di un uovo già schiuso", async function () {
            await time.increase(3600);
            await idleProcioneEgg.connect(addr1).hatch(eggId);

            await expect(idleProcioneEgg.connect(addr1).hatch(eggId))
                .to.be.revertedWithCustomError(idleProcioneEgg, "EggAlreadyHatched");
        });

        it("Non dovrebbe permettere a un non proprietario di schiudere l'uovo", async function () {
            await time.increase(3600);
            await expect(idleProcioneEgg.connect(addr2).hatch(eggId))
                .to.be.revertedWithCustomError(idleProcioneEgg, "UnauthorizedBreeder");
        });

        it("Dovrebbe creare un nuovo procione con la genetica corretta", async function () {
            await time.increase(3600);
            await idleProcioneEgg.connect(addr1).hatch(eggId);

            const newProcioneId = 1; // Il mock NFT incrementa l'ID
            const newProcioneData = await mockNFT.getProcioneData(newProcioneId);
            const newGenetics = await extractField(newProcioneData, "GENETICS_MASK", "GENETICS_POSITION");
            expect(newGenetics).to.equal(genetics);
        });
    });

    describe("View Functions", function () {
        const parentId1 = 1;
        const parentId2 = 2;
        const genetics = 123;
        const hatchTime = Math.floor(Date.now() / 1000) + 3600;
        let eggId;

        beforeEach(async function () {
            await idleProcioneEgg.connect(breedingContract).mint(
                addr1.address,
                parentId1,
                parentId2,
                genetics,
                hatchTime
            );
            eggId = 0;
        });

        it("Dovrebbe restituire i dati corretti dell'uovo", async function () {
            const eggData = await idleProcioneEgg.getEggData(eggId);
            expect(eggData.parentId1).to.equal(parentId1);
            expect(eggData.parentId2).to.equal(parentId2);
            expect(eggData.genetics).to.equal(genetics);
            expect(eggData.hatchTime).to.equal(hatchTime);
            expect(eggData.hatched).to.be.false;
        });

        it("Dovrebbe indicare correttamente se un uovo può essere schiuso", async function () {
            expect(await idleProcioneEgg.canHatch(eggId)).to.be.false;
            await time.increase(3600);
            expect(await idleProcioneEgg.canHatch(eggId)).to.be.true;
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di mettere in pausa e riprendere il contratto", async function () {
            await idleProcioneEgg.pause();
            expect(await idleProcioneEgg.paused()).to.be.true;

            await idleProcioneEgg.unpause();
            expect(await idleProcioneEgg.paused()).to.be.false;
        });

        it("Non dovrebbe permettere il transfer di un uovo quando il contratto è in pausa", async function () {
            // Mint dell'uovo
            await idleProcioneEgg.connect(breedingContract).mint(
                addr1.address,
                1,
                2,
                123,
                Math.floor(Date.now() / 1000) + 3600
            );

            // Metti in pausa
            await idleProcioneEgg.pause();

            // Prova il transfer
            await expect(idleProcioneEgg.connect(addr1).transferFrom(
                addr1.address,
                addr2.address,
                0
            )).to.be.revertedWith("Pausable: paused");
        });
    });

    // Funzioni di utilità per i test
    async function createInitialData(xp, level = 1, faction = 1) {
        let data = 0;
        data = await updateField(data, xp, "XP_MASK", "XP_POSITION");
        data = await updateField(data, level, "LEVEL_MASK", "LEVEL_POSITION");
        data = await updateField(data, 100, "HEALTH_MASK", "HEALTH_POSITION");
        data = await updateField(data, 10, "STRENGTH_MASK", "STRENGTH_POSITION");
        data = await updateField(data, 10, "SPEED_MASK", "SPEED_POSITION");
        data = await updateField(data, 10, "INTELLIGENCE_MASK", "INTELLIGENCE_POSITION");
        data = await updateField(data, 10, "ACCURACY_MASK", "ACCURACY_POSITION");
        data = await updateField(data, 0, "BREEDING_MASK", "BREEDING_POSITION");
        data = await updateField(data, faction, "FACTION_MASK", "FACTION_POSITION");
        return data;
    }

    async function updateField(data, value, mask, position) {
        return await idleProcioneEgg.updateField(data, value, mask, position);
    }

    async function extractField(data, mask, position) {
        return await idleProcioneEgg.extractField(data, mask, position);
    }
}); 