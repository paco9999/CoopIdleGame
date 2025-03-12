const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StatsLib", function() {
  let statsLibTest;
  let owner;

  beforeEach(async function() {
    const [_owner] = await ethers.getSigners();
    owner = _owner;

    // Deploy StatsLibTest contract
    const StatsLibTest = await ethers.getContractFactory("contracts/test/mocks/StatsLibTest.sol:StatsLibTest");
    statsLibTest = await StatsLibTest.deploy();
    await statsLibTest.waitForDeployment();
  });

  describe("Costanti e Maschere", function() {
    it("Dovrebbe avere le maschere corrette", async function() {
      expect(await statsLibTest.getXPMask()).to.equal(0x1FFFF);        // 17 bit
      expect(await statsLibTest.getLevelMask()).to.equal(0xFF);        // 8 bit
      expect(await statsLibTest.getHealthMask()).to.equal(0xFF);       // 8 bit
      expect(await statsLibTest.getStrengthMask()).to.equal(0xFF);     // 8 bit
      expect(await statsLibTest.getSpeedMask()).to.equal(0xFF);        // 8 bit
      expect(await statsLibTest.getIntelligenceMask()).to.equal(0xFF); // 8 bit
      expect(await statsLibTest.getAccuracyMask()).to.equal(0xFF);     // 8 bit
      expect(await statsLibTest.getBreedingMask()).to.equal(0xFF);     // 8 bit
      expect(await statsLibTest.getGeneticsMask()).to.equal("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"); // 32 bit
      expect(await statsLibTest.getClassMask()).to.equal(0xFF);        // 8 bit
      expect(await statsLibTest.getFactionMask()).to.equal(0xFF);      // 8 bit
      expect(await statsLibTest.getProfessionMask()).to.equal(0xF);    // 4 bit
      expect(await statsLibTest.getProfessionLvlMask()).to.equal(0xF); // 4 bit
      expect(await statsLibTest.getProfessionExpMask()).to.equal(0xFFFF); // 16 bit
    });

    it("Dovrebbe avere le posizioni corrette", async function() {
      expect(await statsLibTest.getXPPosition()).to.equal(0);
      expect(await statsLibTest.getLevelPosition()).to.equal(17);
      expect(await statsLibTest.getHealthPosition()).to.equal(25);
      expect(await statsLibTest.getStrengthPosition()).to.equal(33);
      expect(await statsLibTest.getSpeedPosition()).to.equal(41);
      expect(await statsLibTest.getIntelligencePosition()).to.equal(49);
      expect(await statsLibTest.getAccuracyPosition()).to.equal(57);
      expect(await statsLibTest.getBreedingPosition()).to.equal(80);
      expect(await statsLibTest.getGeneticsPosition()).to.equal(64);
      expect(await statsLibTest.getClassPosition()).to.equal(128);
      expect(await statsLibTest.getFactionPosition()).to.equal(136);
      expect(await statsLibTest.getProfessionPosition()).to.equal(144);
      expect(await statsLibTest.getProfessionLvlPosition()).to.equal(148);
      expect(await statsLibTest.getProfessionExpPosition()).to.equal(152);
    });
  });

  describe("Funzioni di Base", function() {
    it("Dovrebbe estrarre un campo correttamente", async function() {
      const data = "0x0102030405060708";
      const mask = 0xFF;
      const position = 8;
      const result = await statsLibTest.extractField(data, mask, position);
      expect(result).to.equal(0x07);
    });

    it("Dovrebbe aggiornare un campo correttamente", async function() {
      const data = "0x0102030405060708";
      const value = 0xFF;
      const mask = 0xFF;
      const position = 8;
      const result = await statsLibTest.updateField(data, value, mask, position);
      const extractedValue = await statsLibTest.extractField(result, mask, position);
      expect(extractedValue).to.equal(value);
    });

    it("Dovrebbe creare dati iniziali corretti", async function() {
      const data = await statsLibTest.createInitialData();
      
      // Verifica i valori iniziali
      const xp = await statsLibTest.extractField(data, await statsLibTest.getXPMask(), await statsLibTest.getXPPosition());
      const level = await statsLibTest.extractField(data, await statsLibTest.getLevelMask(), await statsLibTest.getLevelPosition());
      const health = await statsLibTest.extractField(data, await statsLibTest.getHealthMask(), await statsLibTest.getHealthPosition());
      const strength = await statsLibTest.extractField(data, await statsLibTest.getStrengthMask(), await statsLibTest.getStrengthPosition());
      
      expect(xp).to.equal(0);
      expect(level).to.equal(1);
      expect(health).to.equal(100);
      expect(strength).to.equal(10);
    });
  });

  describe("Funzioni delle Statistiche", function() {
    let initialData;

    beforeEach(async function() {
      initialData = await statsLibTest.createInitialData();
    });

    it("Dovrebbe impostare e ottenere il livello correttamente", async function() {
      const newLevel = 5;
      const updatedData = await statsLibTest.setLevel(initialData, newLevel);
      const level = await statsLibTest.getLevel(updatedData);
      expect(level).to.equal(newLevel);
    });

    it("Dovrebbe impostare e ottenere l'XP correttamente", async function() {
      const newXP = 1000;
      const updatedData = await statsLibTest.setXP(initialData, newXP);
      const xp = await statsLibTest.getXP(updatedData);
      expect(xp).to.equal(newXP);
    });

    it("Dovrebbe impostare e ottenere i breeding slots correttamente", async function() {
      const newSlots = 3;
      const updatedData = await statsLibTest.setBreedingSlots(initialData, newSlots);
      const slots = await statsLibTest.getBreedingSlots(updatedData);
      expect(slots).to.equal(newSlots);
    });

    it("Dovrebbe impostare e ottenere la professione correttamente", async function() {
      const profession = 1; // ARTIGIANO
      const updatedData = await statsLibTest.setProfession(initialData, profession);
      const result = await statsLibTest.getProfession(updatedData);
      expect(result).to.equal(profession);
    });

    it("Dovrebbe impostare e ottenere il livello della professione correttamente", async function() {
      const profLevel = 3;
      const updatedData = await statsLibTest.setProfessionLevel(initialData, profLevel);
      const result = await statsLibTest.getProfessionLevel(updatedData);
      expect(result).to.equal(profLevel);
    });

    it("Dovrebbe impostare e ottenere l'esperienza della professione correttamente", async function() {
      const profExp = 1000;
      const updatedData = await statsLibTest.setProfessionExp(initialData, profExp);
      const result = await statsLibTest.getProfessionExp(updatedData);
      expect(result).to.equal(profExp);
    });
  });

  describe("Limiti e Validazioni", function() {
    let initialData;

    beforeEach(async function() {
      initialData = await statsLibTest.createInitialData();
    });

    it("Non dovrebbe permettere livelli superiori al massimo", async function() {
      const maxLevel = await statsLibTest.getMaxLevel();
      await expect(statsLibTest.setLevel(initialData, BigInt(maxLevel) + 1n))
        .to.be.revertedWith("Level too high");
    });

    it("Non dovrebbe permettere XP superiore al massimo", async function() {
      const maxXP = await statsLibTest.getMaxXP();
      await expect(statsLibTest.setXP(initialData, BigInt(maxXP) + 1n))
        .to.be.revertedWith("XP too high");
    });

    it("Non dovrebbe permettere breeding slots superiori al massimo", async function() {
      const maxSlots = await statsLibTest.getMaxBreedingSlots();
      await expect(statsLibTest.setBreedingSlots(initialData, BigInt(maxSlots) + 1n))
        .to.be.revertedWith("Too many breeding slots");
    });

    it("Non dovrebbe permettere valori di professione non validi", async function() {
      await expect(statsLibTest.setProfession(initialData, 16))
        .to.be.revertedWithPanic(0x21); // Codice di panic per enum out of bounds
    });

    it("Non dovrebbe permettere livelli di professione superiori al massimo", async function() {
      await expect(statsLibTest.setProfessionLevel(initialData, 16))
        .to.be.revertedWith("Profession level too high");
    });

    it("Non dovrebbe permettere esperienza di professione superiore al massimo", async function() {
      await expect(statsLibTest.setProfessionExp(initialData, 65536))
        .to.be.revertedWith("Profession exp too high");
    });
  });
}); 