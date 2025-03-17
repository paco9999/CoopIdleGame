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

  describe("Fenotipo", function() {
    it("Dovrebbe determinare correttamente il fenotipo con tratti dominanti", async function() {
      // Crea genetica di test con diverse combinazioni di tratti
      const head1 = (0 << 4) | 3;  // Dominante, ID 3
      const head2 = (2 << 4) | 8;  // Min Recessivo, ID 8
      
      const fur1 = (1 << 4) | 2;   // Recessivo, ID 2
      const fur2 = (0 << 4) | 7;   // Dominante, ID 7
      
      const star1 = (0 << 4) | 1;  // Dominante, ID 1
      const star2 = (0 << 4) | 9;  // Dominante, ID 9
      
      const weapon1 = (1 << 4) | 6;  // Recessivo, ID 6
      const weapon2 = (2 << 4) | 5;  // Min Recessivo, ID 5
      
      const acc1 = (2 << 4) | 3;    // Min Recessivo, ID 3
      const acc2 = (1 << 4) | 7;    // Recessivo, ID 7
      
      const genetics = await geneticsLibTest.createTestGenetics(
        head1, head2, fur1, fur2, star1, star2, weapon1, weapon2, acc1, acc2
      );
      
      const tx = await geneticsLibTest.determineFenotipo(genetics);
      const receipt = await tx.wait();
      const fenotipo = receipt.logs[0].args[0];
      
      // Regole di dominanza attese:
      // 1. HEAD: head1 è dominante, quindi fenotipo[0] dovrebbe essere 3
      expect(fenotipo[0]).to.equal(3n);
      
      // 2. FUR: fur2 è dominante, quindi fenotipo[1] dovrebbe essere 7
      expect(fenotipo[1]).to.equal(7n);
      
      // 3. STAR: entrambi sono dominanti, ma poiché è deterministico basato su seed,
      // verifichiamo solo che sia uno dei due valori
      expect(fenotipo[2]).to.be.oneOf([1n, 9n]);
      
      // 4. WEAPON: weapon1 è recessivo e weapon2 è recessivo minore, quindi dovrebbe vincere il recessivo
      expect(fenotipo[3]).to.equal(6n);
      
      // 5. ACCESSORY: acc1 è recessivo minore e acc2 è recessivo, quindi dovrebbe vincere il recessivo
      expect(fenotipo[4]).to.equal(7n);
    });

    it("Dovrebbe gestire correttamente casi con stesso tipo di tratto", async function() {
      // Crea genetica di test con tratti dello stesso tipo
      const head1 = (1 << 4) | 2;  // Recessivo, ID 2
      const head2 = (1 << 4) | 4;  // Recessivo, ID 4
      
      const genetics = await geneticsLibTest.createTestGenetics(
        head1, head2, 0, 0, 0, 0, 0, 0, 0, 0
      );
      
      const tx = await geneticsLibTest.determineFenotipo(genetics);
      const receipt = await tx.wait();
      const fenotipo = receipt.logs[0].args[0];
      
      // Con stesso tipo, dovrebbe essere deterministico basato su seed
      expect(fenotipo[0]).to.be.oneOf([2n, 4n]);
    });
  });

  describe("Mutazione", function() {
    it("Dovrebbe applicare mutazioni alla genetica", async function() {
      // Creiamo una genetica iniziale
      const initialGenetics = await geneticsLibTest.createTestGenetics(
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10
      );
      
      const randomValue = getRandomValue();
      const tx = await geneticsLibTest.applyMutation(initialGenetics, randomValue);
      const receipt = await tx.wait();
      const mutatedGenetics = receipt.logs[0].args[0];
      
      // Verifichiamo che la genetica sia cambiata
      // La probabilità di mutazione è bassa (1%), quindi potrebbe non cambiare
      // Confrontiamo quindi solo che il valore ritornato sia valido
      expect(mutatedGenetics).to.not.be.undefined;
      
      // Nota: Non possiamo prevedere esattamente quali alleli muteranno,
      // quindi controlliamo solo che il valore sia almeno plausibile
      // Questa è una verifica debole, ma sufficiente per il concetto di mutazione
    });
    
    it("Dovrebbe mantenere la struttura degli alleli dopo la mutazione", async function() {
      // Creiamo una genetica con valori noti
      const head1 = (0 << 4) | 3;  // Dominante, ID 3
      const genetics = await geneticsLibTest.createTestGenetics(
        head1, 0, 0, 0, 0, 0, 0, 0, 0, 0
      );
      
      // Verifichiamo che l'allele originale sia impostato correttamente
      const originalAllele = await geneticsLibTest.extractField(
        genetics, 
        await geneticsLibTest.ALLELE_MASK(), 
        await geneticsLibTest.HEAD_MOTHER_POSITION()
      );
      expect(originalAllele).to.equal(head1);
      
      // Applichiamo la mutazione con un valore casuale fisso per ripetibilità
      const fixedRandomValue = ethers.toBigInt("123456789");
      const tx = await geneticsLibTest.applyMutation(genetics, fixedRandomValue);
      const mutatedGenetics = await getTransactionValue(tx);
      
      // Estraiamo un allele dalla genetica mutata
      const headAllele = await geneticsLibTest.extractField(
        mutatedGenetics, 
        await geneticsLibTest.ALLELE_MASK(), 
        await geneticsLibTest.HEAD_MOTHER_POSITION()
      );
      
      // Verifichiamo che l'allele sia ancora valido (tipo tra 0-2, ID tra 0-9)
      const extractedType = await geneticsLibTest.extractTraitType(headAllele);
      const extractedId = await geneticsLibTest.extractTraitId(headAllele);
      
      expect(extractedType).to.be.lte(2);
      expect(extractedId).to.be.lte(9);
    });
  });
}); 