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
- Gestione ricette
- Sistema di materiali
- Slot di crafting temporizzati
- Integrazione con professioni

### 5. MaterialsNFT.sol
**Gestione Materiali**
- ERC1155 per materiali
- Sistema di rarità
- Integrazione con crafting

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
- OpenZeppelin: Ultima versione stabile
- Chainlink: VRF V2

### Dipendenze
- OpenZeppelin Contracts
- Chainlink VRF
- Hardhat

### Deployment
- Proxy UUPS
- Inizializzazione modulare
- Setup Chainlink VRF

## Limitazioni e Considerazioni

### Limiti Tecnici
- Max 6000 mint random
- 3 mint per wallet
- Limiti professioni
- Cooldown breeding
- Limiti di livello per professione
- Cooldown medici basati su livello
- Limite speciale Artigiani (5 livelli)

### Considerazioni Gas
- Ottimizzazione storage
- Batch operations
- Efficient mappings
- Gestione efficiente cooldown
- Validazioni ottimizzate
- Ottimizzazione cure multiple
- Gestione efficiente array
- Minimizzazione storage

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

### Storage e Bit-Packing
- Ottimizzazione dello storage tramite bit-packing
- Gestione efficiente delle statistiche
- Posizionamento ottimale dei campi
- Maschere per l'accesso ai dati
- Separazione tra salute massima e corrente

### Eventi e Logging
- Eventi dettagliati per modifiche di stato
- Tracciamento delle modifiche alla salute
- Logging delle autorizzazioni
- Monitoraggio delle operazioni critiche
- Eventi per cooldown medici
- Eventi per limiti di livello
- Tracking modifiche manager
- Tracking cure NFT
- Monitoraggio fee medici
- Log cure multiple 