# Documentazione Tecnica - Idle Procione Game

## Panoramica del Sistema
Il progetto implementa un gioco NFT basato su Ethereum che ruota attorno ai "Procioni", creature collezionabili con genetica, professioni e sistema di crafting. Il sistema è costruito utilizzando contratti intelligenti aggiornabili (UUPS pattern) e integra Chainlink VRF per la generazione sicura di numeri casuali.

## Architettura dei Contratti

### 1. IdleProcioneNFT.sol
**Contratto Principale per gli NFT**
- Implementa ERC721 con storage ottimizzato
- Gestisce il minting dei Procioni
- Sistema di genetica per tratti ereditari
- Integrazione con Chainlink VRF
- Gestione delle fazioni e classi
- Sistema di livellamento base
- Sistema di gestione della salute corrente

**Funzionalità Chiave:**
- `randomMint()`: Mint casuale con Chainlink VRF
- `mintFromEgg()`: Mint da uova con genetica predefinita
- Sistema di whitelist integrato
- Gestione dei tratti genetici
- Limiti per fazioni e classi
- Gestione della salute corrente con autorizzazioni

### 2. ProfessionsManager.sol
**Gestione delle Professioni**
- Sistema modulare per professioni
- Gestione livelli e esperienza
- Sistema speciale per Artigiani
- Slot di crafting basati su livello
- Sistema di cooldown per Medici
- Limiti di livello personalizzabili per professione

**Funzionalità Chiave:**
- `assignProfession()`: Assegnazione professione
- `addProfessionExp()`: Aggiunta esperienza
- `professionLevelUp()`: Aumento di livello
- Sistema di slot per crafting
- Limiti per professione
- Gestione cooldown medici
- Limiti di livello configurabili

**Sistema di Limiti di Livello:**
- Limite di default: 100 livelli
- Limiti personalizzabili per professione
- Limite speciale per Artigiani (max 5)
- Validazione automatica dei livelli
- Eventi per tracking modifiche

**Sistema Medici:**
- Cooldown basato sul livello (da 12 a 1 ora)
- Gestione autorizzazioni via MedicManager
- Tracking stato cooldown
- Eventi per modifiche stato
- Validazioni professione

### 3. MedicManager.sol
**Gestione delle Cure e dei Medici**
- Sistema di cura per NFT
- Gestione fee e ricompense
- Integrazione con sistema cooldown
- Supporto per cure singole e multiple

**Funzionalità Chiave:**
- `heal()`: Cura singolo NFT usando un medico disponibile
- `healBatch()`: Cura multipli NFT usando medici diversi
- `getAvailableMedic()`: Trova medico disponibile
- Sistema di fee configurabile
- Distribuzione automatica ricompense
- Integrazione con cooldown medici

**Sistema di Fee:**
- Fee base configurabile
- Percentuale configurabile per medici
- Distribuzione automatica tra medico e tesoreria
- Calcolo proporzionale per cure multiple

**Sicurezza e Controlli:**
- Verifica disponibilità medici
- Controllo salute NFT
- Gestione autorizzazioni
- Sistema anti-reentrancy
- Meccanismo di pausa
- Validazioni COM token

**Eventi e Logging:**
- Tracking cure effettuate
- Monitoraggio fee
- Log modifiche configurazione
- Eventi per cure multiple
- Tracking aggiornamenti contratto

### 4. CraftingManager.sol
**Sistema di Crafting**
- Gestione ricette con sistema di rarità
- Sistema di materiali con pesi e probabilità
- Slot di crafting temporizzati con bonus da livello
- Integrazione con professioni e specializzazioni
- Sistema di crafting batch per efficienza
- Gestione fallimenti e successi critici
- Bonus qualità basati su statistiche
- Sistema di ricette scopribili
- Integrazione con economia di gioco

**Funzionalità Chiave:**
- `startCrafting()`: Avvia processo di crafting
- `completeCrafting()`: Finalizza crafting e assegna risultati
- `addRecipe()`: Aggiunge nuove ricette al sistema
- `getBatchCraftingCost()`: Calcola costi per crafting multiplo
- Sistema di prerequisiti per ricette
- Gestione materiali rari
- Bonus crafting stagionali

### 5. MaterialsNFT.sol
**Gestione Materiali**
- ERC1155 per materiali con metadata esteso
- Sistema di rarità dinamico
- Integrazione con crafting e mercato
- Burning mechanism per economia
- Sistema di stack limits
- Gestione materiali stagionali
- Tracciamento origine materiali

### 6. IdleProcioneBreeding.sol
**Sistema di Riproduzione**
- Meccanica di breeding
- Ereditarietà dei tratti
- Cooldown system
- Requisiti di breeding

### 7. IdleProcioneLeveling.sol
**Sistema di Livellamento**
- Progressione del livello
- Sistema di esperienza
- Requisiti per level-up
- Bonus per livello

### 8. MarketManager.sol (TBD)
**Sistema di Mercato**
- Gestione listing NFT e materiali
- Sistema di aste con timer
- Supporto per bundle sales
- Fee di mercato configurabili
- Sistema di offerte
- Integrazione con token di governance
- Meccanismo anti-manipolazione prezzi

## Sistemi Principali

### Sistema di Genetica
- 5 tratti principali per Procione
- Ereditarietà basata su genitori
- Mutazioni casuali
- Sistema di rarità per tratti

### Sistema di Salute
- Doppio sistema di salute (massima e corrente)
- Gestione autorizzazioni per modifiche
- Limiti automatici (0 - salute massima)
- Eventi per tracciamento modifiche
- Integrazione con contratti esterni

### Sistema di Professioni
- 16 professioni disponibili
- Livellamento individuale
- Abilità speciali per professione
- Sistema di slot per Artigiani
- Sistema di cooldown per Medici
- Limiti di livello configurabili
- Gestione autorizzazioni granulare

### Sistema di Crafting
- Ricette multiple
- Requisiti di materiali
- Tempi di crafting
- Bonus da professione

### Sistema di Breeding
- Cooldown tra breeding
- Ereditarietà dei tratti
- Requisiti minimi
- Limiti di breeding

### Sistema di Cure
- Cura singola o multipla di NFT
- Fee configurabili per servizio
- Ricompense automatiche per medici
- Integrazione con sistema cooldown
- Verifica automatica stato salute
- Gestione efficiente cure multiple
- Distribuzione equa tra medici

### Sistema di Economia
- Token utility COM per transazioni
- Sistema di staking per bonus
- Meccanismi anti-inflazione
- Sink mechanisms
- Dynamic fee adjustment
- Reward distribution system
- Governance token per decisioni comunitarie

### Sistema di Eventi (TBD)
- Eventi stagionali automatizzati
- Bonus temporanei
- Missioni speciali
- Ricompense limitate nel tempo
- Sistema di achievement
- Leaderboard dinamiche
- Competizioni tra fazioni

## Librerie Utilizzate

### GeneticsLib
- Gestione tratti genetici
- Calcolo ereditarietà
- Sistema di mutazioni

### StatsLib
- Gestione statistiche
- Calcolo progressione
- Storage ottimizzato
- Sistema bit-packing per statistiche
- Gestione salute corrente e massima
- Controlli automatici dei limiti

### WhitelistLib
- Gestione whitelist
- Limiti per wallet
- Verifica permessi

### FactionClassLib
- Gestione fazioni
- Sistema di classi
- Bilanciamento popolazione

### EconomyLib (TBD)
- Gestione token utility
- Calcolo reward
- Sistema di staking
- Meccanismi deflazionari
- Fee distribution
- Price oracle integration

### EventLib (TBD)
- Gestione eventi temporanei
- Sistema achievement
- Tracking missioni
- Leaderboard management
- Reward distribution

## Sicurezza e Ottimizzazione

### Misure di Sicurezza
- Utilizzo di ReentrancyGuard
- Pattern Checks-Effects-Interactions
- Sistema di pausa per emergenze
- Controlli di proprietà
- Limiti e rate limiting
- Sistema di autorizzazioni per modifiche della salute
- Controlli automatici dei limiti per la salute

### Ottimizzazioni Gas
- Storage packing
- Mappature efficienti
- Batch operations
- Uso di uint256 per storage

## Flusso di Gioco

1. **Mint Iniziale**
   - Mint random o da uovo
   - Assegnazione tratti casuali
   - Assegnazione fazione/classe

2. **Progressione**
   - Guadagno esperienza
   - Level up
   - Sblocco professioni
   - Accesso a crafting

3. **Professioni**
   - Scelta professione
   - Leveling professionale
   - Sblocco abilità
   - Accesso a crafting speciale

4. **Crafting**
   - Raccolta materiali
   - Creazione oggetti
   - Utilizzo slot
   - Bonus da professione

5. **Breeding**
   - Selezione genitori
   - Calcolo tratti
   - Gestione cooldown
   - Creazione nuovi Procioni

## Interfacce Principali

### IIdleProcioneNFT
- Funzioni core NFT
- Gestione dati Procione
- Interfaccia professioni
- Gestione salute corrente
- Sistema di autorizzazioni

### IIdleProcioneBreeding
- Funzioni breeding
- Gestione cooldown
- Calcolo genetica

### IMedicManager
- Funzioni di cura NFT
- Gestione fee e ricompense
- Configurazione sistema
- Eventi e logging
- Controlli amministrativi

## Note Tecniche

### Versioni
- Solidity: ^0.8.20
- OpenZeppelin: 4.9.3
- Chainlink: VRF V2 0.8.0
- Hardhat: 2.17.0
- TypeScript: 5.0.4

### Dipendenze
- OpenZeppelin Contracts
- Chainlink VRF
- Hardhat

### Deployment
- Proxy UUPS
- Inizializzazione modulare
- Setup Chainlink VRF

### Testing
- Coverage > 95%
- Fuzzing tests con Echidna
- Formal verification con Certora
- Load testing per gas optimization
- Integration tests suite
- Automated CI/CD pipeline

### Sicurezza
- Pause mechanism
- Access control
- Rate limiting
- Reentrancy protection
- Sistema di autorizzazioni per manager
- Validazioni professione
- Controlli limiti di livello
- Protezione cure multiple
- Validazione medici
- Controllo fee e pagamenti

### Performance
- Ottimizzazione batch operations
- Caching layer per dati frequenti
- Gas optimization patterns
- Event-driven architecture
- Efficient storage layouts
- Proxy pattern optimization
- Cross-contract call minimization

## Roadmap Tecnica
1. **Fase 1 - Core Systems** (Completato)
   - NFT base system
   - Professioni
   - Crafting base
   
2. **Fase 2 - Economy** (In Progress)
   - Token utility
   - Marketplace
   - Staking system
   
3. **Fase 3 - Advanced Features** (Pianificato)
   - Sistema guild
   - PvP system
   - Land system
   - Advanced breeding mechanics

4. **Fase 4 - Scaling Solutions** (Futuro)
   - L1 Launch