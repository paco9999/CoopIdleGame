const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProfessionsManager", function () {
    let IdleProcioneNFT;
    let idleProcioneNFT;
    let ProfessionsManager;
    let professionsManager;
    let owner;
    let addr1;
    let addr2;
    let addrs;
    let mockBreedingContract;
    let mockCraftingManager;
    let mockVRFCoordinator;

    async function deployFixture() {
        const [_owner, _addr1, _addr2] = await ethers.getSigners();

        // Deploy mock VRF coordinator
        const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
        const _mockVRFCoordinator = await MockVRFCoordinator.deploy();

        // Deploy IdleProcioneNFT
        const IdleProcioneNFTFactory = await ethers.getContractFactory("IdleProcioneNFT");
        const _idleProcioneNFT = await upgrades.deployProxy(IdleProcioneNFTFactory, [
            "IdleProcioneNFT",
            "IPNFT",
            100,
            100,
            await _mockVRFCoordinator.getAddress(),
            ethers.keccak256(ethers.toUtf8Bytes("keyHash")),
            1
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Deploy ProfessionsManager
        const ProfessionsManagerFactory = await ethers.getContractFactory("ProfessionsManager");
        const _professionsManager = await upgrades.deployProxy(ProfessionsManagerFactory, [
            await _idleProcioneNFT.getAddress()
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        // Set ProfessionsManager in IdleProcioneNFT
        await _idleProcioneNFT.setProfessionsContract(await _professionsManager.getAddress());

        return {
            idleProcioneNFT: _idleProcioneNFT,
            professionsManager: _professionsManager,
            mockVRFCoordinator: _mockVRFCoordinator,
            owner: _owner,
            addr1: _addr1,
            addr2: _addr2
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployFixture);
        
        // Deploy mock breeding contract
        const MockBreedingContract = await ethers.getContractFactory("MockBreedingContract");
        mockBreedingContract = await MockBreedingContract.deploy();

        // Deploy mock crafting manager
        const MockCraftingManager = await ethers.getContractFactory("MockCraftingManager");
        mockCraftingManager = await MockCraftingManager.deploy();

        // Assegna i valori alle variabili globali
        IdleProcioneNFT = fixture.idleProcioneNFT;
        idleProcioneNFT = fixture.idleProcioneNFT;
        ProfessionsManager = fixture.professionsManager;
        professionsManager = fixture.professionsManager;
        mockVRFCoordinator = fixture.mockVRFCoordinator;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        addrs = [];

        // Setup del contratto di breeding
        await idleProcioneNFT.setEggContract(mockBreedingContract.target);
        await idleProcioneNFT.setLevelUpContract(owner.address);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente il contratto NFT", async function () {
            expect(await professionsManager.nftContract()).to.equal(idleProcioneNFT.target);
        });

        it("Dovrebbe impostare il limite di default per le professioni", async function () {
            expect(await professionsManager.getProfessionLimit(1)).to.equal(1000);
        });

        it("Dovrebbe impostare correttamente il professionBaseStep", async function () {
            expect(await professionsManager.professionBaseStep()).to.equal(100);
        });

        it("Dovrebbe impostare il livello massimo del Thief a 20", async function () {
            expect(await professionsManager.getProfessionMaxLevel(3)).to.equal(20); // 3 è l'enum value per THIEF
        });
    });

    describe("Gestione Professioni", function () {
        let tokenId;

        beforeEach(async function () {
            // Setup per il mint e i requisiti base
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            // Setup dei requisiti per la professione
            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
        });

        it("Dovrebbe permettere di assegnare una professione quando i requisiti sono soddisfatti", async function () {
            await expect(professionsManager.connect(addr1).assignProfession(tokenId, 1))
                .to.emit(professionsManager, "ProfessionAssigned")
                .withArgs(tokenId, 1);
        });

        it("Non dovrebbe permettere di assegnare una professione se il limite è stato raggiunto", async function () {
            await professionsManager.setProfessionLimit(1, 1);
            await professionsManager.connect(addr1).assignProfession(tokenId, 1);

            // Mint e setup del secondo procione
            await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
            await idleProcioneNFT.connect(addr2).randomMint();
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            const tokenId2 = 1;
            const data2 = await idleProcioneNFT.getProcioneData(tokenId2);
            let newData2 = await idleProcioneNFT.setLevel(data2, 5);
            await idleProcioneNFT.updateProcioneData(tokenId2, newData2);
            await mockBreedingContract.setBreedCount(tokenId2, 2);

            await expect(professionsManager.connect(addr2).assignProfession(tokenId2, 1))
                .to.be.revertedWithCustomError(professionsManager, "ProfessionLimitReached");
        });
    });

    describe("Gestione Esperienza e Livelli", function () {
        let tokenId;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
            await professionsManager.connect(addr1).assignProfession(tokenId, 1);
        });

        it("Dovrebbe permettere di aggiungere esperienza", async function () {
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 100);
            const [, , exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
            expect(exp).to.equal(100);
        });

        it("Dovrebbe limitare l'esperienza al massimo consentito", async function () {
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 70000);
            const [, , exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
            expect(exp).to.equal(65535); // Massimo valore per 16 bit
        });

        it("Dovrebbe permettere il level up con esperienza sufficiente", async function () {
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
            
            await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                .to.emit(professionsManager, "ProfessionLevelUp")
                .withArgs(tokenId, 2);

            const [, level, exp] = await idleProcioneNFT.getProfessionInfo(tokenId);
            expect(level).to.equal(2);
            expect(exp).to.equal(0);
        });

        it("Non dovrebbe permettere il level up con esperienza insufficiente", async function () {
            await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                .to.be.revertedWithCustomError(professionsManager, "InsufficientExp");
        });
    });

    describe("Gestione Limiti di Livello", function () {
        let tokenId;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
            await professionsManager.connect(addr1).assignProfession(tokenId, 2); // Assegna MEDIC
        });

        it("Dovrebbe avere un limite di livello di default di 100", async function () {
            expect(await professionsManager.getProfessionMaxLevel(2)).to.equal(100);
        });

        it("Dovrebbe permettere all'owner di impostare un nuovo limite di livello", async function () {
            await expect(professionsManager.setProfessionMaxLevel(2, 50))
                .to.emit(professionsManager, "ProfessionMaxLevelUpdated")
                .withArgs(2, 50);

            expect(await professionsManager.getProfessionMaxLevel(2)).to.equal(50);
        });

        it("Non dovrebbe permettere di impostare un limite di livello a 0", async function () {
            await expect(professionsManager.setProfessionMaxLevel(2, 0))
                .to.be.revertedWithCustomError(professionsManager, "InvalidLevel");
        });

        it("Non dovrebbe permettere a non-owner di impostare il limite di livello", async function () {
            await expect(professionsManager.connect(addr1).setProfessionMaxLevel(2, 50))
                .to.be.revertedWithCustomError(professionsManager, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });

        it("Dovrebbe rispettare il limite di livello durante il level up", async function () {
            // Imposta un limite basso per il test
            await professionsManager.setProfessionMaxLevel(2, 2);
            
            // Level up al livello 2 (dovrebbe funzionare)
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
            await professionsManager.connect(addr1).professionLevelUp(tokenId);
            
            // Prova a fare level up oltre il limite
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 900);
            await expect(professionsManager.connect(addr1).professionLevelUp(tokenId))
                .to.be.revertedWithCustomError(professionsManager, "InvalidLevel");
        });

        it("Dovrebbe mantenere il limite speciale di livello 5 per gli Artisan", async function () {
            // Crea un nuovo procione e assegnagli la professione Artisan
            await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
            await idleProcioneNFT.connect(addr2).randomMint();
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            const tokenId2 = 1;
            const data = await idleProcioneNFT.getProcioneData(tokenId2);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId2, newData);
            await mockBreedingContract.setBreedCount(tokenId2, 2);
            await professionsManager.connect(addr2).assignProfession(tokenId2, 1); // ARTISAN

            // Verifica che il limite sia 5 anche se impostiamo un limite diverso
            await professionsManager.setProfessionMaxLevel(1, 10);
            expect(await professionsManager.isValidProfessionLevel(1, 6)).to.be.false;
            expect(await professionsManager.isValidProfessionLevel(1, 5)).to.be.true;
        });

        it("Dovrebbe validare correttamente i livelli delle professioni", async function () {
            expect(await professionsManager.isValidProfessionLevel(2, 0)).to.be.false; // 0 non è valido
            expect(await professionsManager.isValidProfessionLevel(2, 1)).to.be.true; // 1 è valido
            expect(await professionsManager.isValidProfessionLevel(2, 100)).to.be.true; // 100 è valido (default)
            expect(await professionsManager.isValidProfessionLevel(2, 101)).to.be.false; // 101 non è valido
            
            // Imposta un nuovo limite e verifica
            await professionsManager.setProfessionMaxLevel(2, 50);
            expect(await professionsManager.isValidProfessionLevel(2, 50)).to.be.true; // 50 è valido
            expect(await professionsManager.isValidProfessionLevel(2, 51)).to.be.false; // 51 non è valido
        });
    });

    describe("Funzionalità Artisan", function () {
        let tokenId;
        let craftingManagerSigner;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione Artisan
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
            await professionsManager.connect(addr1).assignProfession(tokenId, 1); // Artisan

            // Setup del CraftingManager
            const signers = await ethers.getSigners();
            craftingManagerSigner = signers[3]; // Usa un signer diverso da owner, addr1 e addr2
            await professionsManager.setCraftingManager(craftingManagerSigner.address);
        });

        it("Dovrebbe restituire il numero corretto di slot totali per livello", async function () {
            const slots = await professionsManager.getFreeCraftingSlots(tokenId);
            expect(slots).to.equal(1); // Livello 1: 1 slot
            
            // Level up to 2
            await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
            await professionsManager.connect(addr1).professionLevelUp(tokenId);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(2);
        });

        it("Dovrebbe permettere di bloccare slot di crafting", async function () {
            const duration = 3600; // 1 ora
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(0);
        });

        it("Dovrebbe sbloccare gli slot dopo la scadenza", async function () {
            const duration = 3600; // 1 ora
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            
            await time.increase(duration + 1);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(1);
        });

        it("Non dovrebbe permettere di bloccare slot se non ci sono slot liberi", async function () {
            const duration = 3600;
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            
            await expect(professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration))
                .to.be.revertedWithCustomError(professionsManager, "NoFreeCraftingSlots");
        });

        it("Solo il CraftingManager dovrebbe poter bloccare slot", async function () {
            const duration = 3600;
            await expect(professionsManager.connect(addr1).lockCraftingSlot(tokenId, duration))
                .to.be.revertedWithCustomError(professionsManager, "UnauthorizedCaller");
        });

        // Test per unlockCraftingSlot
        it("Dovrebbe permettere di sbloccare uno slot specifico", async function () {
            const duration = 3600;
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            await professionsManager.connect(craftingManagerSigner).unlockCraftingSlot(tokenId, 0);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(1);
        });

        it("Non dovrebbe permettere di sbloccare uno slot con indice non valido", async function () {
            const duration = 3600;
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            await expect(professionsManager.connect(craftingManagerSigner).unlockCraftingSlot(tokenId, 1))
                .to.be.revertedWithCustomError(professionsManager, "InvalidSlotIndex");
        });

        it("Non dovrebbe permettere di sbloccare uno slot già sbloccato", async function () {
            const duration = 3600;
            await professionsManager.connect(craftingManagerSigner).lockCraftingSlot(tokenId, duration);
            await professionsManager.connect(craftingManagerSigner).unlockCraftingSlot(tokenId, 0);
            await expect(professionsManager.connect(craftingManagerSigner).unlockCraftingSlot(tokenId, 0))
                .to.be.revertedWithCustomError(professionsManager, "InvalidSlotIndex");
        });

        // Test per setAvailableCraftingSlots
        it("Dovrebbe permettere di impostare il numero di slot disponibili", async function () {
            await professionsManager.connect(craftingManagerSigner).setAvailableCraftingSlots(tokenId, 1);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(1);
        });

        it("Non dovrebbe permettere di impostare più slot del massimo consentito", async function () {
            await expect(professionsManager.connect(craftingManagerSigner).setAvailableCraftingSlots(tokenId, 2))
                .to.be.revertedWithCustomError(professionsManager, "InvalidSlotCount");
        });

        // Test per getArtisanLevel e setArtisanLevel
        it("Dovrebbe restituire il livello corretto dell'artigiano", async function () {
            expect(await professionsManager.getArtisanLevel(tokenId)).to.equal(1);
        });

        it("Dovrebbe permettere di impostare il livello dell'artigiano", async function () {
            await professionsManager.connect(craftingManagerSigner).setArtisanLevel(tokenId, 3);
            expect(await professionsManager.getArtisanLevel(tokenId)).to.equal(3);
            expect(await professionsManager.getFreeCraftingSlots(tokenId)).to.equal(4); // Livello 3: 4 slot
        });

        it("Non dovrebbe permettere di impostare un livello non valido", async function () {
            await expect(professionsManager.connect(craftingManagerSigner).setArtisanLevel(tokenId, 0))
                .to.be.revertedWithCustomError(professionsManager, "InvalidLevel");
            await expect(professionsManager.connect(craftingManagerSigner).setArtisanLevel(tokenId, 6))
                .to.be.revertedWithCustomError(professionsManager, "InvalidLevel");
        });

        it("Solo il CraftingManager dovrebbe poter impostare il livello", async function () {
            await expect(professionsManager.connect(addr1).setArtisanLevel(tokenId, 2))
                .to.be.revertedWithCustomError(professionsManager, "UnauthorizedCaller");
        });
    });

    describe("Funzionalità Medic", function () {
        let tokenId;
        let medicManagerSigner;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione Medic
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
            await professionsManager.connect(addr1).assignProfession(tokenId, 2); // MEDIC

            // Setup del MedicManager
            const signers = await ethers.getSigners();
            medicManagerSigner = signers[3];
            await professionsManager.setMedicManager(medicManagerSigner.address);
        });

        describe("Gestione Cooldown", function () {
            it("Dovrebbe calcolare correttamente il cooldown per ogni livello", async function () {
                const cooldowns = {
                    1: 12 * 3600, // 12 ore
                    2: 10 * 3600,
                    3: 8 * 3600,
                    4: 6 * 3600,
                    5: 5 * 3600,
                    6: 4 * 3600,
                    7: 3 * 3600,
                    8: 2 * 3600,
                    9: 5400,    // 1.5 ore
                    10: 3600    // 1 ora
                };

                for (let level = 1; level <= 10; level++) {
                    expect(await professionsManager.getMedicCooldown(level)).to.equal(cooldowns[level]);
                }
            });

            it("Dovrebbe attivare il cooldown correttamente", async function () {
                const tx = await professionsManager.connect(medicManagerSigner).activateCooldown(tokenId);
                const receipt = await tx.wait();
                
                const cooldownEvent = receipt.logs.find(
                    log => log.fragment && log.fragment.name === 'MedicCooldownActivated'
                );
                expect(cooldownEvent).to.not.be.undefined;

                expect(await professionsManager.isOnCooldown(tokenId)).to.be.true;
            });

            it("Non dovrebbe permettere l'attivazione del cooldown da non-MedicManager", async function () {
                await expect(professionsManager.connect(addr1).activateCooldown(tokenId))
                    .to.be.revertedWithCustomError(professionsManager, "NotMedicManager");
            });

            it("Non dovrebbe permettere l'attivazione del cooldown per non-Medici", async function () {
                // Creiamo un nuovo procione con professione Artisan
                await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
                await idleProcioneNFT.connect(addr2).randomMint();
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const tokenId2 = 1;
                const data = await idleProcioneNFT.getProcioneData(tokenId2);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId2, newData);
                await mockBreedingContract.setBreedCount(tokenId2, 2);
                await professionsManager.connect(addr2).assignProfession(tokenId2, 1); // ARTISAN

                await expect(professionsManager.connect(medicManagerSigner).activateCooldown(tokenId2))
                    .to.be.revertedWithCustomError(professionsManager, "NotMedic");
            });

            it("Dovrebbe gestire correttamente la scadenza del cooldown", async function () {
                await professionsManager.connect(medicManagerSigner).activateCooldown(tokenId);
                expect(await professionsManager.isOnCooldown(tokenId)).to.be.true;

                // Avanziamo il tempo di 12 ore (cooldown per livello 1)
                await time.increase(12 * 3600);
                expect(await professionsManager.isOnCooldown(tokenId)).to.be.false;
            });

            it("Dovrebbe applicare il cooldown corretto in base al livello", async function () {
                // Level up il medico al livello 2
                await professionsManager.connect(addr1).addProfessionExp(tokenId, 400);
                await professionsManager.connect(addr1).professionLevelUp(tokenId);

                await professionsManager.connect(medicManagerSigner).activateCooldown(tokenId);
                expect(await professionsManager.isOnCooldown(tokenId)).to.be.true;

                // Avanziamo il tempo di 9 ore (ancora in cooldown per livello 2 che è 10 ore)
                await time.increase(9 * 3600);
                expect(await professionsManager.isOnCooldown(tokenId)).to.be.true;

                // Avanziamo di un'altra ora (cooldown finito)
                await time.increase(1 * 3600);
                expect(await professionsManager.isOnCooldown(tokenId)).to.be.false;
            });
        });

        describe("Gestione MedicManager", function () {
            it("Dovrebbe permettere all'owner di impostare il MedicManager", async function () {
                const newManager = addr2.address;
                await expect(professionsManager.setMedicManager(newManager))
                    .to.emit(professionsManager, "MedicManagerUpdated")
                    .withArgs(medicManagerSigner.address, newManager);
            });

            it("Non dovrebbe permettere di impostare un MedicManager con indirizzo zero", async function () {
                await expect(professionsManager.setMedicManager(ethers.ZeroAddress))
                    .to.be.revertedWithCustomError(professionsManager, "InvalidAddress");
            });

            it("Non dovrebbe permettere a non-owner di impostare il MedicManager", async function () {
                await expect(professionsManager.connect(addr1).setMedicManager(addr2.address))
                    .to.be.revertedWithCustomError(professionsManager, "OwnableUnauthorizedAccount")
                    .withArgs(addr1.address);
            });
        });
    });

    describe("Funzionalità Thief", function () {
        let tokenId;
        let thiefManagerSigner;

        beforeEach(async function () {
            // Setup per il mint e l'assegnazione della professione Thief
            await idleProcioneNFT.setWhitelistPhase1([addr1.address], true);
            await idleProcioneNFT.setPhaseStatus(1, true);
            await idleProcioneNFT.connect(addr1).randomMint();
            
            const requestId = await mockVRFCoordinator.getLastRequestId();
            await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
            
            tokenId = 0;

            const data = await idleProcioneNFT.getProcioneData(tokenId);
            let newData = await idleProcioneNFT.setLevel(data, 5);
            await idleProcioneNFT.updateProcioneData(tokenId, newData);
            await mockBreedingContract.setBreedCount(tokenId, 2);
            await professionsManager.connect(addr1).assignProfession(tokenId, 3); // THIEF

            // Setup del ThiefManager
            const signers = await ethers.getSigners();
            thiefManagerSigner = signers[3];
            await professionsManager.setThiefManager(thiefManagerSigner.address);
        });

        describe("Gestione Cooldown Abilità", function () {
            it("Dovrebbe calcolare correttamente il cooldown per ogni range di livello", async function () {
                const cooldowns = {
                    1: 24 * 3600,  // Livelli 1-4: 24 ore
                    5: 20 * 3600,  // Livelli 5-9: 20 ore
                    10: 16 * 3600, // Livelli 10-14: 16 ore
                    15: 12 * 3600, // Livelli 15-19: 12 ore
                    20: 6 * 3600   // Livello 20: 6 ore
                };

                // Test per ogni range di livelli
                expect(await professionsManager.getThiefCooldown(1)).to.equal(cooldowns[1]);
                expect(await professionsManager.getThiefCooldown(4)).to.equal(cooldowns[1]);
                expect(await professionsManager.getThiefCooldown(5)).to.equal(cooldowns[5]);
                expect(await professionsManager.getThiefCooldown(9)).to.equal(cooldowns[5]);
                expect(await professionsManager.getThiefCooldown(10)).to.equal(cooldowns[10]);
                expect(await professionsManager.getThiefCooldown(14)).to.equal(cooldowns[10]);
                expect(await professionsManager.getThiefCooldown(15)).to.equal(cooldowns[15]);
                expect(await professionsManager.getThiefCooldown(19)).to.equal(cooldowns[15]);
                expect(await professionsManager.getThiefCooldown(20)).to.equal(cooldowns[20]);
            });

            it("Dovrebbe attivare il cooldown dell'abilità correttamente", async function () {
                const tx = await professionsManager.connect(thiefManagerSigner).activateThiefCooldown(tokenId);
                const receipt = await tx.wait();
                
                const cooldownEvent = receipt.logs.find(
                    log => log.fragment && log.fragment.name === 'ThiefAbilityCooldownActivated'
                );
                expect(cooldownEvent).to.not.be.undefined;

                expect(await professionsManager.isThiefOnCooldown(tokenId)).to.be.true;
            });

            it("Non dovrebbe permettere l'attivazione del cooldown da non-ThiefManager", async function () {
                await expect(professionsManager.connect(addr1).activateThiefCooldown(tokenId))
                    .to.be.revertedWithCustomError(professionsManager, "NotThiefManager");
            });

            it("Non dovrebbe permettere l'attivazione del cooldown per non-Thief", async function () {
                // Creiamo un nuovo procione con professione Artisan
                await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
                await idleProcioneNFT.connect(addr2).randomMint();
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const tokenId2 = 1;
                const data = await idleProcioneNFT.getProcioneData(tokenId2);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(tokenId2, newData);
                await mockBreedingContract.setBreedCount(tokenId2, 2);
                await professionsManager.connect(addr2).assignProfession(tokenId2, 1); // ARTISAN

                await expect(professionsManager.connect(thiefManagerSigner).activateThiefCooldown(tokenId2))
                    .to.be.revertedWithCustomError(professionsManager, "NotThief");
            });

            it("Dovrebbe gestire correttamente la scadenza del cooldown", async function () {
                await professionsManager.connect(thiefManagerSigner).activateThiefCooldown(tokenId);
                expect(await professionsManager.isThiefOnCooldown(tokenId)).to.be.true;

                // Avanziamo il tempo di 24 ore (cooldown per livello 1-4)
                await time.increase(24 * 3600);
                expect(await professionsManager.isThiefOnCooldown(tokenId)).to.be.false;
            });

            it("Dovrebbe applicare il cooldown corretto in base al livello", async function () {
                // Level up il thief al livello 5
                // Calcoliamo l'EXP necessaria per ogni livello
                const expNeeded = [400, 900, 1600, 2500];
                
                for (let i = 0; i < 4; i++) {
                    await professionsManager.connect(addr1).addProfessionExp(tokenId, expNeeded[i]);
                    await professionsManager.connect(addr1).professionLevelUp(tokenId);
                    
                    // Verifichiamo il livello dopo ogni level up
                    const [, level,] = await idleProcioneNFT.getProfessionInfo(tokenId);
                    expect(level).to.equal(i + 2); // i + 2 perché partiamo dal livello 1
                }

                await professionsManager.connect(thiefManagerSigner).activateThiefCooldown(tokenId);
                expect(await professionsManager.isThiefOnCooldown(tokenId)).to.be.true;

                // Avanziamo il tempo di 19 ore (ancora in cooldown per livello 5 che è 20 ore)
                await time.increase(19 * 3600);
                expect(await professionsManager.isThiefOnCooldown(tokenId)).to.be.true;

                // Avanziamo di un'altra ora (cooldown finito)
                await time.increase(1 * 3600);
                expect(await professionsManager.isThiefOnCooldown(tokenId)).to.be.false;
            });

            it("Dovrebbe supportare il level up fino al livello 20", async function () {
                // Setup per il mint di un nuovo NFT dedicato per questo test
                await idleProcioneNFT.setWhitelistPhase1([addr2.address], true);
                await idleProcioneNFT.setPhaseStatus(1, true);
                await idleProcioneNFT.connect(addr2).randomMint();
                
                const requestId = await mockVRFCoordinator.getLastRequestId();
                await mockVRFCoordinator.fulfillRandomWordsWithDefaultValue(requestId);
                
                const thiefTokenId = 1; // Nuovo token dedicato per questo test
                
                // Setup dei requisiti base per la professione
                const data = await idleProcioneNFT.getProcioneData(thiefTokenId);
                let newData = await idleProcioneNFT.setLevel(data, 5);
                await idleProcioneNFT.updateProcioneData(thiefTokenId, newData);
                await mockBreedingContract.setBreedCount(thiefTokenId, 2);
                
                // Assegna la professione Thief
                await professionsManager.connect(addr2).assignProfession(thiefTokenId, 3);
                
                // Verifica il livello massimo impostato per il Thief
                const maxLevel = await professionsManager.getProfessionMaxLevel(3);
                console.log(`Max level for Thief: ${maxLevel}`);
                
                // Loop di level up fino al livello 20
                for (let currentLevel = 1; currentLevel < 20; currentLevel++) {
                    const expNeeded = 100 * ((currentLevel + 1) ** 2);
                    console.log(`Level ${currentLevel}: Adding ${expNeeded} exp`);
                    
                    await professionsManager.connect(addr2).addProfessionExp(thiefTokenId, expNeeded);
                    const [profession, levelBefore, expBefore] = await idleProcioneNFT.getProfessionInfo(thiefTokenId);
                    console.log(`Before level up: Profession ${profession}, Level ${levelBefore}, Exp ${expBefore}`);
                    
                    const isValid = await professionsManager.isValidProfessionLevel(3, currentLevel + 1);
                    console.log(`Is level ${currentLevel + 1} valid? ${isValid}`);
                    
                    await professionsManager.connect(addr2).professionLevelUp(thiefTokenId);
                    const [professionAfter, levelAfter, expAfter] = await idleProcioneNFT.getProfessionInfo(thiefTokenId);
                    console.log(`After level up: Profession ${professionAfter}, Level ${levelAfter}, Exp ${expAfter}`);
                    
                    // Verifica del livello
                    expect(levelAfter).to.equal(currentLevel + 1);
                }

                // Verifichiamo che il cooldown al livello 20 sia di 6 ore
                await professionsManager.connect(thiefManagerSigner).activateThiefCooldown(thiefTokenId);
                expect(await professionsManager.isThiefOnCooldown(thiefTokenId)).to.be.true;

                // Avanziamo il tempo di 5 ore (ancora in cooldown)
                await time.increase(5 * 3600);
                expect(await professionsManager.isThiefOnCooldown(thiefTokenId)).to.be.true;

                // Avanziamo di un'altra ora (cooldown finito)
                await time.increase(1 * 3600);
                expect(await professionsManager.isThiefOnCooldown(thiefTokenId)).to.be.false;
            });
        });

        describe("Gestione ThiefManager", function () {
            it("Dovrebbe permettere all'owner di impostare il ThiefManager", async function () {
                const newManager = addr2.address;
                await expect(professionsManager.setThiefManager(newManager))
                    .to.emit(professionsManager, "ThiefManagerUpdated")
                    .withArgs(thiefManagerSigner.address, newManager);
            });

            it("Non dovrebbe permettere di impostare un ThiefManager con indirizzo zero", async function () {
                await expect(professionsManager.setThiefManager(ethers.ZeroAddress))
                    .to.be.revertedWithCustomError(professionsManager, "InvalidAddress");
            });

            it("Non dovrebbe permettere a non-owner di impostare il ThiefManager", async function () {
                await expect(professionsManager.connect(addr1).setThiefManager(addr2.address))
                    .to.be.revertedWithCustomError(professionsManager, "OwnableUnauthorizedAccount")
                    .withArgs(addr1.address);
            });
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'owner di impostare il limite delle professioni", async function () {
            await professionsManager.setProfessionLimit(1, 500);
            expect(await professionsManager.getProfessionLimit(1)).to.equal(500);
        });

        it("Dovrebbe permettere all'owner di impostare il CraftingManager", async function () {
            await expect(professionsManager.setCraftingManager(mockCraftingManager.target))
                .to.emit(professionsManager, "CraftingManagerUpdated")
                .withArgs(ethers.ZeroAddress, mockCraftingManager.target);
        });

        it("Non dovrebbe permettere a non-owner di chiamare funzioni admin", async function () {
            await expect(professionsManager.connect(addr1).setProfessionLimit(1, 500))
                .to.be.revertedWithCustomError(professionsManager, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });

        it("Dovrebbe permettere all'owner di mettere in pausa il contratto", async function () {
            await professionsManager.pause();
            expect(await professionsManager.paused()).to.be.true;

            await professionsManager.unpause();
            expect(await professionsManager.paused()).to.be.false;
        });
    });
}); 