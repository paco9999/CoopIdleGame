const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdleProcioneEgg", function () {
    let IdleProcioneEgg;
    let idleProcioneEgg;
    let MockIdleProcioneNFT;
    let mockIdleProcioneNFT;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let breedingContract;

    const HATCH_TIME = 7 * 24 * 60 * 60; // 7 giorni in secondi

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy del mock NFT
        MockIdleProcioneNFT = await ethers.getContractFactory("MockIdleProcioneNFT");
        mockIdleProcioneNFT = await MockIdleProcioneNFT.deploy();
        await mockIdleProcioneNFT.waitForDeployment();

        // Deploy del contratto principale
        IdleProcioneEgg = await ethers.getContractFactory("IdleProcioneEgg");
        idleProcioneEgg = await IdleProcioneEgg.deploy(
            await mockIdleProcioneNFT.getAddress(),
            HATCH_TIME
        );
        await idleProcioneEgg.waitForDeployment();

        // Setup dei ruoli
        const BREEDING_ROLE = await idleProcioneEgg.BREEDING_ROLE();
        await idleProcioneEgg.grantRole(BREEDING_ROLE, owner.address);

        // Deploy del contratto di breeding
        breedingContract = await ethers.getContractFactory("BreedingContract");
        await breedingContract.deploy(await mockIdleProcioneNFT.getAddress());
        await breedingContract.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneEgg.nftContract()).to.equal(await mockIdleProcioneNFT.getAddress());
            expect(await idleProcioneEgg.hatchTime()).to.equal(HATCH_TIME);
        });

        it("Dovrebbe fallire con parametri invalidi", async function () {
            await expect(
                IdleProcioneEgg.deploy(
                    ethers.ZeroAddress,
                    HATCH_TIME
                )
            ).to.be.revertedWith("Indirizzo NFT non valido");

            await expect(
                IdleProcioneEgg.deploy(
                    await mockIdleProcioneNFT.getAddress(),
                    0
                )
            ).to.be.revertedWith("Tempo di schiusa non valido");
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
            )).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5");
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
            await mockIdleProcioneNFT.updateProcioneData(parentId1, parent1Data);
            await mockIdleProcioneNFT.updateProcioneData(parentId2, parent2Data);

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
                .to.be.revertedWith("L'uovo non può ancora schiudersi");
        });

        it("Dovrebbe permettere la schiusa dopo il tempo necessario", async function () {
            // Avanza il tempo di 7 giorni
            await ethers.provider.send("evm_increaseTime", [HATCH_TIME]);
            await ethers.provider.send("evm_mine");

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
                .to.be.revertedWith("Non sei il proprietario dell'uovo");
        });

        it("Dovrebbe creare un nuovo procione con la genetica corretta", async function () {
            await time.increase(3600);
            await idleProcioneEgg.connect(addr1).hatch(eggId);

            const newProcioneId = 1; // Il mock NFT incrementa l'ID
            const newProcioneData = await mockIdleProcioneNFT.getProcioneData(newProcioneId);
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

            await ethers.provider.send("evm_increaseTime", [HATCH_TIME]);
            await ethers.provider.send("evm_mine");

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