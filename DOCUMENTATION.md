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

**Funzionalità Chiave:**
- `randomMint()`: Mint casuale con Chainlink VRF
- `mintFromEgg()`: Mint da uova con genetica predefinita
- Sistema di whitelist integrato
- Gestione dei tratti genetici
- Limiti per fazioni e classi

### 2. ProfessionsManager.sol
**Gestione delle Professioni**
- Sistema modulare per professioni
- Gestione livelli e esperienza
- Sistema speciale per Artigiani
- Slot di crafting basati su livello

**Funzionalità Chiave:**
- `assignProfession()`: Assegnazione professione
- `addProfessionExp()`: Aggiunta esperienza
- `professionLevelUp()`: Aumento di livello
- Sistema di slot per crafting
- Limiti per professione

### 3. CraftingManager.sol
**Sistema di Crafting**
- Gestione ricette
- Sistema di materiali
- Slot di crafting temporizzati
- Integrazione con professioni

### 4. MaterialsNFT.sol
**Gestione Materiali**
- ERC1155 per materiali
- Sistema di rarità
- Integrazione con crafting

### 5. IdleProcioneBreeding.sol
**Sistema di Riproduzione**
- Meccanica di breeding
- Ereditarietà dei tratti
- Cooldown system
- Requisiti di breeding

### 6. IdleProcioneLeveling.sol
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

### Sistema di Professioni
- 16 professioni disponibili
- Livellamento individuale
- Abilità speciali per professione
- Sistema di slot per Artigiani

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

## Librerie Utilizzate

### GeneticsLib
- Gestione tratti genetici
- Calcolo ereditarietà
- Sistema di mutazioni

### StatsLib
- Gestione statistiche
- Calcolo progressione
- Storage ottimizzato

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

### IIdleProcioneBreeding
- Funzioni breeding
- Gestione cooldown
- Calcolo genetica

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

### Considerazioni Gas
- Ottimizzazione storage
- Batch operations
- Efficient mappings

### Sicurezza
- Pause mechanism
- Access control
- Rate limiting
- Reentrancy protection 