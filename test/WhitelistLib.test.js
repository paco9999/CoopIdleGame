const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WhitelistLib", function () {
    let WhitelistLibTest;
    let whitelistLibTest;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy del contratto di test
        WhitelistLibTest = await ethers.getContractFactory("WhitelistLibTest");
        whitelistLibTest = await WhitelistLibTest.deploy();
        await whitelistLibTest.deployed();
    });

    describe("Gestione Whitelist", function () {
        it("Dovrebbe gestire correttamente la whitelist fase 1", async function () {
            const addresses = [addr1.address, addr2.address];
            await whitelistLibTest.setWhitelistPhase1(addresses, true);

            expect(await whitelistLibTest.isInPhase1(addr1.address)).to.be.true;
            expect(await whitelistLibTest.isInPhase1(addr2.address)).to.be.true;
            expect(await whitelistLibTest.isInPhase1(addrs[0].address)).to.be.false;
        });

        it("Dovrebbe gestire correttamente la whitelist fase 2", async function () {
            const addresses = [addr1.address, addr2.address];
            await whitelistLibTest.setWhitelistPhase2(addresses, true);

            expect(await whitelistLibTest.isInPhase2(addr1.address)).to.be.true;
            expect(await whitelistLibTest.isInPhase2(addr2.address)).to.be.true;
            expect(await whitelistLibTest.isInPhase2(addrs[0].address)).to.be.false;
        });

        it("Dovrebbe gestire correttamente il batch update", async function () {
            const addresses = [addr1.address, addr2.address];
            const phase1Status = [true, false];
            const phase2Status = [false, true];

            await whitelistLibTest.setWhitelistBatch(addresses, phase1Status, phase2Status);

            expect(await whitelistLibTest.isInPhase1(addr1.address)).to.be.true;
            expect(await whitelistLibTest.isInPhase1(addr2.address)).to.be.false;
            expect(await whitelistLibTest.isInPhase2(addr1.address)).to.be.false;
            expect(await whitelistLibTest.isInPhase2(addr2.address)).to.be.true;
        });

        it("Dovrebbe fallire con batch troppo grande", async function () {
            const addresses = Array(1001).fill(addr1.address);
            const phase1Status = Array(1001).fill(true);
            const phase2Status = Array(1001).fill(true);

            await expect(
                whitelistLibTest.setWhitelistBatch(addresses, phase1Status, phase2Status)
            ).to.be.revertedWith("Batch troppo grande");
        });
    });

    describe("Gestione Fasi", function () {
        it("Dovrebbe gestire correttamente l'attivazione delle fasi", async function () {
            await whitelistLibTest.setPhaseStatus(1, true);
            expect(await whitelistLibTest.getPhase1Status()).to.be.true;
            expect(await whitelistLibTest.getPhase2Status()).to.be.false;

            await whitelistLibTest.setPhaseStatus(2, true);
            expect(await whitelistLibTest.getPhase1Status()).to.be.false;
            expect(await whitelistLibTest.getPhase2Status()).to.be.true;
        });

        it("Dovrebbe gestire correttamente il prezzo", async function () {
            const price = ethers.utils.parseEther("1");
            await whitelistLibTest.setPrice(price);
            expect(await whitelistLibTest.getPrice()).to.equal(price);
        });
    });

    describe("Condizioni di Mint", function () {
        const mintPerWallet = 2;
        const price = ethers.utils.parseEther("1");

        beforeEach(async function () {
            await whitelistLibTest.setPrice(price);
        });

        it("Dovrebbe permettere il mint in fase 1", async function () {
            await whitelistLibTest.setWhitelistPhase1([addr1.address], true);
            await whitelistLibTest.setPhaseStatus(1, true);

            expect(
                await whitelistLibTest.checkMintConditions(addr1.address, 0, mintPerWallet)
            ).to.be.true;
        });

        it("Dovrebbe permettere il mint in fase 2", async function () {
            await whitelistLibTest.setWhitelistPhase2([addr1.address], true);
            await whitelistLibTest.setPhaseStatus(2, true);

            expect(
                await whitelistLibTest.checkMintConditions(addr1.address, price, mintPerWallet)
            ).to.be.true;
        });

        it("Non dovrebbe permettere il mint se nessuna fase è attiva", async function () {
            await expect(
                whitelistLibTest.checkMintConditions(addr1.address, price, mintPerWallet)
            ).to.be.revertedWith("Nessuna fase attiva");
        });

        it("Non dovrebbe permettere il mint se non in whitelist", async function () {
            await whitelistLibTest.setPhaseStatus(1, true);

            await expect(
                whitelistLibTest.checkMintConditions(addr1.address, 0, mintPerWallet)
            ).to.be.revertedWith("Non sei nella whitelist fase 1");
        });

        it("Non dovrebbe permettere il mint se valore insufficiente in fase 2", async function () {
            await whitelistLibTest.setWhitelistPhase2([addr1.address], true);
            await whitelistLibTest.setPhaseStatus(2, true);

            await expect(
                whitelistLibTest.checkMintConditions(addr1.address, 0, mintPerWallet)
            ).to.be.revertedWith("AVAX insufficienti");
        });

        it("Non dovrebbe permettere il mint se superato il limite per wallet", async function () {
            await whitelistLibTest.setWhitelistPhase1([addr1.address], true);
            await whitelistLibTest.setPhaseStatus(1, true);

            // Simula due mint
            await whitelistLibTest.incrementMintCount(addr1.address);
            await whitelistLibTest.incrementMintCount(addr1.address);

            await expect(
                whitelistLibTest.checkMintConditions(addr1.address, 0, mintPerWallet)
            ).to.be.revertedWith("Limite per wallet raggiunto");
        });
    });

    describe("Informazioni di Mint", function () {
        const mintPerWallet = 2;

        it("Dovrebbe restituire le informazioni corrette", async function () {
            await whitelistLibTest.setWhitelistPhase1([addr1.address], true);
            await whitelistLibTest.setWhitelistPhase2([addr1.address], true);
            await whitelistLibTest.incrementMintCount(addr1.address);

            const [isWhitelistedPhase1, isWhitelistedPhase2, mintedAmount, remainingMints] = 
                await whitelistLibTest.getMintInfo(addr1.address, mintPerWallet);

            expect(isWhitelistedPhase1).to.be.true;
            expect(isWhitelistedPhase2).to.be.true;
            expect(mintedAmount).to.equal(1);
            expect(remainingMints).to.equal(1);
        });
    });
}); 