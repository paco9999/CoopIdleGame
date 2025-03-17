const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Importazione dei contratti
// Nota: i percorsi sono relativi alla directory 'contracts'
describe("IdleProcioneLeveling", function () {
    let IdleProcioneLeveling;
    let idleProcioneLeveling;
    let MockIdleProcioneNFT;
    let mockIdleProcioneNFT;
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
    const XP_MASK = "0x1FFFF";        // 0-16 (17 bit)
    const LEVEL_MASK = "0xFF";        // 17-24
    const HEALTH_MASK = "0xFF";       // 25-32
    const STRENGTH_MASK = "0xFF";     // 33-40
    const SPEED_MASK = "0xFF";        // 41-48
    const INTELLIGENCE_MASK = "0xFF"; // 49-56
    const ACCURACY_MASK = "0xFF";     // 57-64
    const BREEDING_MASK = "0xFF";     // 80-87

    // Costanti per le posizioni
    const XP_POSITION = "0";
    const LEVEL_POSITION = "17";
    const HEALTH_POSITION = "25";
    const STRENGTH_POSITION = "33";
    const SPEED_POSITION = "41";
    const INTELLIGENCE_POSITION = "49";
    const ACCURACY_POSITION = "57";
    const BREEDING_POSITION = "80";

    beforeEach(async function () {
        [owner, addr1, addr2, treasury] = await ethers.getSigners();

        // Deploy del mock IdleProcioneNFT
        const MockIdleProcioneNFT = await ethers.getContractFactory("contracts/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        mockIdleProcioneNFT = await MockIdleProcioneNFT.deploy();

        // Deploy del token di reward
        RewardToken = await ethers.getContractFactory("contracts/test/mocks/MockERC20.sol:MockERC20");
        rewardToken = await RewardToken.deploy("Reward Token", "RWD");
        await rewardToken.waitForDeployment();

        // Deploy del contratto principale
        IdleProcioneLeveling = await ethers.getContractFactory("IdleProcioneLeveling");
        idleProcioneLeveling = await IdleProcioneLeveling.deploy(
            await mockIdleProcioneNFT.getAddress(),
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
        const tx = await mockIdleProcioneNFT.simpleMint(addr1.address);
        const receipt = await tx.wait();
        tokenId = receipt.logs[0].args[2]; // TokenId è il terzo argomento dell'evento Transfer
        const initialData = await createInitialData(BigInt(120)); // 120 XP, quadruplo del necessario per il level 1
        await mockIdleProcioneNFT.updateProcioneData(tokenId, initialData);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente i parametri iniziali", async function () {
            expect(await idleProcioneLeveling.nftContract()).to.equal(await mockIdleProcioneNFT.getAddress());
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
                await mockIdleProcioneNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                INCREMENTO_FEE,
                0
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidLevel");

            await expect(IdleProcioneLeveling.deploy(
                await mockIdleProcioneNFT.getAddress(),
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
            const initialData = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const initialLevel = BigInt(extractField(initialData, LEVEL_MASK, LEVEL_POSITION));
            const initialXP = BigInt(extractField(initialData, XP_MASK, XP_POSITION));
            const requiredXP = BigInt(await idleProcioneLeveling.xpForLevel(initialLevel));
            
            console.log("Stato Iniziale:", {
                level: Number(initialLevel),
                xp: Number(initialXP),
                requiredXP: requiredXP
            });

            // Verifica che ci siano XP sufficienti
            expect(initialXP).to.be.gte(requiredXP,
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
            const finalData = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const finalLevel = BigInt(extractField(finalData, LEVEL_MASK, LEVEL_POSITION));
            const finalXP = BigInt(extractField(finalData, XP_MASK, XP_POSITION));

            console.log("Stato Finale:", {
                level: Number(finalLevel),
                xp: Number(finalXP)
            });

            // Verifiche
            expect(finalLevel).to.equal(initialLevel + 1n, "Livello non incrementato correttamente");
            expect(finalXP).to.equal(initialXP - requiredXP, "XP non detratti correttamente");

            // Verifica statistiche
            const finalStrength = BigInt(extractField(finalData, STRENGTH_MASK, STRENGTH_POSITION));
            const finalSpeed = BigInt(extractField(finalData, SPEED_MASK, SPEED_POSITION));
            const finalIntelligence = BigInt(extractField(finalData, INTELLIGENCE_MASK, INTELLIGENCE_POSITION));
            const finalAccuracy = BigInt(extractField(finalData, ACCURACY_MASK, ACCURACY_POSITION));

            console.log("Statistiche Finali:", {
                strength: finalStrength,
                speed: finalSpeed,
                intelligence: finalIntelligence,
                accuracy: finalAccuracy
            });

            // Verifica che tutte le statistiche siano aumentate di 2
            const initialStrength = BigInt(extractField(initialData, STRENGTH_MASK, STRENGTH_POSITION));
            expect(finalStrength).to.equal(initialStrength + 2n, "Forza non incrementata correttamente");
            const initialSpeed = BigInt(extractField(initialData, SPEED_MASK, SPEED_POSITION));
            expect(finalSpeed).to.equal(initialSpeed + 2n, "Velocità non incrementata correttamente");
            const initialIntelligence = BigInt(extractField(initialData, INTELLIGENCE_MASK, INTELLIGENCE_POSITION));
            expect(finalIntelligence).to.equal(initialIntelligence + 2n, "Intelligenza non incrementata correttamente");
            const initialAccuracy = BigInt(extractField(initialData, ACCURACY_MASK, ACCURACY_POSITION));
            expect(finalAccuracy).to.equal(initialAccuracy + 2n, "Precisione non incrementata correttamente");
        });

        it("Non dovrebbe permettere il level up senza XP sufficienti", async function () {
            const initialData = await createInitialData(20n); // 20 XP, ne servono 30
            await mockIdleProcioneNFT.updateProcioneData(tokenId, initialData);

            await expect(idleProcioneLeveling.connect(addr1).levelUp(tokenId))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "InsufficientXP");
        });

        it("Non dovrebbe permettere il level up oltre il livello massimo", async function () {
            const maxLevelData = await createInitialData(100000n, BigInt(MAX_LEVEL + 1)); // Livello oltre il massimo
            await mockIdleProcioneNFT.updateProcioneData(tokenId, maxLevelData);

            await expect(idleProcioneLeveling.connect(addr1).levelUp(tokenId))
                .to.be.revertedWithCustomError(idleProcioneLeveling, "MaxLevelReached");
        });

        it("Dovrebbe incrementare correttamente le statistiche", async function () {
            const initialData = await createInitialData(30n, 1n, 10n); // XP sufficienti per level up
            await mockIdleProcioneNFT.updateProcioneData(tokenId, initialData);
            
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            const data = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const strength = BigInt(extractField(data, STRENGTH_MASK, STRENGTH_POSITION));
            const speed = BigInt(extractField(data, SPEED_MASK, SPEED_POSITION));
            const intelligence = BigInt(extractField(data, INTELLIGENCE_MASK, INTELLIGENCE_POSITION));
            const accuracy = BigInt(extractField(data, ACCURACY_MASK, ACCURACY_POSITION));

            expect(strength).to.equal(12n); // 10 + 2
            expect(speed).to.equal(12n);
            expect(intelligence).to.equal(12n);
            expect(accuracy).to.equal(12n);
        });

        it("Dovrebbe sbloccare slot breeding ai livelli corretti", async function () {
            // Setup per livello 2 con XP per arrivare a livello 3
            const xpRequired = BigInt(await idleProcioneLeveling.xpForLevel(2));
            const initialData = await createInitialData(xpRequired, 2n);
            await mockIdleProcioneNFT.updateProcioneData(tokenId, initialData);

            console.log("Test Breeding - Stato Iniziale:", {
                level: extractField(initialData, LEVEL_MASK, LEVEL_POSITION),
                xp: extractField(initialData, XP_MASK, XP_POSITION),
                requiredXP: xpRequired
            });

            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            const finalData = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const finalLevel = BigInt(extractField(finalData, LEVEL_MASK, LEVEL_POSITION));
            const breeding = BigInt(extractField(finalData, BREEDING_MASK, BREEDING_POSITION));

            console.log("Test Breeding - Stato Finale:", {
                level: finalLevel,
                breeding: breeding
            });

            expect(finalLevel).to.equal(3n, "Livello non corretto");
            expect(breeding).to.equal(1n, "Slot breeding non sbloccato"); // Primo slot sbloccato al livello 3
        });

        it("Dovrebbe addebitare correttamente le fee", async function () {
            const initialTreasuryBalance = await rewardToken.balanceOf(treasury.address);
            const expectedFee = BASE_FEE + INCREMENTO_FEE * 2n; // Fee per livello 1 -> 2
            
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            const finalTreasuryBalance = await rewardToken.balanceOf(treasury.address);
            expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedFee);
        });

        it("Dovrebbe incrementare le statistiche in base al fenotipo durante il level up", async function () {
            // Otteniamo il fenotipo del token
            const fenotipo = await mockIdleProcioneNFT.getFenotipo(tokenId);
            console.log("Fenotipo del procione:", fenotipo);
            
            // Otteniamo le statistiche iniziali
            const initialData = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const initialHealth = BigInt(extractField(initialData, HEALTH_MASK, HEALTH_POSITION));
            const initialStrength = BigInt(extractField(initialData, STRENGTH_MASK, STRENGTH_POSITION));
            const initialSpeed = BigInt(extractField(initialData, SPEED_MASK, SPEED_POSITION));
            const initialIntelligence = BigInt(extractField(initialData, INTELLIGENCE_MASK, INTELLIGENCE_POSITION));
            const initialAccuracy = BigInt(extractField(initialData, ACCURACY_MASK, ACCURACY_POSITION));
            
            console.log("Statistiche iniziali:", {
                health: Number(initialHealth),
                strength: Number(initialStrength),
                speed: Number(initialSpeed),
                intelligence: Number(initialIntelligence),
                accuracy: Number(initialAccuracy)
            });
            
            // Esegui level up
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);
            
            // Otteniamo le statistiche finali
            const finalData = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const finalHealth = BigInt(extractField(finalData, HEALTH_MASK, HEALTH_POSITION));
            const finalStrength = BigInt(extractField(finalData, STRENGTH_MASK, STRENGTH_POSITION));
            const finalSpeed = BigInt(extractField(finalData, SPEED_MASK, SPEED_POSITION));
            const finalIntelligence = BigInt(extractField(finalData, INTELLIGENCE_MASK, INTELLIGENCE_POSITION));
            const finalAccuracy = BigInt(extractField(finalData, ACCURACY_MASK, ACCURACY_POSITION));
            
            console.log("Statistiche dopo level up:", {
                health: Number(finalHealth),
                strength: Number(finalStrength),
                speed: Number(finalSpeed),
                intelligence: Number(finalIntelligence),
                accuracy: Number(finalAccuracy)
            });
            
            // Verifichiamo che le statistiche siano cambiate
            expect(finalHealth).to.be.gte(initialHealth);
            expect(finalStrength).to.be.gte(initialStrength);
            expect(finalSpeed).to.be.gte(initialSpeed);
            expect(finalIntelligence).to.be.gte(initialIntelligence);
            expect(finalAccuracy).to.be.gte(initialAccuracy);
            
            // Verifichiamo che almeno una statistica sia aumentata
            const anyStatIncreased = (
                finalHealth > initialHealth ||
                finalStrength > initialStrength ||
                finalSpeed > initialSpeed ||
                finalIntelligence > initialIntelligence ||
                finalAccuracy > initialAccuracy
            );
            
            expect(anyStatIncreased).to.be.true;
            
            // Registriamo i dettagli su quali statistiche sono cambiate
            console.log("Incrementi:", {
                health: Number(finalHealth - initialHealth),
                strength: Number(finalStrength - initialStrength),
                speed: Number(finalSpeed - initialSpeed),
                intelligence: Number(finalIntelligence - initialIntelligence),
                accuracy: Number(finalAccuracy - initialAccuracy)
            });
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
                await mockIdleProcioneNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                0,
                INCREMENTO_FEE,
                MAX_LEVEL
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidFeeParameters");

            await expect(IdleProcioneLeveling.deploy(
                await mockIdleProcioneNFT.getAddress(),
                await rewardToken.getAddress(),
                treasury.address,
                BASE_FEE,
                0,
                MAX_LEVEL
            )).to.be.revertedWithCustomError(idleProcioneLeveling, "InvalidFeeParameters");
        });

        it("Dovrebbe gestire correttamente il calcolo delle statistiche con valori al limite", async function () {
            // Setup di statistiche al limite (253 per permettere ancora il +2)
            const data = await mockIdleProcioneNFT.getProcioneData(tokenId);
            const highStats = await createInitialData(BigInt(30), 1, 253);
            await mockIdleProcioneNFT.updateProcioneData(tokenId, highStats);

            // Il level up dovrebbe funzionare (253 + 2 = 255)
            await idleProcioneLeveling.connect(addr1).levelUp(tokenId);

            // Setup di statistiche oltre il limite
            const tooHighStats = await createInitialData(BigInt(30), 1, 254);
            await mockIdleProcioneNFT.updateProcioneData(tokenId, tooHighStats);

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
    function extractField(data, mask, position) {
        return (BigInt(data) >> BigInt(position)) & BigInt(mask);
    }

    function updateField(data, value, mask, position) {
        const bigData = BigInt(data);
        const bigValue = BigInt(value);
        const bigMask = BigInt(mask);
        const bigPosition = BigInt(position);
        return (bigData & ~(bigMask << bigPosition)) | ((bigValue & bigMask) << bigPosition);
    }

    async function createInitialData(xp, level = 1, baseStats = 10) {
        let data = BigInt(0);
        data = updateField(data, xp, XP_MASK, XP_POSITION);
        data = updateField(data, level, LEVEL_MASK, LEVEL_POSITION);
        data = updateField(data, baseStats, STRENGTH_MASK, STRENGTH_POSITION);
        data = updateField(data, baseStats, SPEED_MASK, SPEED_POSITION);
        data = updateField(data, baseStats, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
        data = updateField(data, baseStats, ACCURACY_MASK, ACCURACY_POSITION);
        return data;
    }
}); 