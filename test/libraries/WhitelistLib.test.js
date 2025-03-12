const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WhitelistLib", function() {
  let whitelistLibTest;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function() {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const WhitelistLibTest = await ethers.getContractFactory("WhitelistLibTest");
    whitelistLibTest = await WhitelistLibTest.deploy();
    await whitelistLibTest.waitForDeployment();
  });

  describe("Gestione delle Fasi", function() {
    it("Dovrebbe attivare la fase 1 e disattivare la fase 2", async function() {
      await whitelistLibTest.setPhaseStatus(1, true);
      expect(await whitelistLibTest.isPhase1Active()).to.be.true;
      expect(await whitelistLibTest.isPhase2Active()).to.be.false;
    });

    it("Dovrebbe attivare la fase 2 e disattivare la fase 1", async function() {
      await whitelistLibTest.setPhaseStatus(2, true);
      expect(await whitelistLibTest.isPhase2Active()).to.be.true;
      expect(await whitelistLibTest.isPhase1Active()).to.be.false;
    });

    it("Dovrebbe emettere l'evento PhaseStatusUpdated", async function() {
      await expect(whitelistLibTest.setPhaseStatus(1, true))
        .to.emit(whitelistLibTest, "PhaseStatusUpdated")
        .withArgs(1, true);
    });
  });

  describe("Gestione dei Prezzi", function() {
    it("Dovrebbe impostare il prezzo correttamente", async function() {
      const price = ethers.parseEther("0.1");
      await whitelistLibTest.setPrice(price);
      expect(await whitelistLibTest.getPrice()).to.equal(price);
    });

    it("Dovrebbe emettere l'evento PriceUpdated", async function() {
      const price = ethers.parseEther("0.1");
      await expect(whitelistLibTest.setPrice(price))
        .to.emit(whitelistLibTest, "PriceUpdated")
        .withArgs(price);
    });
  });

  describe("Gestione della Whitelist", function() {
    it("Dovrebbe aggiungere indirizzi alla fase 1", async function() {
      await whitelistLibTest.setWhitelistPhase1([addr1.address], true);
      expect(await whitelistLibTest.isWhitelistedInPhase1(addr1.address)).to.be.true;
    });

    it("Dovrebbe aggiungere indirizzi alla fase 2", async function() {
      await whitelistLibTest.setWhitelistPhase2([addr1.address], true);
      expect(await whitelistLibTest.isWhitelistedInPhase2(addr1.address)).to.be.true;
    });

    it("Dovrebbe gestire batch di indirizzi", async function() {
      const addresses = [addr1.address, addr2.address];
      const phase1Status = [true, false];
      const phase2Status = [false, true];

      await whitelistLibTest.setWhitelistBatch(addresses, phase1Status, phase2Status);

      expect(await whitelistLibTest.isWhitelistedInPhase1(addr1.address)).to.be.true;
      expect(await whitelistLibTest.isWhitelistedInPhase1(addr2.address)).to.be.false;
      expect(await whitelistLibTest.isWhitelistedInPhase2(addr1.address)).to.be.false;
      expect(await whitelistLibTest.isWhitelistedInPhase2(addr2.address)).to.be.true;
    });

    it("Dovrebbe fallire con batch troppo grandi", async function() {
      const addresses = Array(1001).fill(addr1.address);
      const phase1Status = Array(1001).fill(true);
      const phase2Status = Array(1001).fill(true);

      await expect(whitelistLibTest.setWhitelistBatch(addresses, phase1Status, phase2Status))
        .to.be.revertedWithCustomError(whitelistLibTest, "BatchTooLarge");
    });

    it("Dovrebbe fallire con array di lunghezze diverse", async function() {
      const addresses = [addr1.address, addr2.address];
      const phase1Status = [true];
      const phase2Status = [false, true];

      await expect(whitelistLibTest.setWhitelistBatch(addresses, phase1Status, phase2Status))
        .to.be.revertedWithCustomError(whitelistLibTest, "ArrayLengthMismatch");
    });
  });

  describe("Verifica Condizioni di Mint", function() {
    beforeEach(async function() {
      await whitelistLibTest.setWhitelistPhase1([addr1.address], true);
      await whitelistLibTest.setWhitelistPhase2([addr2.address], true);
      await whitelistLibTest.setPrice(ethers.parseEther("0.1"));
    });

    it("Dovrebbe permettere il mint in fase 1", async function() {
      await whitelistLibTest.setPhaseStatus(1, true);
      expect(await whitelistLibTest.checkMintConditions(addr1.address, 0)).to.be.true;
    });

    it("Dovrebbe permettere il mint in fase 2", async function() {
      await whitelistLibTest.setPhaseStatus(2, true);
      expect(await whitelistLibTest.checkMintConditions(addr2.address, ethers.parseEther("0.1"))).to.be.true;
    });

    it("Dovrebbe fallire se nessuna fase è attiva", async function() {
      await expect(whitelistLibTest.checkMintConditions(addr1.address, 0))
        .to.be.revertedWithCustomError(whitelistLibTest, "NoActivePhase");
    });

    it("Dovrebbe fallire se non in whitelist", async function() {
      await whitelistLibTest.setPhaseStatus(1, true);
      await expect(whitelistLibTest.checkMintConditions(addr2.address, 0))
        .to.be.revertedWithCustomError(whitelistLibTest, "NotWhitelisted");
    });

    it("Dovrebbe fallire se pagamento insufficiente in fase 2", async function() {
      await whitelistLibTest.setPhaseStatus(2, true);
      await expect(whitelistLibTest.checkMintConditions(addr2.address, ethers.parseEther("0.05")))
        .to.be.revertedWithCustomError(whitelistLibTest, "InsufficientPayment");
    });

    it("Dovrebbe fallire se pagamento in fase 1", async function() {
      await whitelistLibTest.setPhaseStatus(1, true);
      await expect(whitelistLibTest.checkMintConditions(addr1.address, ethers.parseEther("0.1")))
        .to.be.revertedWithCustomError(whitelistLibTest, "FreePhase");
    });
  });

  describe("Recupero Informazioni", function() {
    beforeEach(async function() {
      await whitelistLibTest.setWhitelistPhase1([addr1.address], true);
      await whitelistLibTest.setWhitelistPhase2([addr1.address], true);
    });

    it("Dovrebbe recuperare le informazioni di mint correttamente", async function() {
      const mintInfo = await whitelistLibTest.getMintInfo(addr1.address);
      
      expect(mintInfo.isWhitelistedPhase1).to.be.true;
      expect(mintInfo.isWhitelistedPhase2).to.be.true;
      expect(mintInfo.mintedAmount).to.equal(0);
      expect(mintInfo.remainingMints).to.equal(2); // MINT_PER_WALLET
    });
  });
}); 