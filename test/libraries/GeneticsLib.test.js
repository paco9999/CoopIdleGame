const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GeneticsLib", function() {
  let geneticsLibTest;
  let owner;

  function getRandomValue() {
    return ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
  }

  async function getTransactionValue(tx) {
    const receipt = await tx.wait();
    const event = receipt.logs[0];
    return event.args[0];
  }

  beforeEach(async function() {
    const [_owner] = await ethers.getSigners();
    owner = _owner;

    // Deploy GeneticsLibTest contract
    const GeneticsLibTest = await ethers.getContractFactory("GeneticsLibTest");
    geneticsLibTest = await GeneticsLibTest.deploy();
    await geneticsLibTest.waitForDeployment();
  });

  describe("Costanti e Maschere", function() {
    it("Dovrebbe avere le maschere corrette", async function() {
      expect(await geneticsLibTest.ALLELE_MASK()).to.equal(0x3F);
      expect(await geneticsLibTest.TRAIT_ID_MASK()).to.equal((1 << 4) - 1);
      expect(await geneticsLibTest.TRAIT_TYPE_MASK()).to.equal((1 << 2) - 1);
    });

    it("Dovrebbe avere le posizioni corrette per gli alleli", async function() {
      expect(await geneticsLibTest.HEAD_MOTHER_POSITION()).to.equal(0);
      expect(await geneticsLibTest.HEAD_FATHER_POSITION()).to.equal(6);
      expect(await geneticsLibTest.FUR_MOTHER_POSITION()).to.equal(12);
      expect(await geneticsLibTest.FUR_FATHER_POSITION()).to.equal(18);
      expect(await geneticsLibTest.STAR_MOTHER_POSITION()).to.equal(24);
      expect(await geneticsLibTest.STAR_FATHER_POSITION()).to.equal(30);
      expect(await geneticsLibTest.WEAPON_MOTHER_POSITION()).to.equal(36);
      expect(await geneticsLibTest.WEAPON_FATHER_POSITION()).to.equal(42);
      expect(await geneticsLibTest.ACC_MOTHER_POSITION()).to.equal(48);
      expect(await geneticsLibTest.ACC_FATHER_POSITION()).to.equal(54);
    });

    it("Dovrebbe avere i limiti massimi corretti", async function() {
      expect(await geneticsLibTest.MAX_DOMINANT()).to.equal(4000);
      expect(await geneticsLibTest.MAX_RECESSIVE()).to.equal(1334);
      expect(await geneticsLibTest.MAX_MINOR_RECESSIVE()).to.equal(666);
    });

    it("Dovrebbe avere i tipi di tratti corretti", async function() {
      expect(await geneticsLibTest.TraitType_DOMINANT()).to.equal(0);
      expect(await geneticsLibTest.TraitType_RECESSIVE()).to.equal(1);
      expect(await geneticsLibTest.TraitType_MINOR_RECESSIVE()).to.equal(2);
    });
  });

  describe("Manipolazione dei Campi", function() {
    it("Dovrebbe settare correttamente un campo", async function() {
      const data = 0n;
      const value = 5n;
      const mask = 0x3Fn;
      const position = 6n;
      
      const result = await geneticsLibTest.setField(data, value, mask, position);
      expect(result).to.equal(value << position);
    });

    it("Dovrebbe estrarre correttamente un campo", async function() {
      const data = 5n << 6n;
      const mask = 0x3Fn;
      const position = 6n;
      
      const result = await geneticsLibTest.extractField(data, mask, position);
      expect(result).to.equal(5n);
    });

    it("Dovrebbe fallire se il valore è troppo grande per la maschera", async function() {
      const data = 0n;
      const value = 0x40n;
      const mask = 0x3Fn;
      const position = 6n;
      
      await expect(geneticsLibTest.setField(data, value, mask, position))
        .to.be.revertedWith("Valore troppo grande per la maschera");
    });
  });

  describe("Generazione Tratti", function() {
    it("Dovrebbe generare un tipo di tratto valido", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      const tx = await geneticsLibTest.generateValidTraitType(randomValue, attempt);
      const traitType = await getTransactionValue(tx);
      expect(traitType).to.be.lte(2);
    });

    it("Dovrebbe generare un ID tratto valido", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      const partType = 0; // Head
      const tx = await geneticsLibTest.generateValidTraitId(randomValue, attempt, partType);
      const traitId = await getTransactionValue(tx);
      expect(traitId).to.be.lte(9);
    });

    it("Dovrebbe generare un allele completo", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      const partType = 0; // Head
      const tx = await geneticsLibTest.generateAllele(randomValue, attempt, partType);
      const allele = await getTransactionValue(tx);
      
      // Verifica che l'allele sia nel formato corretto
      expect(allele).to.be.lte(0x3F);
      
      // Estrai e verifica il tipo di tratto
      const traitType = await geneticsLibTest.extractTraitType(allele);
      expect(traitType).to.be.lte(2);
      
      // Estrai e verifica l'ID del tratto
      const traitId = await geneticsLibTest.extractTraitId(allele);
      expect(traitId).to.be.lte(9);
    });

    it("Dovrebbe incrementare i contatori appropriati quando genera un allele", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      const partType = 0;
      
      const initialDominantCount = await geneticsLibTest.getDominantCount();
      const initialRecessiveCount = await geneticsLibTest.getRecessiveCount();
      const initialMinorRecessiveCount = await geneticsLibTest.getMinorRecessiveCount();
      
      const tx = await geneticsLibTest.generateAllele(randomValue, attempt, partType);
      const allele = await getTransactionValue(tx);
      const traitType = await geneticsLibTest.extractTraitType(allele);
      
      if (traitType === 0n) {
        expect(await geneticsLibTest.getDominantCount()).to.equal(initialDominantCount + 1n);
      } else if (traitType === 1n) {
        expect(await geneticsLibTest.getRecessiveCount()).to.equal(initialRecessiveCount + 1n);
      } else {
        expect(await geneticsLibTest.getMinorRecessiveCount()).to.equal(initialMinorRecessiveCount + 1n);
      }
    });
  });

  describe("Limiti e Validazioni", function() {
    it("Dovrebbe rispettare i limiti dei tratti dominanti", async function() {
      const dominantCount = await geneticsLibTest.getDominantCount();
      expect(dominantCount).to.be.lte(4000);
    });

    it("Dovrebbe rispettare i limiti dei tratti recessivi", async function() {
      const recessiveCount = await geneticsLibTest.getRecessiveCount();
      expect(recessiveCount).to.be.lte(1334);
    });

    it("Dovrebbe rispettare i limiti dei tratti minori recessivi", async function() {
      const minorRecessiveCount = await geneticsLibTest.getMinorRecessiveCount();
      expect(minorRecessiveCount).to.be.lte(666);
    });

    it("Dovrebbe rispettare i limiti per ogni tipo di parte", async function() {
      for(let partType = 0; partType < 5; partType++) {
        for(let traitId = 0; traitId < 10; traitId++) {
          const count = await geneticsLibTest.getTraitCount(partType, traitId);
          const limit = await geneticsLibTest.getTraitLimit(partType, traitId);
          expect(count).to.be.lte(limit);
        }
      }
    });
  });

  describe("Gestione Eventi", function() {
    it("Dovrebbe emettere l'evento TraitTypeGenerated quando genera un tipo di tratto", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      
      await expect(geneticsLibTest.generateValidTraitType(randomValue, attempt))
        .to.emit(geneticsLibTest, "TraitTypeGenerated");
    });

    it("Dovrebbe emettere l'evento TraitIdGenerated quando genera un ID tratto", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      const partType = 0;
      
      await expect(geneticsLibTest.generateValidTraitId(randomValue, attempt, partType))
        .to.emit(geneticsLibTest, "TraitIdGenerated");
    });

    it("Dovrebbe emettere l'evento AlleleGenerated quando genera un allele", async function() {
      const randomValue = getRandomValue();
      const attempt = 0;
      const partType = 0;
      
      await expect(geneticsLibTest.generateAllele(randomValue, attempt, partType))
        .to.emit(geneticsLibTest, "AlleleGenerated");
    });
  });

  describe("Inizializzazione Limiti", function() {
    it("Dovrebbe inizializzare correttamente i limiti dei tratti comuni", async function() {
      for(let i = 0; i < 4; i++) {
        for(let partType = 0; partType < 5; partType++) {
          const limit = await geneticsLibTest.getTraitLimit(partType, i);
          expect(limit).to.equal(700);
        }
      }
    });

    it("Dovrebbe inizializzare correttamente i limiti dei tratti rari", async function() {
      for(let i = 4; i < 7; i++) {
        for(let partType = 0; partType < 5; partType++) {
          const limit = await geneticsLibTest.getTraitLimit(partType, i);
          expect(limit).to.equal(600);
        }
      }
    });

    it("Dovrebbe inizializzare correttamente i limiti dei tratti epici", async function() {
      for(let i = 7; i < 9; i++) {
        for(let partType = 0; partType < 5; partType++) {
          const limit = await geneticsLibTest.getTraitLimit(partType, i);
          expect(limit).to.equal(500);
        }
      }
    });

    it("Dovrebbe inizializzare correttamente i limiti dei tratti leggendari", async function() {
      for(let partType = 0; partType < 5; partType++) {
        const limit = await geneticsLibTest.getTraitLimit(partType, 9);
        expect(limit).to.equal(400);
      }
    });
  });
}); 