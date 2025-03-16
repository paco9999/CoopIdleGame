const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RandomnessConsumer", function () {
    let RandomnessConsumer;
    let randomnessConsumer;
    let owner;
    let signer;
    let addr1;
    let signerWallet;

    beforeEach(async function () {
        [owner, signer, addr1] = await ethers.getSigners();
        
        // Creiamo un wallet per il signer che useremo per firmare i numeri
        signerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
        
        // Deploy del contratto
        const RandomnessConsumerFactory = await ethers.getContractFactory("RandomnessConsumer");
        randomnessConsumer = await RandomnessConsumerFactory.deploy(signerWallet.address);
        await randomnessConsumer.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente il signer iniziale", async function () {
            expect(await randomnessConsumer.randomnessSigner()).to.equal(signerWallet.address);
        });

        it("Dovrebbe impostare correttamente l'owner", async function () {
            expect(await randomnessConsumer.owner()).to.equal(owner.address);
        });

        it("Non dovrebbe permettere il deploy con indirizzo zero come signer", async function () {
            const RandomnessConsumerFactory = await ethers.getContractFactory("RandomnessConsumer");
            await expect(RandomnessConsumerFactory.deploy(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(RandomnessConsumerFactory, "InvalidAddress");
        });
    });

    describe("Gestione Signer", function () {
        it("Dovrebbe permettere all'owner di cambiare il signer", async function () {
            await expect(randomnessConsumer.setRandomnessSigner(addr1.address))
                .to.emit(randomnessConsumer, "RandomnessSignerUpdated")
                .withArgs(signerWallet.address, addr1.address);

            expect(await randomnessConsumer.randomnessSigner()).to.equal(addr1.address);
        });

        it("Non dovrebbe permettere a non-owner di cambiare il signer", async function () {
            await expect(randomnessConsumer.connect(addr1).setRandomnessSigner(addr1.address))
                .to.be.revertedWithCustomError(randomnessConsumer, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });

        it("Non dovrebbe permettere di impostare un signer con indirizzo zero", async function () {
            await expect(randomnessConsumer.setRandomnessSigner(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(randomnessConsumer, "InvalidAddress");
        });
    });

    describe("Verifica e Consumo Randomness", function () {
        let randomNumber;
        let timestamp;
        let signature;

        beforeEach(async function () {
            // Genera un numero casuale
            randomNumber = ethers.toBigInt(ethers.randomBytes(32));
            timestamp = Math.floor(Date.now() / 1000);

            // Crea e firma il messaggio
            const messageHash = ethers.solidityPackedKeccak256(
                ['uint256', 'uint256'],
                [randomNumber, timestamp]
            );
            
            // Firma il messageHash
            signature = await signerWallet.signMessage(ethers.getBytes(messageHash));
        });

        it("Dovrebbe verificare correttamente una firma valida", async function () {
            expect(await randomnessConsumer.verifySignature(randomNumber, timestamp, signature))
                .to.be.true;
        });

        it("Non dovrebbe verificare una firma invalida", async function () {
            // Firma con un wallet diverso
            const wrongWallet = ethers.Wallet.createRandom().connect(ethers.provider);
            const messageHash = ethers.solidityPackedKeccak256(
                ['uint256', 'uint256'],
                [randomNumber, timestamp]
            );
            const wrongSignature = await wrongWallet.signMessage(ethers.getBytes(messageHash));

            expect(await randomnessConsumer.verifySignature(randomNumber, timestamp, wrongSignature))
                .to.be.false;
        });

        it("Dovrebbe consumare correttamente un numero casuale firmato", async function () {
            await expect(randomnessConsumer.consumeRandomness(randomNumber, timestamp, signature))
                .to.emit(randomnessConsumer, "RandomnessVerified")
                .withArgs(randomNumber, timestamp);

            // Verifica che il numero sia stato marcato come usato
            expect(await randomnessConsumer.usedRandomNumbers(randomNumber)).to.be.true;
        });

        it("Non dovrebbe permettere di riutilizzare lo stesso numero", async function () {
            // Prima chiamata (dovrebbe funzionare)
            await randomnessConsumer.consumeRandomness(randomNumber, timestamp, signature);

            // Seconda chiamata (dovrebbe fallire)
            await expect(randomnessConsumer.consumeRandomness(randomNumber, timestamp, signature))
                .to.be.revertedWithCustomError(randomnessConsumer, "RandomNumberAlreadyUsed");
        });

        it("Non dovrebbe accettare una firma non valida", async function () {
            // Modifica il timestamp per invalidare la firma
            const wrongTimestamp = timestamp + 1;

            await expect(randomnessConsumer.consumeRandomness(randomNumber, wrongTimestamp, signature))
                .to.be.revertedWithCustomError(randomnessConsumer, "InvalidSignature");
        });

        it("Non dovrebbe accettare una firma da un signer non autorizzato", async function () {
            // Firma con un wallet non autorizzato
            const unauthorizedWallet = ethers.Wallet.createRandom().connect(ethers.provider);
            const messageHash = ethers.solidityPackedKeccak256(
                ['uint256', 'uint256'],
                [randomNumber, timestamp]
            );
            const unauthorizedSignature = await unauthorizedWallet.signMessage(ethers.getBytes(messageHash));

            await expect(randomnessConsumer.consumeRandomness(randomNumber, timestamp, unauthorizedSignature))
                .to.be.revertedWithCustomError(randomnessConsumer, "InvalidSignature");
        });
    });

    describe("Integrazione con il Servizio Off-Chain", function () {
        it("Dovrebbe integrare correttamente con il formato del servizio off-chain", async function () {
            // Simula la risposta del servizio off-chain
            const randomNumber = ethers.toBigInt(ethers.randomBytes(32));
            const timestamp = Math.floor(Date.now() / 1000);
            const messageHash = ethers.solidityPackedKeccak256(
                ['uint256', 'uint256'],
                [randomNumber, timestamp]
            );
            const signature = await signerWallet.signMessage(ethers.getBytes(messageHash));

            // Verifica che il contratto accetti il formato
            await expect(randomnessConsumer.consumeRandomness(randomNumber, timestamp, signature))
                .to.emit(randomnessConsumer, "RandomnessVerified")
                .withArgs(randomNumber, timestamp);
        });
    });
}); 