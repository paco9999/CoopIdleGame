// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./StatsLib.sol";
import "./GeneticsLib.sol";

/**
 * @title TraitStatsLib
 * @dev Libreria per calcolare statistiche basate su tratti fenotipici
 * Questa libreria implementa un sistema di statistiche basato sui tratti visibili
 * del procione, permettendo di differenziare le statistiche in base all'aspetto.
 *
 * I dati sono organizzati in diverse strutture:
 * - FurTrait: Caratteristiche della pelliccia, influenzano principalmente salute e robustezza
 * - HeadTrait: Caratteristiche della testa, influenzano principalmente agilità e precisione
 * - StarTrait: Caratteristiche stellari, danno bonus periodici casuali
 * - WeaponTrait: Caratteristiche delle armi, danno bonus più specifici al combattimento
 * - ClassTrait: Caratteristiche della classe, influenzano in percentuale tutte le statistiche
 */
library TraitStatsLib {
    // Struttura dati dei tratti
    struct FurTrait {
        string name;        // Nome del tratto
        uint8 healthBonus;  // Bonus salute per livello
        uint8 strengthBonus; // Bonus forza per livello
        uint8 speedBonus;   // Bonus velocità per livello
        uint8 intBonus;     // Bonus intelligenza per livello
        uint8 accBonus;     // Bonus precisione per livello
    }
    
    struct HeadTrait {
        string name;        // Nome del tratto
        uint8 healthBonus;  // Bonus salute per livello
        uint8 strengthBonus; // Bonus forza per livello
        uint8 speedBonus;   // Bonus velocità per livello
        uint8 intBonus;     // Bonus intelligenza per livello
        uint8 accBonus;     // Bonus precisione per livello
    }
    
    struct StarTrait {
        string name;        // Nome del tratto
        uint8 rarity;       // Rarità (1-5)
        uint8 bonusPct;     // Percentuale bonus (applicata ogni X livelli)
        uint8 levelInterval; // Ogni quanti livelli si attiva il bonus
    }
    
    struct WeaponTrait {
        string name;        // Nome del tratto
        uint8 strengthPct;  // Percentuale bonus forza per livello
    }
    
    struct ClassTrait {
        int healthModPct;    // Modificatore percentuale salute
        int strengthModPct;  // Modificatore percentuale forza
        int speedModPct;     // Modificatore percentuale velocità
        int intelligenceModPct; // Modificatore percentuale intelligenza
        int accuracyModPct;  // Modificatore percentuale precisione
    }
    
    // Struttura principale della libreria
    struct TraitStats {
        bool initialized;
        
        // Tratti di pelliccia, dalla più comune alla più rara
        mapping(uint8 => FurTrait) furTraits;
        
        // Tratti della testa
        mapping(uint8 => HeadTrait) headTraits;
        
        // Tratti stellari, dall'ordinario al leggendario
        mapping(uint8 => StarTrait) starTraits;
        
        // Tratti dell'arma
        mapping(uint8 => WeaponTrait) weaponTraits;
        
        // Modificatori di classe
        mapping(uint8 => ClassTrait) classTraits;
    }
    
    // Costanti per le maschere e posizioni dei dati
    bytes32 constant XP_MASK = bytes32(uint256(0x1FFFF));        // 0-16 (17 bit)
    bytes32 constant LEVEL_MASK = bytes32(uint256(0xFF));        // 17-24
    bytes32 constant HEALTH_MASK = bytes32(uint256(0xFF));       // 25-32
    bytes32 constant STRENGTH_MASK = bytes32(uint256(0xFF));     // 33-40
    bytes32 constant SPEED_MASK = bytes32(uint256(0xFF));        // 41-48
    bytes32 constant INTELLIGENCE_MASK = bytes32(uint256(0xFF)); // 49-56
    bytes32 constant ACCURACY_MASK = bytes32(uint256(0xFF));     // 57-64
    bytes32 constant CURRENT_HEALTH_MASK = bytes32(uint256(0xFF)); // 65-72
    bytes32 constant BREEDING_MASK = bytes32(uint256(0xFF));     // 80-87
    bytes32 constant CLASS_MASK = bytes32(uint256(0xFF));        // 128-135
    
    uint8 constant XP_POSITION = 0;
    uint8 constant LEVEL_POSITION = 17;
    uint8 constant HEALTH_POSITION = 25;
    uint8 constant STRENGTH_POSITION = 33;
    uint8 constant SPEED_POSITION = 41;
    uint8 constant INTELLIGENCE_POSITION = 49;
    uint8 constant ACCURACY_POSITION = 57;
    uint8 constant CURRENT_HEALTH_POSITION = 65;
    uint8 constant BREEDING_POSITION = 80;
    uint8 constant CLASS_POSITION = 128;
    
    // Valori iniziali
    uint8 constant INITIAL_LEVEL = 1;
    uint8 constant INITIAL_HEALTH = 100;
    uint8 constant INITIAL_STATS = 10;
    uint8 constant INITIAL_BREEDING = 0;
    
    /**
     * @dev Inizializza la libreria con valori predefiniti
     */
    function initialize(TraitStats storage self) public {
        require(!self.initialized, "TraitStatsLib: already initialized");
        
        // Inizializza i tratti della pelliccia
        self.furTraits[0] = FurTrait("Green Raccoon", 5, 0, 0, 0, 0);       // +5 HP per livello
        self.furTraits[1] = FurTrait("Azure Raccoon", 0, 0, 1, 0, 0);        // +2 HP, +3 SPD per livello
        self.furTraits[2] = FurTrait("Gray Raccoon", 0, 0, 0, 1, 0);      // +3 STR, +2 INT per livello
        self.furTraits[3] = FurTrait("Albino Raccoon", 0, 0, 0, 0, 1);      // +3 INT, +2 ACC per livello
        self.furTraits[4] = FurTrait("Red Panda", 0, 1, 0, 1, 0);           // +3 HP, +2 STR per livello
        self.furTraits[5] = FurTrait("Pink Raccoon", 0, 0, 1, 0, 1);       // +2 SPD, +3 ACC per livello
        self.furTraits[6] = FurTrait("Coop Classic", 5, 1, 0, 0, 0);       // +2 STR, +3 INT per livello
        self.furTraits[7] = FurTrait("Golden Raccoon", 0, 1, 0, 1, 1);      // +1 STR, +1 INT, +1 ACC per livello
        self.furTraits[8] = FurTrait("Avax Raccoon", 5, 1, 1, 0, 2);     // +2 HP, +2 SPD, +2 ACC per livello
        self.furTraits[9] = FurTrait("Bitcoin Raccoon", 5, 1, 1, 1, 0);     // +3 STR, +3 ACC per livello
        
        // Inizializza i tratti della testa
        self.headTraits[0] = HeadTrait("MLG Glasses", 0, 0, 0, 0, 1);       // +1 ACC per livello
        self.headTraits[1] = HeadTrait("Link Hat", 0, 0, 1, 0, 0);             // +2 INT per livello
        self.headTraits[2] = HeadTrait("Ash Hat", 0, 0, 0, 1, 0);     // +2 HP, +1 STR per livello
        self.headTraits[3] = HeadTrait("Mario Hat", 5, 0, 0, 0, 0);        // +1 SPD, +1 ACC per livello
        self.headTraits[4] = HeadTrait("Blub Hat", 5, 1, 0, 0, 0);        // +3 INT per livello
        self.headTraits[5] = HeadTrait("Snake Bandana", 0, 0, 1, 0, 1);     // +3 SPD per livello
        self.headTraits[6] = HeadTrait("Vivi Orunitia's Hat", 0, 1, 0, 1, 0);     // +1 SPD, +1 INT, +1 ACC per livello
        self.headTraits[7] = HeadTrait("Morgan's Fedora", 0, 1, 1, 0, 1);     // +3 HP per livello
        self.headTraits[8] = HeadTrait("Tracer's Headset", 0, 0, 1, 1, 1);    // +3 STR per livello
        self.headTraits[9] = HeadTrait("Master Chief Helmet", 5, 1, 1, 0, 1); // +5 HP, +1 STR, +1 SPD, +1 ACC per livello
        
        // Inizializza i tratti stellari
        self.starTraits[0] = StarTrait("Lo-Fi", 1, 5, 5);           // +5% a una stat ogni 5 livelli
        self.starTraits[1] = StarTrait("Radar", 1, 5, 5);       // +5% a una stat ogni 5 livelli
        self.starTraits[2] = StarTrait("High-Score", 1, 5, 5);           // +7% a una stat ogni 5 livelli
        self.starTraits[3] = StarTrait("Game-Over", 1, 5, 5);          // +7% a una stat ogni 5 livelli
        self.starTraits[4] = StarTrait("Racing Game", 2, 6, 5);    // +10% a una stat ogni 5 livelli
        self.starTraits[5] = StarTrait("Pacman", 2, 6, 5);  // +10% a una stat ogni 5 livelli
        self.starTraits[6] = StarTrait("Space Invaders", 2, 6, 5);      // +10% a una stat ogni 5 livelli
        self.starTraits[7] = StarTrait("Godzilla", 3, 7, 4);            // +15% a una stat ogni 5 livelli
        self.starTraits[8] = StarTrait("Stonks Candles", 3, 7, 4);      // +15% a una stat ogni 5 livelli
        self.starTraits[9] = StarTrait("Error 404", 4, 10, 4);      // +20% a una stat ogni 5 livelli
        
        // Inizializza i tratti delle armi
        self.weaponTraits[0] = WeaponTrait("Spada", 2);          // +2% STR per livello
        self.weaponTraits[1] = WeaponTrait("Bastone Magico", 2);          // +3% STR per livello
        self.weaponTraits[2] = WeaponTrait("Falce", 2);           // +3% ACC per livello
        self.weaponTraits[3] = WeaponTrait("Pozioni", 2);        // +1% STR, +1% ACC per livello
        self.weaponTraits[4] = WeaponTrait("Pesce Blub", 3);     // +1% STR, +2% SPD per livello
        self.weaponTraits[5] = WeaponTrait("Spell Fuoco", 3);       // +4% STR per livello
        self.weaponTraits[6] = WeaponTrait("Spell Magica", 3);        // +3% SPD, +1% ACC per livello
        self.weaponTraits[7] = WeaponTrait("Keyblade", 4);       // +2% SPD, +2% ACC per livello
        self.weaponTraits[8] = WeaponTrait("Nintendo Zapper", 4);          // +3% STR, +1% ACC per livello
        self.weaponTraits[9] = WeaponTrait("Raygun", 5);         // +5% STR per livello
        
        // Inizializza i modificatori delle classi
        //        HP    STR    SPD    INT    ACC
        // Classe 1: Warrior - Bonus forza, malus intelligenza
        self.classTraits[1] = ClassTrait(0, 40, 0, -20, 0);
        
        // Classe 2: Tank - Bonus salute, malus velocità
        self.classTraits[2] = ClassTrait(40, 0, -20, 0, 0);
        
        // Classe 3: Rogue - Bonus velocità, malus salute
        self.classTraits[3] = ClassTrait(-20, 0, 40, 0, 0);
        
        // Classe 4: Mage - Bonus intelligenza, malus salute
        self.classTraits[4] = ClassTrait(-20, 0, 0, 40, 0);
        
        // Classe 5: Ranger - Bonus precisione, malus forza
        self.classTraits[5] = ClassTrait(0, -20, 0, 0, 40);
        
        // Classe 6: Berserk - Bonus forza e velocità, malus intelligenza e precisione
        self.classTraits[6] = ClassTrait(0, 30, 30, -20, -20);
        
        // Classe 7: Paladin - Bonus salute e intelligenza, malus velocità
        self.classTraits[7] = ClassTrait(30, 0, -20, 30, 0);
        
        // Classe 8: Assassin - Bonus velocità e precisione, malus salute
        self.classTraits[8] = ClassTrait(-20, 0, 30, 0, 30);
        
        self.initialized = true;
    }
    
    /**
     * @dev Crea i dati iniziali per un procione con statistiche basate sui tratti
     * @param classe La classe del procione
     * @param fenotipo Array dei tratti fenotipici (0-9 per ogni tratto)
     * @return I dati completi del procione (uint256)
     */
    function createInitialDataWithTraits(TraitStats storage self, uint8 classe, uint256[5] memory fenotipo) public view returns (uint256) {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        // Inizializza i dati con le statistiche di base
        uint256 data = 0;
        data = StatsLib.updateField(data, 0, uint256(XP_MASK), XP_POSITION);
        data = StatsLib.updateField(data, INITIAL_LEVEL, uint256(LEVEL_MASK), LEVEL_POSITION);
        
        // Ottieni i modificatori di classe
        ClassTrait storage classTrait = self.classTraits[classe];
        
        // Applica i modificatori di classe alle statistiche base
        uint8 health = INITIAL_HEALTH;
        uint8 strength = INITIAL_STATS;
        uint8 speed = INITIAL_STATS;
        uint8 intelligence = INITIAL_STATS;
        uint8 accuracy = INITIAL_STATS;
        
        // Applica modificatori in percentuale della classe
        health = applyPercentageModifier(health, classTrait.healthModPct);
        strength = applyPercentageModifier(strength, classTrait.strengthModPct);
        speed = applyPercentageModifier(speed, classTrait.speedModPct);
        intelligence = applyPercentageModifier(intelligence, classTrait.intelligenceModPct);
        accuracy = applyPercentageModifier(accuracy, classTrait.accuracyModPct);
        
        // Aggiorna i valori nei dati
        data = StatsLib.updateField(data, health, uint256(HEALTH_MASK), HEALTH_POSITION);
        data = StatsLib.updateField(data, health, uint256(CURRENT_HEALTH_MASK), CURRENT_HEALTH_POSITION);
        data = StatsLib.updateField(data, strength, uint256(STRENGTH_MASK), STRENGTH_POSITION);
        data = StatsLib.updateField(data, speed, uint256(SPEED_MASK), SPEED_POSITION);
        data = StatsLib.updateField(data, intelligence, uint256(INTELLIGENCE_MASK), INTELLIGENCE_POSITION);
        data = StatsLib.updateField(data, accuracy, uint256(ACCURACY_MASK), ACCURACY_POSITION);
        data = StatsLib.updateField(data, INITIAL_BREEDING, uint256(BREEDING_MASK), BREEDING_POSITION);
        data = StatsLib.updateField(data, classe, uint256(CLASS_MASK), CLASS_POSITION);
        
        return data;
    }
    
    /**
     * @dev Aggiorna le statistiche di un procione durante il level up, basandosi sui tratti
     * @param data I dati attuali del procione
     * @param fenotipo L'array dei tratti fenotipici
     * @param newLevel Il nuovo livello del procione
     * @return I nuovi dati del procione con statistiche aggiornate
     */
    function updateStatsOnLevelUp(TraitStats storage self, uint256 data, uint256[5] memory fenotipo, uint8 newLevel) public view returns (uint256) {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        // Estrai i valori correnti
        uint8 health = uint8(StatsLib.extractField(data, uint256(HEALTH_MASK), HEALTH_POSITION));
        uint8 strength = uint8(StatsLib.extractField(data, uint256(STRENGTH_MASK), STRENGTH_POSITION));
        uint8 speed = uint8(StatsLib.extractField(data, uint256(SPEED_MASK), SPEED_POSITION));
        uint8 intelligence = uint8(StatsLib.extractField(data, uint256(INTELLIGENCE_MASK), INTELLIGENCE_POSITION));
        uint8 accuracy = uint8(StatsLib.extractField(data, uint256(ACCURACY_MASK), ACCURACY_POSITION));
        uint8 currentHealth = uint8(StatsLib.extractField(data, uint256(CURRENT_HEALTH_MASK), CURRENT_HEALTH_POSITION));
        
        // Applica bonus dai tratti FUR
        FurTrait storage furTrait = self.furTraits[uint8(fenotipo[1])];
        health += furTrait.healthBonus;
        strength += furTrait.strengthBonus;
        speed += furTrait.speedBonus;
        intelligence += furTrait.intBonus;
        accuracy += furTrait.accBonus;
        
        // Applica bonus dai tratti HEAD
        HeadTrait storage headTrait = self.headTraits[uint8(fenotipo[0])];
        health += headTrait.healthBonus;
        strength += headTrait.strengthBonus;
        speed += headTrait.speedBonus;
        intelligence += headTrait.intBonus;
        accuracy += headTrait.accBonus;
        
        // Applica bonus percentuali dai tratti WEAPON
        WeaponTrait storage weaponTrait = self.weaponTraits[uint8(fenotipo[3])];
        strength += applyPercentage(strength, weaponTrait.strengthPct);
        
        // Applica bonus dai tratti STAR se il livello è multiplo dell'intervallo
        StarTrait storage starTrait = self.starTraits[uint8(fenotipo[2])];
        if (newLevel % starTrait.levelInterval == 0) {
            // Scegli casualmente una statistica da aumentare
            uint8 statChoice = uint8(uint256(keccak256(abi.encodePacked(newLevel, fenotipo[2]))) % 5);
            
            if (statChoice == 0) {
                health += applyPercentage(health, starTrait.bonusPct);
            } else if (statChoice == 1) {
                strength += applyPercentage(strength, starTrait.bonusPct);
            } else if (statChoice == 2) {
                speed += applyPercentage(speed, starTrait.bonusPct);
            } else if (statChoice == 3) {
                intelligence += applyPercentage(intelligence, starTrait.bonusPct);
            } else {
                accuracy += applyPercentage(accuracy, starTrait.bonusPct);
            }
        }
        
        // Aggiorna la salute corrente proporzionalmente all'aumento di salute max
        uint8 oldHealth = uint8(StatsLib.extractField(data, uint256(HEALTH_MASK), HEALTH_POSITION));
        if (oldHealth > 0) {
            currentHealth = uint8((uint256(currentHealth) * uint256(health)) / uint256(oldHealth));
        }
        
        // Aggiorna i dati con i nuovi valori
        data = StatsLib.updateField(data, newLevel, uint256(LEVEL_MASK), LEVEL_POSITION);
        data = StatsLib.updateField(data, health, uint256(HEALTH_MASK), HEALTH_POSITION);
        data = StatsLib.updateField(data, currentHealth, uint256(CURRENT_HEALTH_MASK), CURRENT_HEALTH_POSITION);
        data = StatsLib.updateField(data, strength, uint256(STRENGTH_MASK), STRENGTH_POSITION);
        data = StatsLib.updateField(data, speed, uint256(SPEED_MASK), SPEED_POSITION);
        data = StatsLib.updateField(data, intelligence, uint256(INTELLIGENCE_MASK), INTELLIGENCE_POSITION);
        data = StatsLib.updateField(data, accuracy, uint256(ACCURACY_MASK), ACCURACY_POSITION);
        
        return data;
    }
    
    /**
     * @dev Funzione di supporto per calcolare un bonus percentuale
     * @param value Il valore base
     * @param percentage La percentuale da applicare
     * @return Il bonus calcolato con precisione di 2 decimali
     */
    function applyPercentage(uint8 value, uint8 percentage) internal pure returns (uint8) {
        // Moltiplichiamo per 100 per mantenere 2 decimali
        uint256 result = (uint256(value) * uint256(percentage) * 100) / 100;
        // Dividiamo per 100 e arrotondiamo all'intero più vicino
        result = (result + 50) / 100;
        return uint8(result);
    }
    
    /**
     * @dev Funzione di supporto per applicare un modificatore percentuale (può essere negativo)
     * @param value Il valore base
     * @param percentageMod Il modificatore percentuale (positivo o negativo)
     * @return Il nuovo valore dopo l'applicazione del modificatore
     */
    function applyPercentageModifier(uint8 value, int percentageMod) internal pure returns (uint8) {
        if (percentageMod > 0) {
            // Moltiplichiamo per 100 per mantenere 2 decimali
            uint256 result = (uint256(value) * uint256(percentageMod) * 100) / 100;
            // Dividiamo per 100 e arrotondiamo all'intero più vicino
            result = (result + 50) / 100;
            return value + uint8(result);
        } else if (percentageMod < 0) {
            // Moltiplichiamo per 100 per mantenere 2 decimali
            uint256 result = (uint256(value) * uint256(-percentageMod) * 100) / 100;
            // Dividiamo per 100 e arrotondiamo all'intero più vicino
            result = (result + 50) / 100;
            return value - uint8(result);
        }
        return value;
    }
    
    // Funzioni amministrative per aggiornare i tratti
    
    /**
     * @dev Aggiorna i modificatori di classe
     */
    function updateClassModifiers(
        TraitStats storage self,
        uint8 classId,
        int healthModPct,
        int strengthModPct,
        int speedModPct,
        int intelligenceModPct,
        int accuracyModPct
    ) public {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        self.classTraits[classId].healthModPct = healthModPct;
        self.classTraits[classId].strengthModPct = strengthModPct;
        self.classTraits[classId].speedModPct = speedModPct;
        self.classTraits[classId].intelligenceModPct = intelligenceModPct;
        self.classTraits[classId].accuracyModPct = accuracyModPct;
    }
    
    /**
     * @dev Aggiorna i bonus del tratto fur
     */
    function updateFurModifiers(
        TraitStats storage self,
        uint8 traitId,
        uint8 healthBonus,
        uint8 strengthBonus,
        uint8 speedBonus,
        uint8 intelligenceBonus,
        uint8 accuracyBonus
    ) public {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        self.furTraits[traitId].healthBonus = healthBonus;
        self.furTraits[traitId].strengthBonus = strengthBonus;
        self.furTraits[traitId].speedBonus = speedBonus;
        self.furTraits[traitId].intBonus = intelligenceBonus;
        self.furTraits[traitId].accBonus = accuracyBonus;
    }
    
    /**
     * @dev Aggiorna i bonus del tratto head
     */
    function updateHeadModifiers(
        TraitStats storage self,
        uint8 traitId,
        uint8 healthBonus,
        uint8 strengthBonus,
        uint8 speedBonus,
        uint8 intelligenceBonus,
        uint8 accuracyBonus
    ) public {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        self.headTraits[traitId].healthBonus = healthBonus;
        self.headTraits[traitId].strengthBonus = strengthBonus;
        self.headTraits[traitId].speedBonus = speedBonus;
        self.headTraits[traitId].intBonus = intelligenceBonus;
        self.headTraits[traitId].accBonus = accuracyBonus;
    }
    
    /**
     * @dev Aggiorna i bonus del tratto weapon
     */
    function updateWeaponModifiers(
        TraitStats storage self,
        uint8 traitId,
        uint8 strengthPct
    ) public {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        self.weaponTraits[traitId].strengthPct = strengthPct;
    }
    
    /**
     * @dev Aggiorna i bonus del tratto star
     */
    function updateStarModifiers(
        TraitStats storage self,
        uint8 traitId,
        uint8 rarity,
        uint8 bonusPct,
        uint8 levelInterval
    ) public {
        require(self.initialized, "TraitStatsLib: not initialized");
        
        self.starTraits[traitId].rarity = rarity;
        self.starTraits[traitId].bonusPct = bonusPct;
        self.starTraits[traitId].levelInterval = levelInterval;
    }
} 