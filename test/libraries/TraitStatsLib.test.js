const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TraitStatsLib", function () {
  let TraitStatsLibTest;
  let traitStatsLibTest;
  let owner;
  let addr1;

  // Costanti per le maschere e posizioni
  const XP_MASK = "0x1FFFF";        // 0-16 (17 bit)
  const LEVEL_MASK = "0xFF";        // 17-24
  const HEALTH_MASK = "0xFF";       // 25-32
  const STRENGTH_MASK = "0xFF";     // 33-40
  const SPEED_MASK = "0xFF";        // 41-48
  const INTELLIGENCE_MASK = "0xFF"; // 49-56
  const ACCURACY_MASK = "0xFF";     // 57-64
  const CURRENT_HEALTH_MASK = "0xFF"; // 65-72
  const BREEDING_MASK = "0xFF";     // 80-87
  const CLASS_MASK = "0xFF";        // 128-135

  const XP_POSITION = "0";
  const LEVEL_POSITION = "17";
  const HEALTH_POSITION = "25";
  const STRENGTH_POSITION = "33";
  const SPEED_POSITION = "41";
  const INTELLIGENCE_POSITION = "49";
  const ACCURACY_POSITION = "57";
  const CURRENT_HEALTH_POSITION = "65";
  const BREEDING_POSITION = "80";
  const CLASS_POSITION = "128";

  // Costanti per i valori iniziali delle statistiche
  const INITIAL_XP = "0";
  const INITIAL_LEVEL = "1";
  const INITIAL_HEALTH = "100";
  const INITIAL_STATS = "10";
  const INITIAL_BREEDING = "0";

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy della libreria TraitStatsLib
    const TraitStatsLib = await ethers.getContractFactory("TraitStatsLib");
    const traitStatsLib = await TraitStatsLib.deploy();
    await traitStatsLib.waitForDeployment();

    // Deploy del contratto di test per TraitStatsLib con il collegamento alla libreria
    const TraitStatsLibTestFactory = await ethers.getContractFactory("TraitStatsLibTest", {
      libraries: {
        TraitStatsLib: await traitStatsLib.getAddress()
      }
    });
    traitStatsLibTest = await TraitStatsLibTestFactory.deploy();
    await traitStatsLibTest.waitForDeployment();
  });

  describe("Inizializzazione", function () {
    it("Dovrebbe inizializzare correttamente i tratti e le classi", async function () {
      await traitStatsLibTest.initialize();
      
      // Verifica che sia inizializzato
      expect(await traitStatsLibTest.isInitialized()).to.equal(true);
      
      // Verifica che i nomi dei tratti fur siano impostati correttamente
      expect(await traitStatsLibTest.getFurTraitName(0)).to.equal("Green Raccoon");
      expect(await traitStatsLibTest.getFurTraitName(4)).to.equal("Red Panda");
      expect(await traitStatsLibTest.getFurTraitName(9)).to.equal("Bitcoin Raccoon");
      
      // Verifica che i nomi dei tratti head siano impostati correttamente
      expect(await traitStatsLibTest.getHeadTraitName(0)).to.equal("MLG Glasses");
      expect(await traitStatsLibTest.getHeadTraitName(5)).to.equal("Snake Bandana");
      expect(await traitStatsLibTest.getHeadTraitName(9)).to.equal("Master Chief Helmet");
      
      // Verifica che i nomi dei tratti star siano impostati correttamente
      expect(await traitStatsLibTest.getStarTraitName(0)).to.equal("Lo-Fi");
      expect(await traitStatsLibTest.getStarTraitName(4)).to.equal("Racing Game");
      expect(await traitStatsLibTest.getStarTraitName(9)).to.equal("Error 404");
      
      // Verifica che i nomi dei tratti weapon siano impostati correttamente
      expect(await traitStatsLibTest.getWeaponTraitName(0)).to.equal("Spada");
      expect(await traitStatsLibTest.getWeaponTraitName(4)).to.equal("Pesce Blub");
      expect(await traitStatsLibTest.getWeaponTraitName(9)).to.equal("Raygun");
    });

    it("Dovrebbe inizializzare correttamente i modificatori delle classi", async function () {
      await traitStatsLibTest.initialize();
      
      // Warrior (1): +40% forza, -20% intelligenza
      const warriorMods = await traitStatsLibTest.getClassModifiers(1);
      expect(warriorMods.healthModPct).to.equal(0);
      expect(warriorMods.strengthModPct).to.equal(40);
      expect(warriorMods.speedModPct).to.equal(0);
      expect(warriorMods.intelligenceModPct).to.equal(-20);
      expect(warriorMods.accuracyModPct).to.equal(0);
      
      // Tank (2): +40% salute, -20% velocità
      const tankMods = await traitStatsLibTest.getClassModifiers(2);
      expect(tankMods.healthModPct).to.equal(40);
      expect(tankMods.strengthModPct).to.equal(0);
      expect(tankMods.speedModPct).to.equal(-20);
      expect(tankMods.intelligenceModPct).to.equal(0);
      expect(tankMods.accuracyModPct).to.equal(0);
      
      // Ranger (5): +40% precisione, -20% forza
      const rangerMods = await traitStatsLibTest.getClassModifiers(5);
      expect(rangerMods.healthModPct).to.equal(0);
      expect(rangerMods.strengthModPct).to.equal(-20);
      expect(rangerMods.speedModPct).to.equal(0);
      expect(rangerMods.intelligenceModPct).to.equal(0);
      expect(rangerMods.accuracyModPct).to.equal(40);
    });
  });

  describe("Creazione dati iniziali con tratti", function () {
    it("Dovrebbe applicare correttamente i modificatori di classe alle statistiche iniziali", async function () {
      await traitStatsLibTest.initialize();
      
      const fenotipo = [0, 0, 0, 0, 0]; // Tratti base per test
      
      // Test per classe Warrior (1)
      const dataWarrior = await traitStatsLibTest.createInitialDataWithTraits(1, fenotipo);
      const statsWarrior = await extractStats(dataWarrior);
      
      // Verifica che la forza sia stata aumentata del 40%
      expect(statsWarrior.strength).to.equal(Math.floor(INITIAL_STATS * 1.4));
      // Verifica che l'intelligenza sia stata ridotta del 20%
      expect(statsWarrior.intelligence).to.equal(Math.floor(INITIAL_STATS * 0.8));
      
      // Test per classe Mage (4)
      const dataMage = await traitStatsLibTest.createInitialDataWithTraits(4, fenotipo);
      const statsMage = await extractStats(dataMage);
      
      // Verifica che l'intelligenza sia stata aumentata del 40%
      expect(statsMage.intelligence).to.equal(Math.floor(INITIAL_STATS * 1.4));
      // Verifica che la salute sia stata ridotta del 20%
      expect(statsMage.health).to.equal(Math.floor(INITIAL_HEALTH * 0.8));
    });
  });

  describe("Aggiornamento statistiche nel level up", function () {
    it("Dovrebbe applicare correttamente i bonus del tratto fur durante il level up", async function () {
      await traitStatsLibTest.initialize();
      
      // Creiamo dati iniziali
      let initialData = await createInitialData();
      
      // Aggiorniamo le statistiche con fenotipo che ha Green Raccoon (id 0)
      // Nota: il tratto base MLG Glasses (id 0) dà +1 ACC
      const fenotipoGreen = [0, 0, 0, 0, 0];
      const updatedDataGreen = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoGreen, 2);
      const statsGreen = await extractStats(updatedDataGreen);
      
      // Verifica il bonus di +5 HP per Green Raccoon
      expect(statsGreen.health).to.equal(Number(INITIAL_HEALTH) + 5);
      // Verifica il bonus di +1 ACC da MLG Glasses
      expect(statsGreen.accuracy).to.equal(Number(INITIAL_STATS) + 1);
      
      // Aggiorniamo le statistiche con fenotipo che ha Golden Raccoon (id 7)
      const fenotipoGolden = [0, 7, 0, 0, 0];
      const updatedDataGolden = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoGolden, 2);
      const statsGolden = await extractStats(updatedDataGolden);
      
      // Verifica i bonus di Golden Raccoon (+1 STR, +1 INT, +1 ACC) più MLG Glasses (+1 ACC)
      expect(statsGolden.strength).to.equal(Number(INITIAL_STATS) + 1);
      expect(statsGolden.intelligence).to.equal(Number(INITIAL_STATS) + 1);
      expect(statsGolden.accuracy).to.equal(Number(INITIAL_STATS) + 2); // +1 da Golden, +1 da MLG
    });

    it("Dovrebbe applicare correttamente i bonus del tratto head durante il level up", async function () {
      await traitStatsLibTest.initialize();
      
      // Creiamo dati iniziali
      let initialData = await createInitialData();
      
      // Aggiorniamo le statistiche con fenotipo che ha MLG Glasses (id 0)
      // Nota: il tratto base Green Raccoon (id 0) dà +5 HP
      const fenotipoGlasses = [0, 0, 0, 0, 0];
      const updatedDataGlasses = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoGlasses, 2);
      const statsGlasses = await extractStats(updatedDataGlasses);
      
      // Verifica il bonus di +1 ACC per MLG Glasses e +5 HP per Green Raccoon
      expect(statsGlasses.accuracy).to.equal(Number(INITIAL_STATS) + 1);
      expect(statsGlasses.health).to.equal(Number(INITIAL_HEALTH) + 5);
      
      // Aggiorniamo le statistiche con fenotipo che ha Master Chief Helmet (id 9)
      const fenotipoHelmet = [9, 0, 0, 0, 0];
      const updatedDataHelmet = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoHelmet, 2);
      const statsHelmet = await extractStats(updatedDataHelmet);
      
      // Verifica i bonus di Master Chief Helmet (+5 HP, +1 STR, +1 SPD, +1 ACC) più Green Raccoon (+5 HP)
      expect(statsHelmet.health).to.equal(Number(INITIAL_HEALTH) + 10); // +5 da Master Chief, +5 da Green Raccoon
      expect(statsHelmet.strength).to.equal(Number(INITIAL_STATS) + 1);
      expect(statsHelmet.speed).to.equal(Number(INITIAL_STATS) + 1);
      expect(statsHelmet.accuracy).to.equal(Number(INITIAL_STATS) + 1);
    });

    it("Dovrebbe applicare correttamente i bonus percentuali dei tratti weapon durante il level up", async function () {
      await traitStatsLibTest.initialize();
      
      // Creiamo dati iniziali con forza 20 per semplificare i calcoli
      let initialData = await createInitialData(0, 1, 20);
      
      // Aggiorniamo le statistiche con fenotipo che ha Spada (id 0)
      const fenotipoSpada = [0, 0, 0, 0, 0]; // Solo Spada
      const updatedDataSpada = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoSpada, 2);
      const statsSpada = await extractStats(updatedDataSpada);
      
      // Verifica il bonus di +2% STR per Spada (20 * 0.02 = 0.4, arrotondato = 0)
      const expectedStrSpada = 20;
      expect(statsSpada.strength).to.be.closeTo(expectedStrSpada, 1);
      
      // Aggiorniamo le statistiche con fenotipo che ha Raygun (id 9)
      const fenotipoRaygun = [0, 0, 0, 9, 0]; // Solo Raygun
      const updatedDataRaygun = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoRaygun, 2);
      const statsRaygun = await extractStats(updatedDataRaygun);
      
      // Verifica il bonus di +5% STR per Raygun (20 * 0.05 = 1)
      const expectedStrRaygun = 20 + 1;
      expect(statsRaygun.strength).to.be.closeTo(expectedStrRaygun, 1);
    });

    it("Dovrebbe applicare correttamente i bonus percentuali dei tratti star a intervalli di livello", async function () {
      await traitStatsLibTest.initialize();
      
      // Creiamo dati iniziali con le statistiche base definite nel contratto
      let initialData = await createInitialData();
      
      // Test con tratto star comune (id 0)
      // Lo-Fi dà +5% a una stat ogni 5 livelli
      const fenotipoComune = [0, 0, 0, 0, 0];
      
      // Al livello 5 dovrebbe attivare il bonus
      const updatedDataLvl5 = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipoComune, 5);
      const statsLvl5 = await extractStats(updatedDataLvl5);
      
      // Con statistiche base di 10, un bonus del 5% (0.5) viene arrotondato a 1
      // Verifichiamo che esattamente una statistica abbia ricevuto il bonus
      const bonusCount = [
        statsLvl5.health > Number(INITIAL_HEALTH) + 5, // +5 da Green Raccoon
        statsLvl5.strength > Number(INITIAL_STATS),
        statsLvl5.speed > Number(INITIAL_STATS),
        statsLvl5.intelligence > Number(INITIAL_STATS),
        statsLvl5.accuracy > Number(INITIAL_STATS) + 1 // +1 da MLG Glasses
      ].filter(Boolean).length;
      
      expect(bonusCount).to.equal(1, "Esattamente una statistica dovrebbe ricevere il bonus del 5%");
      
      // Al livello 6 non dovrebbe attivare il bonus
      const updatedDataLvl6 = await traitStatsLibTest.updateStatsOnLevelUp(updatedDataLvl5, fenotipoComune, 6);
      const statsLvl6 = await extractStats(updatedDataLvl6);
      
      // Verifica che le statistiche mantengano i bonus precedenti più i bonus fissi
      // Green Raccoon (fur id 0) dà +5 HP per livello
      // MLG Glasses (head id 0) dà +1 ACC per livello
      expect(statsLvl6.health).to.equal(statsLvl5.health + 5); // +5 per livello 6
      expect(statsLvl6.strength).to.equal(statsLvl5.strength);
      expect(statsLvl6.speed).to.equal(statsLvl5.speed);
      expect(statsLvl6.intelligence).to.equal(statsLvl5.intelligence);
      expect(statsLvl6.accuracy).to.equal(statsLvl5.accuracy + 1); // +1 per livello 6
    });
  });

  describe("Funzioni amministrative", function () {
    it("Dovrebbe permettere di aggiornare i modificatori delle classi", async function () {
      await traitStatsLibTest.initialize();
      
      // Modifica i modificatori per la classe Warrior
      await traitStatsLibTest.updateClassModifiers(1, 10, 50, -10, -30, 0);
      
      // Verifica che i modificatori siano stati aggiornati
      const updatedMods = await traitStatsLibTest.getClassModifiers(1);
      expect(updatedMods.healthModPct).to.equal(10);
      expect(updatedMods.strengthModPct).to.equal(50);
      expect(updatedMods.speedModPct).to.equal(-10);
      expect(updatedMods.intelligenceModPct).to.equal(-30);
      expect(updatedMods.accuracyModPct).to.equal(0);
      
      // Verifica che le modifiche si riflettano nei dati creati
      const fenotipo = [0, 0, 0, 0, 0];
      const dataWarrior = await traitStatsLibTest.createInitialDataWithTraits(1, fenotipo);
      const statsWarrior = await extractStats(dataWarrior);
      
      // Verifica i nuovi modificatori
      expect(statsWarrior.health).to.equal(Math.floor(INITIAL_HEALTH * 1.1));
      expect(statsWarrior.strength).to.equal(Math.floor(INITIAL_STATS * 1.5));
      expect(statsWarrior.speed).to.equal(Math.floor(INITIAL_STATS * 0.9));
      expect(statsWarrior.intelligence).to.equal(Math.floor(INITIAL_STATS * 0.7));
    });

    it("Dovrebbe permettere di aggiornare i modificatori dei tratti fur", async function () {
      await traitStatsLibTest.initialize();
      
      // Modifica i modificatori per Green Raccoon (id 0)
      await traitStatsLibTest.updateFurModifiers(0, 10, 2, 1, 0, 0);
      
      // Verifica che le modifiche si riflettano nel level up
      let initialData = await createInitialData();
      const fenotipo = [0, 0, 0, 0, 0]; // Green Raccoon + MLG Glasses
      const updatedData = await traitStatsLibTest.updateStatsOnLevelUp(initialData, fenotipo, 2);
      const stats = await extractStats(updatedData);
      
      // Verifica i nuovi bonus
      // +10 HP da Green Raccoon modificato
      expect(stats.health).to.equal(Number(INITIAL_HEALTH) + 10);
      expect(stats.strength).to.equal(Number(INITIAL_STATS) + 2);
      expect(stats.speed).to.equal(Number(INITIAL_STATS) + 1);
      // +1 ACC da MLG Glasses
      expect(stats.accuracy).to.equal(Number(INITIAL_STATS) + 1);
    });
  });

  // Funzioni helper per i test
  async function createInitialData(xp = INITIAL_XP, level = INITIAL_LEVEL, baseStats = INITIAL_STATS) {
    // Crea i dati iniziali di un procione
    let data = BigInt(0);
    data = await traitStatsLibTest.updateField(data, xp, XP_MASK, XP_POSITION);
    data = await traitStatsLibTest.updateField(data, level, LEVEL_MASK, LEVEL_POSITION);
    data = await traitStatsLibTest.updateField(data, INITIAL_HEALTH, HEALTH_MASK, HEALTH_POSITION);
    data = await traitStatsLibTest.updateField(data, INITIAL_HEALTH, CURRENT_HEALTH_MASK, CURRENT_HEALTH_POSITION);
    data = await traitStatsLibTest.updateField(data, baseStats, STRENGTH_MASK, STRENGTH_POSITION);
    data = await traitStatsLibTest.updateField(data, baseStats, SPEED_MASK, SPEED_POSITION);
    data = await traitStatsLibTest.updateField(data, baseStats, INTELLIGENCE_MASK, INTELLIGENCE_POSITION);
    data = await traitStatsLibTest.updateField(data, baseStats, ACCURACY_MASK, ACCURACY_POSITION);
    data = await traitStatsLibTest.updateField(data, INITIAL_BREEDING, BREEDING_MASK, BREEDING_POSITION);
    return data;
  }

  async function extractStats(data) {
    const health = Number(await traitStatsLibTest.extractField(data, HEALTH_MASK, HEALTH_POSITION));
    const strength = Number(await traitStatsLibTest.extractField(data, STRENGTH_MASK, STRENGTH_POSITION));
    const speed = Number(await traitStatsLibTest.extractField(data, SPEED_MASK, SPEED_POSITION));
    const intelligence = Number(await traitStatsLibTest.extractField(data, INTELLIGENCE_MASK, INTELLIGENCE_POSITION));
    const accuracy = Number(await traitStatsLibTest.extractField(data, ACCURACY_MASK, ACCURACY_POSITION));
    
    return { health, strength, speed, intelligence, accuracy };
  }
}); 