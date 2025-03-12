const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StatsLib", function() {
  let statsLibTest;
  let owner;

  beforeEach(async function() {
    const [_owner] = await ethers.getSigners();
    owner = _owner;

    // Deploy StatsLibTest contract
    const StatsLibTest = await ethers.getContractFactory("StatsLibTest");
    statsLibTest = await StatsLibTest.deploy();
    await statsLibTest.waitForDeployment();
  });

  describe("Costanti", function() {
    it("Dovrebbe avere le maschere corrette", async function() {
      expect(await statsLibTest.getXPMask()).to.equal(0xFF);
      expect(await statsLibTest.getLevelMask()).to.equal(0xFF);
      expect(await statsLibTest.getHealthMask()).to.equal(0xFF);
      expect(await statsLibTest.getStrengthMask()).to.equal(0xFF);
      expect(await statsLibTest.getSpeedMask()).to.equal(0xFF);
      expect(await statsLibTest.getIntelligenceMask()).to.equal(0xFF);
      expect(await statsLibTest.getAccuracyMask()).to.equal(0xFF);
      expect(await statsLibTest.getBreedingMask()).to.equal(0xFF);
      expect(await statsLibTest.getGeneticsMask()).to.equal("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
      expect(await statsLibTest.getClassMask()).to.equal(0xFF);
      expect(await statsLibTest.getFactionMask()).to.equal(0xFF);
    });

    it("Dovrebbe avere le posizioni corrette", async function() {
      expect(await statsLibTest.getXPPosition()).to.equal(0);
      expect(await statsLibTest.getLevelPosition()).to.equal(8);
      expect(await statsLibTest.getHealthPosition()).to.equal(16);
      expect(await statsLibTest.getStrengthPosition()).to.equal(24);
      expect(await statsLibTest.getSpeedPosition()).to.equal(32);
      expect(await statsLibTest.getIntelligencePosition()).to.equal(40);
      expect(await statsLibTest.getAccuracyPosition()).to.equal(48);
      expect(await statsLibTest.getBreedingPosition()).to.equal(80);
      expect(await statsLibTest.getGeneticsPosition()).to.equal(64);
      expect(await statsLibTest.getClassPosition()).to.equal(128);
      expect(await statsLibTest.getFactionPosition()).to.equal(136);
    });
  });

  describe("Funzioni", function() {
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
  });
}); 