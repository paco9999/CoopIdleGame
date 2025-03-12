const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Importazione dei contratti
// Nota: i percorsi sono relativi alla directory 'contracts'
describe("IdleProcioneLeveling", function () {
    let IdleProcioneLeveling;
    let idleProcioneLeveling;
    let MockNFT;
    let mockNFT;
    let RewardToken;
    let rewardToken;
    let owner;
    let addr1;
    let addr2;
    let treasury;
    let tokenId;

    // Costanti per il test
    const BASE_FEE = ethers.parseEther("10");
    const INCREMENTO_FEE = ethers.parseEther("5");
    const MAX_LEVEL = 50;

    // Costanti per le maschere
    const XP_MASK = "0xFF";
    const LEVEL_MASK = "0xFF";
    const HEALTH_MASK = "0xFF";
    const STRENGTH_MASK = "0xFF";
    const SPEED_MASK = "0xFF";
    const INTELLIGENCE_MASK = "0xFF";
    const ACCURACY_MASK = "0xFF";
    const BREEDING_MASK = "0xFF";

    // Costanti per le posizioni
    const XP_POSITION = "0";
    const LEVEL_POSITION = "8";
    const HEALTH_POSITION = "16";
    const STRENGTH_POSITION = "24";
    const SPEED_POSITION = "32";
    const INTELLIGENCE_POSITION = "40";
    const ACCURACY_POSITION = "48";
    const BREEDING_POSITION = "80";

    beforeEach(async function () {
        [owner, addr1, addr2, treasury] = await ethers.getSigners();

        // Deploy del mock NFT
        MockNFT = await ethers.getContractFactory("contracts/test/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        mockNFT = await MockNFT.deploy();
        await mockNFT.waitForDeployment();

        // Deploy del token di reward
        RewardToken = await ethers.getContractFactory("contracts/test/mocks/MockERC20.sol:MockERC20");
        rewardToken = await RewardToken.deploy("Reward Token", "RWD");
        await rewardToken.waitForDeployment();

        // Deploy del contratto principale
        IdleProcioneLeveling = await ethers.getContractFactory("IdleProcioneLeveling");
        idleProcioneLeveling = await IdleProcioneLeveling.deploy(
            await mockNFT.getAddress(),
            await rewardToken.getAddress(),
            treasury.address,
            BASE_FEE,
            INCREMENTO_FEE,
            MAX_LEVEL
        );
        await idleProcioneLeveling.waitForDeployment();

        // Setup iniziale
        await rewardToken.mint(addr1.address, ethers.parseEther("1000"));
        await rewardToken.connect(addr1).approve(await idleProcioneLeveling.getAddress(), ethers.MaxUint256);

        // Mint di un NFT per addr1 e setup dei dati iniziali
        const tx = await mockNFT.simpleMint(addr1.address);
        const receipt = await tx.wait();
        tokenId = receipt.logs[0].args[2]; // TokenId è il terzo argomento dell'evento Transfer
        const initialData = await createInitialData(30); // 30 XP
        await mockNFT.updateProcioneData(tokenId, initialData);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneLeveling.nftContract()).to.equal(await mockNFT.getAddress());
            expect(await idleProcioneLeveling.rToken()).to.equal(await rewardToken.getAddress());
            expect(await idleProcioneLeveling.treasuryAddress()).to.equal(treasury.address);
            expect(await idleProcioneLeveling.baseFee()).to.equal(BASE_FEE);
            expect(await idleProcioneLeveling.incrementoFee()).to.equal(INCREMENTO_FEE);
            expect(await idleProcioneLeveling.maxLevel()).to.equal(MAX_LEVEL);
        });

        it("Dovrebbe fallire con parametri invalidi", async function () {
            await expect(IdleProcioneLeveling.deploy(
                ethers.ZeroAddress,
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                MAX_LEVEL
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidAddress");

            await expect(IdleProcioneLeveling.deploy(
                await mockNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                0
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");

            await expect(IdleProcioneLeveling.deploy(
                await mockNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                100
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");
        });
    });

    describe("Level Up", function () {
        it("Dovrebbe permettere il level up quando ci sono XP sufficienti", async function () {
            // Verifica stato iniziale
            const initialData = await mockNFT.getProcioneData(tokenId);
            const initialLevel = await extractField(initialData, LEVEL_MASK, LEVEL_POSITION);
            const initialXP = await extractField(initialData, XP_MASK, XP_POSITION);
            
            console.log("Stato Iniziale:", {
                level: initialLevel,
                xp: initialXP,
                requiredXP: await idleProcioneLeveling.xpForLevel(initialLevel)
            });

            // Verifica che ci siano XP sufficienti
            expect(BigInt(initialXP)).to.be.gte(await idleProcioneLeveling.xpForLevel(initialLevel),
                "XP insufficienti per il level up");

            // Esegui level up
            const tx = await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            const receipt = await tx.wait();

            // Verifica evento
            const event = receipt.logs.find(log => {
                try {
                    const parsed = idleProcioneLeveling.interface.parseLog(log);
                    return parsed.name === "LevelUp";
                } catch (e) {
                    return false;
                }
            });
            expect(event, "Evento LevelUp non trovato").to.not.be.undefined;

            const parsedEvent = idleProcioneLeveling.interface.parseLog(event);
            console.log("Evento LevelUp:", {
                tokenId: parsedEvent.args.tokenId,
                newLevel: parsedEvent.args.newLevel,
                remainingXP: parsedEvent.args.remainingXP,
                fee: parsedEvent.args.fee
            });

            // Verifica stato finale
            const finalData = await mockNFT.getProcioneData(tokenId);
            const finalLevel = await extractField(finalData, LEVEL_MASK, LEVEL_POSITION);
            const finalXP = await extractField(finalData, XP_MASK, XP_POSITION);

            console.log("Stato Finale:", {
                level: finalLevel,
                xp: finalXP
            });

            // Verifiche
            expect(finalLevel, "Livello non incrementato correttamente").to.equal(initialLevel + 1);
            expect(BigInt(finalXP), "XP non detratti correttamente").to.equal(
                BigInt(initialXP) - BigInt(await idleProcioneLeveling.xpForLevel(initialLevel))
            );

            // Verifica statistiche
            const finalStrength = await extractField(finalData, STRENGTH_MASK, STRENGTH_POSITION);
            const finalSpeed = await extractField(finalData, SPEED_MASK, SPEED_POSITION);
            const finalIntelligence = await extractField(finalData, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
            const finalAccuracy = await extractField(finalData, ACCURACY_MASK, ACCURACY_POSITION);

            console.log("Statistiche Finali:", {
                strength: finalStrength,
                speed: finalSpeed,
                intelligence: finalIntelligence,
                accuracy: finalAccuracy
            });

            // Verifica che tutte le statistiche siano aumentate di 2
            const initialStrength = await extractField(initialData, STRENGTH_MASK, STRENGTH_POSITION);
            expect(finalStrength, "Forza non incrementata correttamente").to.equal(initialStrength + 2);
            const initialSpeed = await extractField(initialData, SPEED_MASK, SPEED_POSITION);
            expect(finalSpeed, "Velocità non incrementata correttamente").to.equal(initialSpeed + 2);
            const initialIntelligence = await extractField(initialData, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
            expect(finalIntelligence, "Intelligenza non incrementata correttamente").to.equal(initialIntelligence + 2);
            const initialAccuracy = await extractField(initialData, ACCURACY_MASK, ACCURACY_POSITION);
            expect(finalAccuracy, "Precisione non incrementata correttamente").to.equal(initialAccuracy + 2);
        });

        it("Non dovrebbe permettere il level up senza XP sufficienti", async function () {
            const initialData = await createInitialData(10); // 10 XP
            await mockNFT.updateProcioneData(tokenId, initialData);

            await expect(idleProcioneLeveling.connect(addr1).levelUp(tokenId))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InsufficientXP");
        });

        it("Non dovrebbe permettere il level up oltre il livello massimo", async function () {
            const maxLevelData = await createInitialData(1000, MAX_LEVEL);
            await mockNFT.updateProcioneData(tokenId, maxLevelData);

            await expect(idleProcioneLeveling.connect(addr1).levelUp(tokenId))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "MaxLevelReached");
        });

        it("Dovrebbe incrementare correttamente le statistiche", async function () {
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            const data = await mockNFT.getProcioneData(tokenId);
            const strength = await extractField(data, STRENGTH_MASK, STRENGTH_POSITION);
            const speed = await extractField(data, SPEED_MASK, SPEED_POSITION);
            const intelligence = await extractField(data, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
            const accuracy = await extractField(data, ACCURACY_MASK, ACCURACY_POSITION);

            expect(strength).to.equal(12); // 10 + 2
            expect(speed).to.equal(12);
            expect(intelligence).to.equal(12);
            expect(accuracy).to.equal(12);
        });

        it("Dovrebbe sbloccare slot breeding ai livelli corretti", async function () {
            // Setup per livello 2 con XP per arrivare a livello 3
            const xpRequired = await idleProcioneLeveling.xpForLevel(2); // XP necessari per passare da livello 2 a 3
            const initialData = await createInitialData(xpRequired, 2);
            await mockNFT.updateProcioneData(tokenId, initialData);

            console.log("Test Breeding - Stato Iniziale:", {
                level: await extractField(initialData, LEVEL_MASK, LEVEL_POSITION),
                xp: await extractField(initialData, XP_MASK, XP_POSITION),
                requiredXP: xpRequired
            });

            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            const finalData = await mockNFT.getProcioneData(tokenId);
            const finalLevel = await extractField(finalData, LEVEL_MASK, LEVEL_POSITION);
            const breeding = await extractField(finalData, BREEDING_MASK, BREEDING_POSITION);

            console.log("Test Breeding - Stato Finale:", {
                level: finalLevel,
                breeding: breeding
            });

            expect(finalLevel, "Livello non corretto").to.equal(3);
            expect(breeding, "Slot breeding non sbloccato").to.equal(1); // Primo slot sbloccato al livello 3
        });

        it("Dovrebbe addebitare correttamente le fee", async function () {
            const initialTreasuryBalance = await rewardToken.balanceOf(treasury.address);
            
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            const finalTreasuryBalance = await rewardToken.balanceOf(treasury.address);
            expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(BASE_FEE + INCREMENTO_FEE * 2n);
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di aggiornare il treasury", async function () {
            await expect(idleProcioneLeveling.setTreasury(addr2.address))
                .to.emit(idleProcioneLeveling, "TreasuryUpdated")
                .withArgs(addr2.address);

            expect(await idleProcioneLeveling.treasuryAddress()).to.equal(addr2.address);
        });

        it("Dovrebbe permettere all'owner di aggiornare i parametri delle fee", async function () {
            const newBaseFee = ethers.parseEther("20");
            const newIncrementoFee = ethers.parseEther("10");

            await expect(idleProcioneLeveling.setFeeParameters(newBaseFee, newIncrementoFee))
                .to.emit(idleProcioneLeveling, "FeeParametersUpdated")
                .withArgs(newBaseFee, newIncrementoFee);

            expect(await idleProcioneLeveling.baseFee()).to.equal(newBaseFee);
            expect(await idleProcioneLeveling.incrementoFee()).to.equal(newIncrementoFee);
        });

        it("Dovrebbe permettere all'owner di aggiornare il livello massimo", async function () {
            const newMaxLevel = 40;

            await expect(idleProcioneLeveling.setMaxLevel(newMaxLevel))
                .to.emit(idleProcioneLeveling, "MaxLevelUpdated")
                .withArgs(newMaxLevel);

            expect(await idleProcioneLeveling.maxLevel()).to.equal(newMaxLevel);
        });

        it("Non dovrebbe permettere di impostare un livello massimo invalido", async function () {
            await expect(idleProcioneLeveling.setMaxLevel(0))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");

            await expect(idleProcioneLeveling.setMaxLevel(100))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");
        });

        it("Dovrebbe permettere all'owner di mettere in pausa e riprendere il contratto", async function () {
            await idleProcioneLeveling.pause();
            expect(await idleProcioneLeveling.paused()).to.be.true;

            await idleProcioneLeveling.unpause();
            expect(await idleProcioneLeveling.paused()).to.be.false;
        });

        it("Non dovrebbe permettere il level up quando il contratto è in pausa", async function () {
            await idleProcioneLeveling.pause();
            await expect(idleProcioneLeveling.connect(addr1).levelUp(tokenId))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "EnforcedPause");
        });

        it("Dovrebbe emettere eventi quando il contratto viene messo in pausa/ripreso", async function () {
            await expect(idleProcioneLeveling.pause())
                .to.emit(idleProcioneLeveling, "ContractPaused")
                .withArgs(owner.address);

            await expect(idleProcioneLeveling.unpause())
                .to.emit(idleProcioneLeveling, "ContractUnpaused")
                .withArgs(owner.address);
        });

        it("Non dovrebbe permettere di impostare fee parameters a zero", async function () {
            await expect(idleProcioneLeveling.setFeeParameters(0, INCREMENTO_FEE))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidFeeParameters");

            await expect(idleProcioneLeveling.setFeeParameters(BASE_FEE, 0))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidFeeParameters");
        });

        it("Non dovrebbe permettere di inizializzare il contratto con fee parameters a zero", async function () {
            await expect(IdleProcioneLeveling.deploy(
                await mockNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                0,
                INCREMENTO_FEE,
                MAX_LEVEL
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidFeeParameters");

            await expect(IdleProcioneLeveling.deploy(
                await mockNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                0,
                MAX_LEVEL
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidFeeParameters");
        });

        it("Dovrebbe gestire correttamente il calcolo delle statistiche con valori al limite", async function () {
            // Setup di statistiche al limite (253 per permettere ancora il +2)
            const data = await mockNFT.getProcioneData(tokenId);
            const highStats = await createInitialData(30, 1, 253);
            await mockNFT.updateProcioneData(tokenId, highStats);

            // Il level up dovrebbe funzionare (253 + 2 = 255)
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);

            // Setup di statistiche oltre il limite
            const tooHighStats = await createInitialData(30, 1, 254);
            await mockNFT.updateProcioneData(tokenId, tooHighStats);

            // Il level up dovrebbe fallire (254 + 2 > 255)
            await expect(idleProcioneLeveling.connect(addr1).levelUp(tokenId))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidStats");
        });
    });

    describe("View Functions", function () {
        it("Dovrebbe calcolare correttamente l'XP necessario per ogni livello", async function () {
            expect(await idleProcioneLeveling.xpForLevel(1)).to.equal(30);
            expect(await idleProcioneLeveling.xpForLevel(2)).to.equal(120);
            expect(await idleProcioneLeveling.xpForLevel(3)).to.equal(270);
        });

        it("Dovrebbe calcolare correttamente la fee per ogni livello", async function () {
            expect(await idleProcioneLeveling.calculateFee(1)).to.equal(BASE_FEE + INCREMENTO_FEE * 2n);
            expect(await idleProcioneLeveling.calculateFee(2)).to.equal(BASE_FEE + INCREMENTO_FEE * 3n);
            expect(await idleProcioneLeveling.calculateFee(3)).to.equal(BASE_FEE + INCREMENTO_FEE * 4n);
        });
    });

    describe("Utility Functions", function () {
        it("Dovrebbe estrarre correttamente i campi", async function () {
            // Creiamo dati di test con valori noti
            let data = ethers.toBigInt(0);
            data = updateField(data, 30, XP_MASK, XP_POSITION); // XP = 30
            data = updateField(data, 1, LEVEL_MASK, LEVEL_POSITION); // Level = 1
            data = updateField(data, 10, STRENGTH_MASK, STRENGTH_POSITION); // Strength = 10

            // Verifichiamo l'estrazione
            expect(extractField(data, XP_MASK, XP_POSITION)).to.equal(30);
            expect(extractField(data, LEVEL_MASK, LEVEL_POSITION)).to.equal(1);
            expect(extractField(data, STRENGTH_MASK, STRENGTH_POSITION)).to.equal(10);
        });
    });

    // Funzioni di utilità per i test
    async function createInitialData(xp, level = 1, baseStats = 10) {
        let data = ethers.toBigInt(0);
        data = updateField(data, xp, XP_MASK, XP_POSITION);
        data = updateField(data, level, LEVEL_MASK, LEVEL_POSITION);
        data = updateField(data, baseStats, HEALTH_MASK, HEALTH_POSITION);
        data = updateField(data, baseStats, STRENGTH_MASK, STRENGTH_POSITION);
        data = updateField(data, baseStats, SPEED_MASK, SPEED_POSITION);
        data = updateField(data, baseStats, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
        data = updateField(data, baseStats, ACCURACY_MASK, ACCURACY_POSITION);
        data = updateField(data, 0, BREEDING_MASK, BREEDING_POSITION);
        return data;
    }

    function extractField(data, mask, position) {
        const shiftedMask = BigInt(mask) << BigInt(position);
        const shiftedData = BigInt(data) & shiftedMask;
        return Number(shiftedData >> BigInt(position));
    }

    function updateField(data, value, mask, position) {
        const shiftedMask = BigInt(mask) << BigInt(position);
        const clearedData = data & ~shiftedMask;
        const shiftedValue = BigInt(value) << BigInt(position);
        return clearedData | shiftedValue;
    }
}); 