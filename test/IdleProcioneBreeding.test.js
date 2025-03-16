const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Importazione dei contratti
// Nota: i percorsi sono relativi alla directory 'contracts'
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
    let RandomnessConsumer;
    let randomnessConsumer;
    let owner;
    let addr1;
    let addr2;
    let treasury;
    let addrs;
    let tokenId1;
    let tokenId2;

    // Costanti per il test
    const BASE_COST = ethers.parseEther("100");
    const GOV_BASE_COST = ethers.parseEther("10");
    const INCUBATION_TIME = 5 * 24 * 60 * 60; // 5 days in seconds

    async function createInitialData(breedingSlots) {
        // Creiamo dati iniziali con breeding slots e genetica
        const genetics = BigInt("0x123456789ABCDEF");
        const slots = BigInt(breedingSlots);
        return (slots << BigInt(80)) | genetics;
    }

    async function signRandomNumber(signer, randomNumber, timestamp) {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "uint256"],
            [randomNumber, timestamp]
        );
        const signature = await signer.signMessage(ethers.getBytes(message));
        return signature;
    }

    beforeEach(async function () {
        [owner, addr1, addr2, treasury, ...addrs] = await ethers.getSigners();

        // Deploy dei token mock
        const MockERC20 = await ethers.getContractFactory("contracts/test/mocks/MockERC20.sol:MockERC20");
        rewardToken = await MockERC20.deploy("Reward Token", "RWD");
        govToken = await MockERC20.deploy("Gov Token", "GOV");

        // Deploy del mock IdleProcioneNFT
        const MockIdleProcioneNFT = await ethers.getContractFactory("contracts/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        mockIdleProcioneNFT = await MockIdleProcioneNFT.deploy();

        MockIdleProcioneEgg = await ethers.getContractFactory("contracts/test/mocks/MockIdleProcioneEgg.sol:MockIdleProcioneEgg");
        mockIdleProcioneEgg = await MockIdleProcioneEgg.deploy();

        // Deploy di RandomnessConsumer
        RandomnessConsumer = await ethers.getContractFactory("RandomnessConsumer");
        randomnessConsumer = await RandomnessConsumer.deploy(owner.address);

        // Deploy del contratto principale
        IdleProcioneBreeding = await ethers.getContractFactory("IdleProcioneBreeding");
        idleProcioneBreeding = await IdleProcioneBreeding.deploy(
            await mockIdleProcioneNFT.getAddress(),
            await mockIdleProcioneEgg.getAddress(),
            await rewardToken.getAddress(),
            await govToken.getAddress(),
            treasury.address,
            await randomnessConsumer.getAddress(),
            BASE_COST,
            GOV_BASE_COST
        );

        // Setup iniziale
        await rewardToken.mint(addr1.address, ethers.parseEther("1000"));
        await govToken.mint(addr1.address, ethers.parseEther("1000"));
        await rewardToken.connect(addr1).approve(await idleProcioneBreeding.getAddress(), ethers.MaxUint256);
        await govToken.connect(addr1).approve(await idleProcioneBreeding.getAddress(), ethers.MaxUint256);

        // Mint di due NFT per addr1 e setup dei dati iniziali
        const tx1 = await mockIdleProcioneNFT.simpleMint(addr1.address);
        const receipt1 = await tx1.wait();
        tokenId1 = receipt1.logs[0].args[2];

        const tx2 = await mockIdleProcioneNFT.simpleMint(addr1.address);
        const receipt2 = await tx2.wait();
        tokenId2 = receipt2.logs[0].args[2];

        const initialData = await createInitialData(3); // 3 breeding slots
        await mockIdleProcioneNFT.updateProcioneData(tokenId1, initialData);
        await mockIdleProcioneNFT.updateProcioneData(tokenId2, initialData);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneBreeding.nftContract()).to.equal(await mockIdleProcioneNFT.getAddress());
            expect(await idleProcioneBreeding.eggContract()).to.equal(await mockIdleProcioneEgg.getAddress());
            expect(await idleProcioneBreeding.rewardToken()).to.equal(await rewardToken.getAddress());
            expect(await idleProcioneBreeding.govToken()).to.equal(await govToken.getAddress());
            expect(await idleProcioneBreeding.treasuryAddress()).to.equal(treasury.address);
            expect(await idleProcioneBreeding.randomnessConsumer()).to.equal(await randomnessConsumer.getAddress());
            expect(await idleProcioneBreeding.baseCost()).to.equal(BASE_COST);
            expect(await idleProcioneBreeding.govBaseCost()).to.equal(GOV_BASE_COST);
        });

        it("Dovrebbe fallire con indirizzi zero", async function () {
            await expect(
                IdleProcioneBreeding.deploy(
                    ethers.ZeroAddress,
                    await mockIdleProcioneEgg.getAddress(),
                    await rewardToken.getAddress(),
                    await govToken.getAddress(),
                    treasury.address,
                    await randomnessConsumer.getAddress(),
                    BASE_COST,
                    GOV_BASE_COST
                )
            ).to.be.revertedWithCustomError(idleProcioneBreeding, "InvalidAddress");
        });
    });

    describe("Breeding", function () {
        it("Dovrebbe permettere il breeding tra due Procioni", async function () {
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            const tx = await idleProcioneBreeding.connect(addr1).breed(
                tokenId1, 
                tokenId2,
                randomNumber,
                currentTime,
                signature
            );
            const receipt = await tx.wait();
            
            // Verifica l'evento
            const breedingEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === "BreedingInitiated"
            );
            expect(breedingEvent).to.not.be.undefined;
            expect(breedingEvent.args.parent1Id).to.equal(tokenId1);
            expect(breedingEvent.args.parent2Id).to.equal(tokenId2);
            
            // Verifica il trasferimento dei token
            const treasuryRewardBalance = await rewardToken.balanceOf(treasury.address);
            const treasuryGovBalance = await govToken.balanceOf(treasury.address);
            expect(treasuryRewardBalance).to.equal(BASE_COST);
            expect(treasuryGovBalance).to.equal(GOV_BASE_COST);
        });

        it("Non dovrebbe permettere il breeding con lo stesso Procione", async function () {
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            await expect(
                idleProcioneBreeding.connect(addr1).breed(
                    tokenId1, 
                    tokenId1,
                    randomNumber,
                    currentTime,
                    signature
                )
            ).to.be.revertedWithCustomError(idleProcioneBreeding, "SameParentNotAllowed");
        });

        it("Non dovrebbe permettere il breeding con Procioni non posseduti", async function () {
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            await expect(
                idleProcioneBreeding.connect(addr2).breed(
                    tokenId1, 
                    tokenId2,
                    randomNumber,
                    currentTime,
                    signature
                )
            ).to.be.revertedWithCustomError(idleProcioneBreeding, "UnauthorizedBreeder");
        });

        it("Non dovrebbe permettere il breeding senza breeding slots", async function () {
            // Impostiamo breeding slots a 0
            const noSlotsData = await createInitialData(0);
            await mockIdleProcioneNFT.updateProcioneData(tokenId1, noSlotsData);
            
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            await expect(
                idleProcioneBreeding.connect(addr1).breed(
                    tokenId1, 
                    tokenId2,
                    randomNumber,
                    currentTime,
                    signature
                )
            ).to.be.revertedWithCustomError(idleProcioneBreeding, "InsufficientBreedingSlots");
        });

        it("Non dovrebbe permettere il breeding con una firma invalida", async function () {
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(addr1, randomNumber, currentTime); // Firma con un signer non autorizzato

            await expect(
                idleProcioneBreeding.connect(addr1).breed(
                    tokenId1, 
                    tokenId2,
                    randomNumber,
                    currentTime,
                    signature
                )
            ).to.be.revertedWithCustomError(randomnessConsumer, "InvalidSignature");
        });

        it("Dovrebbe aggiornare correttamente i breeding slots dopo il breeding", async function () {
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            await idleProcioneBreeding.connect(addr1).breed(
                tokenId1, 
                tokenId2,
                randomNumber,
                currentTime,
                signature
            );
            
            const data1 = await mockIdleProcioneNFT.getProcioneData(tokenId1);
            const data2 = await mockIdleProcioneNFT.getProcioneData(tokenId2);
            
            // Estraiamo i breeding slots (posizione 80, maschera 0xFF)
            const slots1 = (data1 >> BigInt(80)) & BigInt(0xFF);
            const slots2 = (data2 >> BigInt(80)) & BigInt(0xFF);
            
            expect(slots1).to.equal(2n); // 3 - 1
            expect(slots2).to.equal(2n); // 3 - 1
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di aggiornare i costi", async function () {
            const newBaseCost = ethers.parseEther("200");
            const newGovBaseCost = ethers.parseEther("20");

            await expect(idleProcioneBreeding.setCosts(newBaseCost, newGovBaseCost))
                .to.emit(idleProcioneBreeding, "CostsUpdated")
                .withArgs(newBaseCost, newGovBaseCost);

            expect(await idleProcioneBreeding.baseCost()).to.equal(newBaseCost);
            expect(await idleProcioneBreeding.govBaseCost()).to.equal(newGovBaseCost);
        });

        it("Dovrebbe permettere all'owner di aggiornare il treasury", async function () {
            await expect(idleProcioneBreeding.setTreasury(addr2.address))
                .to.emit(idleProcioneBreeding, "TreasuryUpdated")
                .withArgs(addr2.address);

            expect(await idleProcioneBreeding.treasuryAddress()).to.equal(addr2.address);
        });

        it("Non dovrebbe permettere di impostare un treasury address zero", async function () {
            await expect(idleProcioneBreeding.setTreasury(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(idleProcioneBreeding, "InvalidAddress");
        });

        it("Dovrebbe permettere all'owner di aggiornare il RandomnessConsumer", async function () {
            const newRandomnessConsumer = await RandomnessConsumer.deploy(owner.address);
            
            await expect(idleProcioneBreeding.setRandomnessConsumer(await newRandomnessConsumer.getAddress()))
                .to.emit(idleProcioneBreeding, "RandomnessConsumerUpdated")
                .withArgs(await newRandomnessConsumer.getAddress());

            expect(await idleProcioneBreeding.randomnessConsumer()).to.equal(await newRandomnessConsumer.getAddress());
        });

        it("Non dovrebbe permettere di impostare un RandomnessConsumer address zero", async function () {
            await expect(idleProcioneBreeding.setRandomnessConsumer(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(idleProcioneBreeding, "InvalidAddress");
        });

        it("Dovrebbe permettere all'owner di mettere in pausa e riprendere il contratto", async function () {
            await idleProcioneBreeding.pause();
            expect(await idleProcioneBreeding.paused()).to.be.true;

            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            await expect(
                idleProcioneBreeding.connect(addr1).breed(
                    tokenId1, 
                    tokenId2,
                    randomNumber,
                    currentTime,
                    signature
                )
            ).to.be.reverted;

            await idleProcioneBreeding.unpause();
            expect(await idleProcioneBreeding.paused()).to.be.false;

            // Verifica che il breeding funzioni dopo l'unpause
            await expect(
                idleProcioneBreeding.connect(addr1).breed(
                    tokenId1, 
                    tokenId2,
                    randomNumber,
                    currentTime,
                    signature
                )
            ).to.not.be.reverted;
        });
    });

    describe("View Functions", function () {
        it("Dovrebbe tracciare correttamente il numero di breed", async function () {
            expect(await idleProcioneBreeding.getBreedCount(tokenId1)).to.equal(0);
            
            const currentTime = await time.latest();
            const randomNumber = ethers.toBigInt("0x" + "1".repeat(64));
            const signature = await signRandomNumber(owner, randomNumber, currentTime);

            await idleProcioneBreeding.connect(addr1).breed(
                tokenId1, 
                tokenId2,
                randomNumber,
                currentTime,
                signature
            );
            
            expect(await idleProcioneBreeding.getBreedCount(tokenId1)).to.equal(1);
            expect(await idleProcioneBreeding.getBreedCount(tokenId2)).to.equal(1);
        });
    });
}); 