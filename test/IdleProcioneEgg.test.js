const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Funzione helper per creare i dati iniziali del procione
async function createInitialData(genetics, class_, faction) {
    return BigInt(genetics) | (BigInt(class_) << 128n) | (BigInt(faction) << 192n);
}

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
    let mockStatsLib;

    const HATCH_TIME = 7 * 24 * 60 * 60; // 7 giorni in secondi
    const INCUBATION_TIME = 5 * 24 * 60 * 60; // 5 giorni in secondi, come nel contratto di breeding

    beforeEach(async function () {
        [owner, addr1, addr2, breedingContract, ...addrs] = await ethers.getSigners();

        // Deploy del mock StatsLib
        const MockStatsLib = await ethers.getContractFactory("MockStatsLib");
        mockStatsLib = await MockStatsLib.deploy();
        await mockStatsLib.waitForDeployment();

        // Deploy del mock NFT
        MockIdleProcioneNFT = await ethers.getContractFactory("contracts/test/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        mockIdleProcioneNFT = await MockIdleProcioneNFT.deploy();
        await mockIdleProcioneNFT.waitForDeployment();

        // Deploy del contratto uovo
        IdleProcioneEgg = await ethers.getContractFactory("IdleProcioneEgg");
        idleProcioneEgg = await IdleProcioneEgg.deploy(
            "Idle Procione Egg",
            "IPE",
            await mockIdleProcioneNFT.getAddress(),
            breedingContract.address
        );
        await idleProcioneEgg.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneEgg.name()).to.equal("Idle Procione Egg");
            expect(await idleProcioneEgg.symbol()).to.equal("IPE");
            expect(await idleProcioneEgg.nftContract()).to.equal(await mockIdleProcioneNFT.getAddress());
            expect(await idleProcioneEgg.breedingContract()).to.equal(breedingContract.address);
        });

        it("Dovrebbe fallire con parametri invalidi", async function () {
            const zeroAddress = "0x0000000000000000000000000000000000000000";
            await expect(
                IdleProcioneEgg.deploy(
                    "Test",
                    "TST",
                    zeroAddress,
                    breedingContract.address
                )
            ).to.be.revertedWithCustomError(idleProcioneEgg, "InvalidAddress");

            await expect(
                IdleProcioneEgg.deploy(
                    "Test",
                    "TST",
                    await mockIdleProcioneNFT.getAddress(),
                    zeroAddress
                )
            ).to.be.revertedWithCustomError(idleProcioneEgg, "InvalidAddress");
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
        let parent1Id;
        let parent2Id;
        const genetics = 123;
        let hatchTime;
        let eggId;

        beforeEach(async function () {
            // Mint dei token genitori
            const tx1 = await mockIdleProcioneNFT.simpleMint(addr1.address);
            const receipt1 = await tx1.wait();
            parent1Id = receipt1.logs[0].args[2]; // TokenId è il terzo argomento nell'evento Transfer

            const tx2 = await mockIdleProcioneNFT.simpleMint(addr1.address);
            const receipt2 = await tx2.wait();
            parent2Id = receipt2.logs[0].args[2]; // TokenId è il terzo argomento nell'evento Transfer

            // Setup dei dati dei genitori nel mock NFT
            const parent1Data = await createInitialData(100, 1, 1);
            const parent2Data = await createInitialData(100, 2, 2);
            await mockIdleProcioneNFT.updateProcioneData(parent1Id, parent1Data);
            await mockIdleProcioneNFT.updateProcioneData(parent2Id, parent2Data);

            // Mint dell'uovo
            hatchTime = Math.floor(Date.now() / 1000) + 3600;
            await idleProcioneEgg.connect(breedingContract).mint(
                addr1.address,
                parent1Id,
                parent2Id,
                genetics,
                hatchTime
            );
            eggId = 0;
        });

        it("Non dovrebbe permettere la schiusa prima del tempo", async function () {
            await expect(idleProcioneEgg.connect(addr1).hatch(eggId))
                .to.be.revertedWithCustomError(idleProcioneEgg, "EggNotReadyToHatch");
        });

        it("Dovrebbe permettere la schiusa dopo il tempo necessario", async function () {
            // Avanza il tempo di 5 giorni
            await time.increase(INCUBATION_TIME);

            const tx = await idleProcioneEgg.connect(addr1).hatch(eggId);
            const receipt = await tx.wait();
            
            // Verifica che l'uovo sia stato schiuso
            const eggData = await idleProcioneEgg.getEggData(eggId);
            expect(eggData.hatched).to.be.true;
        });

        it("Non dovrebbe permettere la schiusa di un uovo già schiuso", async function () {
            await time.increase(INCUBATION_TIME);
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
            await time.increase(INCUBATION_TIME);
            const tx = await idleProcioneEgg.connect(addr1).hatch(eggId);
            const receipt = await tx.wait();
            
            const hatchEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === "EggHatched"
            );
            const newProcioneId = hatchEvent.args.newProcioneId;
            
            const newProcioneData = await mockIdleProcioneNFT.getProcioneData(newProcioneId);
            const newGenetics = newProcioneData & ((1n << 64n) - 1n); // Estrai i primi 64 bit
            expect(newGenetics).to.equal(BigInt(genetics));
        });
    });

    describe("View Functions", function () {
        let eggId;
        let hatchTime;

        beforeEach(async function () {
            // Mint dei token genitori
            const tx1 = await mockIdleProcioneNFT.simpleMint(addr1.address);
            const receipt1 = await tx1.wait();
            const parent1Id = receipt1.logs[0].args[2];

            const tx2 = await mockIdleProcioneNFT.simpleMint(addr1.address);
            const receipt2 = await tx2.wait();
            const parent2Id = receipt2.logs[0].args[2];

            // Setup dei dati dei genitori nel mock NFT
            const parent1Data = await createInitialData(100, 1, 1);
            const parent2Data = await createInitialData(100, 2, 2);
            await mockIdleProcioneNFT.updateProcioneData(parent1Id, parent1Data);
            await mockIdleProcioneNFT.updateProcioneData(parent2Id, parent2Data);

            // Mint dell'uovo
            const currentBlock = await ethers.provider.getBlock('latest');
            const currentTime = currentBlock.timestamp;
            hatchTime = currentTime + INCUBATION_TIME;
            await idleProcioneEgg.connect(breedingContract).mint(
                addr1.address,
                parent1Id,
                parent2Id,
                123,
                hatchTime
            );
            eggId = 0;
        });

        it("Dovrebbe restituire i dati corretti dell'uovo", async function () {
            const eggData = await idleProcioneEgg.getEggData(eggId);
            expect(eggData.hatchTime).to.equal(hatchTime);
            expect(eggData.hatched).to.be.false;
        });

        it("Dovrebbe indicare correttamente se un uovo può essere schiuso", async function () {
            // Prima del tempo di schiusa
            const currentBlock = await ethers.provider.getBlock('latest');
            console.log('Current timestamp:', currentBlock.timestamp);
            console.log('Hatch time:', hatchTime);
            expect(await idleProcioneEgg.canHatch(eggId)).to.be.false;

            // Dopo il tempo di schiusa
            await time.increase(INCUBATION_TIME);
            const newBlock = await ethers.provider.getBlock('latest');
            console.log('New timestamp:', newBlock.timestamp);
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
            )).to.be.revertedWithCustomError(idleProcioneEgg, "EnforcedPause");
        });
    });

    // Funzioni di utilità per i test
    async function extractField(data, mask, position) {
        return await mockStatsLib.extractField(data, mask, position);
    }
}); 