const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FactionClassLib", function() {
  let factionClassLibTest;
  let owner;

  beforeEach(async function() {
    const [_owner] = await ethers.getSigners();
    owner = _owner;

    // Deploy FactionClassLibTest contract
    const FactionClassLibTest = await ethers.getContractFactory("FactionClassLibTest");
    factionClassLibTest = await FactionClassLibTest.deploy();
    await factionClassLibTest.waitForDeployment();
  });

  describe("Enumerazioni", function() {
    describe("Fazioni", function() {
      it("Dovrebbe avere i valori corretti per le fazioni", async function() {
        expect(await factionClassLibTest.Faction_NONE()).to.equal(0);
        expect(await factionClassLibTest.Faction_GUARDIAN()).to.equal(1);
        expect(await factionClassLibTest.Faction_SHADOW()).to.equal(2);
        expect(await factionClassLibTest.Faction_MYSTIC()).to.equal(3);
        expect(await factionClassLibTest.Faction_WILD()).to.equal(4);
      });
    });

    describe("Classi", function() {
      it("Dovrebbe avere i valori corretti per le classi", async function() {
        expect(await factionClassLibTest.Class_NONE()).to.equal(0);
        expect(await factionClassLibTest.Class_WARRIOR()).to.equal(1);
        expect(await factionClassLibTest.Class_ROGUE()).to.equal(2);
        expect(await factionClassLibTest.Class_MAGE()).to.equal(3);
        expect(await factionClassLibTest.Class_RANGER()).to.equal(4);
        expect(await factionClassLibTest.Class_TANK()).to.equal(5);
      });
    });

    it("Dovrebbe impostare correttamente i limiti massimi", async function() {
      const maxFactions = 1000;
      const maxClasses = 2000;
      await factionClassLibTest.setMaxGenLimits(maxFactions, maxClasses);
      
      const limits = await factionClassLibTest.getMaxGenLimits();
      expect(Number(limits[0])).to.equal(maxFactions);
      expect(Number(limits[1])).to.equal(maxClasses);
    });

    it("Dovrebbe emettere evento per aggiornamento limiti", async function() {
      const maxFactions = 1000;
      const maxClasses = 2000;
      await expect(factionClassLibTest.setMaxGenLimits(maxFactions, maxClasses))
        .to.emit(factionClassLibTest, "MaxGenLimitsUpdated")
        .withArgs(maxFactions, maxClasses);
    });
  });

  describe("Generazione Fazioni e Classi", function() {
    beforeEach(async function() {
      await factionClassLibTest.setMaxGenLimits(1000, 2000);
    });

    describe("Generazione Fazioni", function() {
      it("Dovrebbe generare una fazione valida", async function() {
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        const attempt = 0;
        const tx = await factionClassLibTest.generateValidFaction(randomValue, attempt);
        const receipt = await tx.wait();
        const event = receipt.logs[0];
        const factionId = event.args[0];
        expect(Number(factionId)).to.be.gte(1);
        expect(Number(factionId)).to.be.lte(4);
      });

      it("Dovrebbe incrementare il contatore di fazioni", async function() {
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        const attempt = 0;
        await factionClassLibTest.generateValidFaction(randomValue, attempt);
        const facGen = await factionClassLibTest.getFactionGenCount();
        expect(Number(facGen)).to.equal(1);
      });

      it("Dovrebbe fallire se raggiunto limite fazioni", async function() {
        await factionClassLibTest.setMaxGenLimits(1, 2000);
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        await factionClassLibTest.generateValidFaction(randomValue, 0);
        await expect(
          factionClassLibTest.generateValidFaction(randomValue, 1)
        ).to.be.revertedWith("Limite fazioni raggiunto");
      });
    });

    describe("Generazione Classi", function() {
      it("Dovrebbe generare una classe valida", async function() {
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        const attempt = 0;
        const tx = await factionClassLibTest.generateValidClass(randomValue, attempt);
        const receipt = await tx.wait();
        const event = receipt.logs[0];
        const classId = event.args[0];
        expect(Number(classId)).to.be.gte(1);
        expect(Number(classId)).to.be.lte(5);
      });

      it("Dovrebbe incrementare il contatore di classi", async function() {
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        const attempt = 0;
        await factionClassLibTest.generateValidClass(randomValue, attempt);
        const classGen = await factionClassLibTest.getClassGenCount();
        expect(Number(classGen)).to.equal(1);
      });

      it("Dovrebbe fallire se raggiunto limite classi", async function() {
        await factionClassLibTest.setMaxGenLimits(1000, 1);
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        await factionClassLibTest.generateValidClass(randomValue, 0);
        await expect(
          factionClassLibTest.generateValidClass(randomValue, 1)
        ).to.be.revertedWith("Limite classi raggiunto");
      });
    });
  });

  describe("Distribuzione Bilanciata", function() {
    beforeEach(async function() {
      await factionClassLibTest.setMaxGenLimits(100, 100);
    });

    it("Dovrebbe mantenere una distribuzione bilanciata delle fazioni", async function() {
      const maxPerFaction = 25; // 100/4 fazioni

      // Genera fazioni fino al limite per una fazione
      for(let i = 0; i < maxPerFaction; i++) {
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        await factionClassLibTest.generateValidFaction(randomValue, i);
      }

      // Verifica che tutte le fazioni abbiano un numero simile di generazioni
      const factionCounts = await Promise.all([1,2,3,4].map(async (i) => {
        return Number(await factionClassLibTest.getFactionCount(i));
      }));

      // La differenza tra la fazione più generata e quella meno generata
      // non dovrebbe essere troppo grande
      const max = Math.max(...factionCounts);
      const min = Math.min(...factionCounts);
      expect(max - min).to.be.lte(5); // Tolleranza di 5 unità
    });

    it("Dovrebbe mantenere una distribuzione bilanciata delle classi", async function() {
      const maxPerClass = 20; // 100/5 classi

      // Genera classi fino al limite per una classe
      for(let i = 0; i < maxPerClass; i++) {
        const randomValue = ethers.hexlify(ethers.randomBytes(32));
        await factionClassLibTest.generateValidClass(randomValue, i);
      }

      // Verifica che tutte le classi abbiano un numero simile di generazioni
      const classCounts = await Promise.all([1,2,3,4,5].map(async (i) => {
        return Number(await factionClassLibTest.getClassCount(i));
      }));

      // La differenza tra la classe più generata e quella meno generata
      // non dovrebbe essere troppo grande
      const max = Math.max(...classCounts);
      const min = Math.min(...classCounts);
      expect(max - min).to.be.lte(5); // Tolleranza di 5 unità
    });
  });

  describe("Eventi", function() {
    it("Dovrebbe emettere evento per generazione fazione", async function() {
      const randomValue = ethers.hexlify(ethers.randomBytes(32));
      const attempt = 0;
      await factionClassLibTest.setMaxGenLimits(1000, 2000);
      
      await expect(factionClassLibTest.generateValidFaction(randomValue, attempt))
        .to.emit(factionClassLibTest, "FactionGenerated");
    });

    it("Dovrebbe emettere evento per generazione classe", async function() {
      const randomValue = ethers.hexlify(ethers.randomBytes(32));
      const attempt = 0;
      await factionClassLibTest.setMaxGenLimits(1000, 2000);
      
      await expect(factionClassLibTest.generateValidClass(randomValue, attempt))
        .to.emit(factionClassLibTest, "ClassGenerated");
    });
  });
}); 