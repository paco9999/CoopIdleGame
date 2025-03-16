const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("MedicManager", function () {
    async function deployContractsFixture() {
        console.log("\n📦 Deploying contracts...");
        const [owner, treasury, user1, user2, user3] = await ethers.getSigners();

        // Deploy mock contracts
        console.log("🔧 Deploying MockCOM...");
        const MockCOM = await ethers.getContractFactory("MockCOM");
        const mockCOM = await MockCOM.deploy();
        await mockCOM.waitForDeployment();
        console.log(`   MockCOM deployed at: ${await mockCOM.getAddress()}`);

        console.log("🔧 Deploying MockNFT...");
        const MockNFT = await ethers.getContractFactory("contracts/mocks/MockIdleProcioneNFT.sol:MockIdleProcioneNFT");
        const mockNFT = await MockNFT.deploy();
        await mockNFT.waitForDeployment();
        console.log(`   MockNFT deployed at: ${await mockNFT.getAddress()}`);

        console.log("🔧 Deploying MockProfessionsManager...");
        const MockProfessionsManager = await ethers.getContractFactory("MockProfessionsManager");
        const mockProfManager = await MockProfessionsManager.deploy();
        await mockProfManager.waitForDeployment();
        console.log(`   MockProfessionsManager deployed at: ${await mockProfManager.getAddress()}`);

        // Setup initial state
        console.log("\n💰 Setting up initial state...");
        console.log("   Minting COM tokens to users...");
        await mockCOM.mint(user1.address, ethers.parseEther("1000")); // user1 sarà il pagatore
        await mockCOM.mint(user2.address, ethers.parseEther("1000")); // user2 sarà il proprietario del primo medico
        await mockCOM.mint(user3.address, ethers.parseEther("1000")); // user3 sarà il proprietario del secondo medico

        // Mint NFTs con salute bassa
        console.log("   Minting NFTs with low health...");
        await mockNFT.safeMint(user1.address); // tokenId 0 - NFT da curare
        await mockNFT.safeMint(user1.address); // tokenId 1 - NFT da curare
        await mockNFT.safeMint(user1.address); // tokenId 2 - NFT da curare

        console.log("   Setting initial health values...");
        await mockNFT.setHealth(0, 20);
        await mockNFT.setHealth(1, 30);
        await mockNFT.setHealth(2, 40);

        // Mint Medic NFTs a utenti diversi
        console.log("   Minting and assigning Medic NFTs to different users...");
        await mockNFT.safeMint(user2.address); // tokenId 3 (Medic) - assegnato a user2
        await mockNFT.safeMint(user3.address); // tokenId 4 (Medic) - assegnato a user3
        await mockProfManager.assignProfession(3, 2); // Assegna professione medico (valore 2)
        await mockProfManager.assignProfession(4, 2); // Assegna professione medico (valore 2)

        // Deploy MedicManager
        console.log("\n🚀 Deploying MedicManager...");
        const MedicManager = await ethers.getContractFactory("MedicManager");
        const medicManager = await upgrades.deployProxy(MedicManager, [
            await mockCOM.getAddress(),
            await mockNFT.getAddress(),
            await mockProfManager.getAddress(),
            treasury.address
        ]);
        await medicManager.waitForDeployment();
        console.log(`   MedicManager deployed at: ${await medicManager.getAddress()}`);

        return { 
            medicManager, 
            mockCOM, 
            mockNFT, 
            mockProfManager, 
            owner, 
            treasury, 
            user1, 
            user2, 
            user3 
        };
    }

    describe("Inizializzazione", function () {
        it("Dovrebbe inizializzare correttamente i valori", async function () {
            console.log("\n🔍 Testing initialization...");
            const { medicManager, mockCOM, mockNFT, mockProfManager, treasury } = await loadFixture(deployContractsFixture);

            console.log("   Verifying contract addresses and parameters...");
            expect(await medicManager.comToken()).to.equal(await mockCOM.getAddress());
            expect(await medicManager.nftContract()).to.equal(await mockNFT.getAddress());
            expect(await medicManager.professionsManager()).to.equal(await mockProfManager.getAddress());
            expect(await medicManager.treasury()).to.equal(treasury.address);
            expect(await medicManager.healingFee()).to.equal(ethers.parseEther("100"));
            expect(await medicManager.medicFeePercentage()).to.equal(50);
        });
    });

    describe("Funzioni di Cura", function () {
        describe("heal", function () {
            it("Dovrebbe trasferire correttamente i COM token al medico e alla tesoreria", async function () {
                console.log("\n💰 Testing COM token transfers in heal function...");
                const { medicManager, mockCOM, mockNFT, user1, treasury } = await loadFixture(deployContractsFixture);

                // Imposta salute bassa per l'NFT
                console.log("   Setting low health for NFT 0...");
                await mockNFT.setHealth(0, 20);

                // Trova il medico disponibile e il suo owner
                console.log("   Finding available medic...");
                const medicId = await medicManager.getAvailableMedic();
                const medicOwner = await mockNFT.ownerOf(medicId);
                console.log(`   Medic ID: ${medicId}, Owner: ${medicOwner}`);

                // Verifica saldi iniziali
                console.log("   Checking initial balances...");
                const initialUser1Balance = await mockCOM.balanceOf(user1.address);
                const initialMedicOwnerBalance = await mockCOM.balanceOf(medicOwner);
                const initialTreasuryBalance = await mockCOM.balanceOf(treasury.address);
                console.log(`   Initial balances:
                    User1 (payer): ${ethers.formatEther(initialUser1Balance)} COM
                    Medic Owner: ${ethers.formatEther(initialMedicOwnerBalance)} COM
                    Treasury: ${ethers.formatEther(initialTreasuryBalance)} COM`);

                // Approva COM tokens
                const healingFee = await medicManager.healingFee();
                console.log(`   Approving ${ethers.formatEther(healingFee)} COM tokens...`);
                const approveTx = await mockCOM.connect(user1).approve(await medicManager.getAddress(), healingFee);
                console.log("   Waiting for approval transaction...");
                await approveTx.wait();
                console.log("   Approval transaction confirmed");

                // Esegui cura
                console.log("   Executing heal...");
                const healTx = await medicManager.connect(user1).heal(0);
                console.log("   Waiting for heal transaction...");
                const receipt = await healTx.wait();
                console.log("   Heal transaction confirmed");

                // Analizza gli eventi emessi
                console.log("\n   Analyzing emitted events...");
                for (const log of receipt.logs) {
                    if (log.fragment) {
                        console.log(`   Event: ${log.fragment.name}`);
                        console.log("   Arguments:", Object.fromEntries(Object.entries(log.args)));
                    }
                }

                // Verifica che il trasferimento sia stato effettivamente completato
                console.log("\n   Verifying transfer completion...");
                const transferEvents = receipt.logs.filter(
                    log => log.fragment && log.fragment.name === "Transfer"
                );
                console.log(`   Found ${transferEvents.length} Transfer events`);
                for (const event of transferEvents) {
                    console.log(`   Transfer: From ${event.args.from} To ${event.args.to} Amount ${ethers.formatEther(event.args.value)} COM`);
                }

                // Attendi un po' per assicurarsi che la blockchain sia aggiornata
                console.log("\n   Waiting for blockchain to update...");
                await ethers.provider.send("evm_mine", []);
                
                // Verifica saldi finali
                console.log("\n   Checking final balances...");
                const finalUser1Balance = await mockCOM.balanceOf(user1.address);
                const finalMedicOwnerBalance = await mockCOM.balanceOf(medicOwner);
                const finalTreasuryBalance = await mockCOM.balanceOf(treasury.address);

                // Log dettagliato delle variazioni
                console.log("\n   Detailed balance changes:");
                console.log(`   User1 (${user1.address}):
                    Initial: ${ethers.formatEther(initialUser1Balance)} COM
                    Final: ${ethers.formatEther(finalUser1Balance)} COM
                    Delta: ${ethers.formatEther(finalUser1Balance - initialUser1Balance)} COM`);
                
                console.log(`   Medic Owner (${medicOwner}):
                    Initial: ${ethers.formatEther(initialMedicOwnerBalance)} COM
                    Final: ${ethers.formatEther(finalMedicOwnerBalance)} COM
                    Delta: ${ethers.formatEther(finalMedicOwnerBalance - initialMedicOwnerBalance)} COM`);
                
                console.log(`   Treasury (${treasury.address}):
                    Initial: ${ethers.formatEther(initialTreasuryBalance)} COM
                    Final: ${ethers.formatEther(finalTreasuryBalance)} COM
                    Delta: ${ethers.formatEther(finalTreasuryBalance - initialTreasuryBalance)} COM`);

                // Calcola fee attese
                const medicFeePercentage = await medicManager.medicFeePercentage();
                const expectedMedicFee = (healingFee * BigInt(medicFeePercentage)) / 100n;
                const expectedTreasuryFee = healingFee - expectedMedicFee;

                console.log("\n   Expected vs Actual:");
                console.log(`   Total Fee: ${ethers.formatEther(healingFee)} COM
                    Medic Fee (${medicFeePercentage}%): ${ethers.formatEther(expectedMedicFee)} COM
                    Treasury Fee: ${ethers.formatEther(expectedTreasuryFee)} COM`);

                // Verifica trasferimenti
                console.log("\n   Verifying token transfers...");
                console.log(`   User1 (payer) balance change:
                    Initial: ${ethers.formatEther(initialUser1Balance)} COM
                    Final: ${ethers.formatEther(finalUser1Balance)} COM
                    Expected change: -${ethers.formatEther(healingFee)} COM
                    Actual change: -${ethers.formatEther(initialUser1Balance - finalUser1Balance)} COM`);
                expect(finalUser1Balance).to.equal(initialUser1Balance - healingFee, "User1 balance incorrect");

                console.log(`   Medic owner (${medicOwner}) balance change:
                    Initial: ${ethers.formatEther(initialMedicOwnerBalance)} COM
                    Final: ${ethers.formatEther(finalMedicOwnerBalance)} COM
                    Expected change: +${ethers.formatEther(expectedMedicFee)} COM
                    Actual change: +${ethers.formatEther(finalMedicOwnerBalance - initialMedicOwnerBalance)} COM`);
                expect(finalMedicOwnerBalance).to.equal(initialMedicOwnerBalance + expectedMedicFee, "Medic owner balance incorrect");

                console.log(`   Treasury balance change:
                    Initial: ${ethers.formatEther(initialTreasuryBalance)} COM
                    Final: ${ethers.formatEther(finalTreasuryBalance)} COM
                    Expected change: +${ethers.formatEther(expectedTreasuryFee)} COM
                    Actual change: +${ethers.formatEther(finalTreasuryBalance - initialTreasuryBalance)} COM`);
                expect(finalTreasuryBalance).to.equal(initialTreasuryBalance + expectedTreasuryFee, "Treasury balance incorrect");
            });

            it("Dovrebbe curare un NFT con successo", async function () {
                console.log("\n🏥 Testing healing function...");
                const { medicManager, mockCOM, mockNFT, user1 } = await loadFixture(deployContractsFixture);

                console.log("   Approving COM tokens...");
                await mockCOM.connect(user1).approve(await medicManager.getAddress(), ethers.parseEther("100"));

                console.log("   Checking initial health...");
                const initialHealth = await mockNFT.getHealth(0);
                console.log(`   Initial health: ${initialHealth}`);

                console.log("   Getting NFT data...");
                const initialData = await mockNFT.getProcioneData(0);
                console.log(`   Initial NFT data: ${initialData}`);
                
                console.log("   Executing heal...");
                const tx = await medicManager.connect(user1).heal(0);
                const receipt = await tx.wait();

                console.log("   Verifying events...");
                const healEvent = receipt.logs.find(
                    log => log.fragment && log.fragment.name === "NFTHealed"
                );
                console.log(`   Event found: ${!!healEvent}`);
                if (healEvent) {
                    console.log(`   Event args: tokenId=${healEvent.args.tokenId}, medicId=${healEvent.args.medicId}`);
                }

                console.log("   Checking final health...");
                const finalHealth = await mockNFT.getHealth(0);
                console.log(`   Final health: ${finalHealth}`);
            });

            it("Dovrebbe fallire se l'NFT è già al massimo della salute", async function () {
                console.log("\n❌ Testing healing with full health...");
                const { medicManager, mockCOM, mockNFT, user1 } = await loadFixture(deployContractsFixture);

                console.log("   Setting NFT to full health...");
                await mockNFT.setFullHealth(0);
                
                console.log("   Checking health after setFullHealth...");
                const health = await mockNFT.getHealth(0);
                console.log(`   Current health: ${health}`);

                console.log("   Getting NFT data...");
                const data = await mockNFT.getProcioneData(0);
                console.log(`   NFT data: ${data}`);

                console.log("   Approving COM tokens...");
                await mockCOM.connect(user1).approve(await medicManager.getAddress(), ethers.parseEther("100"));

                console.log("   Attempting to heal full health NFT...");
                await expect(medicManager.connect(user1).heal(0))
                    .to.be.revertedWithCustomError(medicManager, "NFTAlreadyAtFullHealth");
            });

            it("Dovrebbe fallire se non ci sono medici disponibili", async function () {
                const { medicManager, mockCOM, mockProfManager, user1 } = await loadFixture(deployContractsFixture);
                await mockProfManager.setAllMedicsOnCooldown();
                await mockCOM.connect(user1).approve(await medicManager.getAddress(), ethers.parseEther("100"));

                await expect(medicManager.connect(user1).heal(0))
                    .to.be.revertedWithCustomError(medicManager, "NoAvailableMedic");
            });
        });

        describe("healBatch", function () {
            it("Dovrebbe trasferire correttamente i COM token per cure multiple", async function () {
                console.log("\n💰 Testing COM token transfers in healBatch function...");
                const { medicManager, mockCOM, mockNFT, mockProfManager, user1, treasury } = await loadFixture(deployContractsFixture);

                // Imposta salute bassa per gli NFT
                console.log("   Setting low health for NFTs...");
                await mockNFT.setHealth(0, 20);
                await mockNFT.setHealth(1, 30);

                // Esegui healBatch per trovare i medici che verranno usati
                console.log("   Finding medics to be used...");
                const tokenIds = [0, 1];
                const medicIds = [];
                for (let i = 0; i < tokenIds.length; i++) {
                    const medicId = await medicManager.getAvailableMedic();
                    medicIds.push(medicId);
                    // Simula l'attivazione del cooldown per trovare il prossimo medico
                    await mockProfManager.activateCooldown(medicId);
                }
                // Resetta i cooldown
                for (const medicId of medicIds) {
                    await mockProfManager.deactivateCooldown(medicId);
                }

                // Trova gli owner dei medici
                const medicOwners = await Promise.all(medicIds.map(id => mockNFT.ownerOf(id)));
                console.log(`   Medic IDs: ${medicIds.join(", ")}`);
                console.log(`   Medic Owners: ${medicOwners.join(", ")}`);

                // Verifica saldi iniziali
                console.log("   Checking initial balances...");
                const initialUser1Balance = await mockCOM.balanceOf(user1.address);
                const initialMedicOwnerBalances = await Promise.all(medicOwners.map(owner => mockCOM.balanceOf(owner)));
                const initialTreasuryBalance = await mockCOM.balanceOf(treasury.address);
                console.log(`   Initial balances:
                    User1 (payer): ${ethers.formatEther(initialUser1Balance)} COM
                    Medic1 Owner: ${ethers.formatEther(initialMedicOwnerBalances[0])} COM
                    Medic2 Owner: ${ethers.formatEther(initialMedicOwnerBalances[1])} COM
                    Treasury: ${ethers.formatEther(initialTreasuryBalance)} COM`);

                // Calcola fee totale e approva
                const healingFee = await medicManager.healingFee();
                const totalFee = healingFee * 2n;
                console.log(`   Approving ${ethers.formatEther(totalFee)} COM tokens...`);
                const approveTx = await mockCOM.connect(user1).approve(await medicManager.getAddress(), totalFee);
                console.log("   Waiting for approval transaction...");
                await approveTx.wait();
                console.log("   Approval transaction confirmed");

                // Esegui cura batch
                console.log("   Executing healBatch...");
                const healBatchTx = await medicManager.connect(user1).healBatch(tokenIds);
                console.log("   Waiting for healBatch transaction...");
                const receipt = await healBatchTx.wait();
                console.log("   HealBatch transaction confirmed");

                // Attendi un po' per assicurarsi che la blockchain sia aggiornata
                console.log("   Waiting for blockchain to update...");
                await ethers.provider.send("evm_mine", []);

                // Verifica saldi finali
                console.log("   Checking final balances...");
                const finalUser1Balance = await mockCOM.balanceOf(user1.address);
                const finalMedicOwnerBalances = await Promise.all(medicOwners.map(owner => mockCOM.balanceOf(owner)));
                const finalTreasuryBalance = await mockCOM.balanceOf(treasury.address);
                console.log(`   Final balances:
                    User1 (payer): ${ethers.formatEther(finalUser1Balance)} COM
                    Medic1 Owner: ${ethers.formatEther(finalMedicOwnerBalances[0])} COM
                    Medic2 Owner: ${ethers.formatEther(finalMedicOwnerBalances[1])} COM
                    Treasury: ${ethers.formatEther(finalTreasuryBalance)} COM`);

                // Calcola fee attese
                const medicFeePercentage = await medicManager.medicFeePercentage();
                const expectedMedicFee = (healingFee * BigInt(medicFeePercentage)) / 100n;
                const expectedTreasuryFee = (healingFee - expectedMedicFee) * 2n;

                console.log(`   Expected fees:
                    Total fee: ${ethers.formatEther(totalFee)} COM
                    Medic fee each (${medicFeePercentage}%): ${ethers.formatEther(expectedMedicFee)} COM
                    Treasury fee total: ${ethers.formatEther(expectedTreasuryFee)} COM`);

                // Verifica trasferimenti
                console.log("\n   Verifying token transfers...");
                console.log(`   User1 (payer) balance change:
                    Initial: ${ethers.formatEther(initialUser1Balance)} COM
                    Final: ${ethers.formatEther(finalUser1Balance)} COM
                    Expected change: -${ethers.formatEther(totalFee)} COM
                    Actual change: -${ethers.formatEther(initialUser1Balance - finalUser1Balance)} COM`);
                expect(finalUser1Balance).to.equal(initialUser1Balance - totalFee, "User1 balance incorrect");

                for (let i = 0; i < medicOwners.length; i++) {
                    console.log(`   Medic${i + 1} owner (${medicOwners[i]}) balance change:
                        Initial: ${ethers.formatEther(initialMedicOwnerBalances[i])} COM
                        Final: ${ethers.formatEther(finalMedicOwnerBalances[i])} COM
                        Expected change: +${ethers.formatEther(expectedMedicFee)} COM
                        Actual change: +${ethers.formatEther(finalMedicOwnerBalances[i] - initialMedicOwnerBalances[i])} COM`);
                    expect(finalMedicOwnerBalances[i]).to.equal(
                        initialMedicOwnerBalances[i] + expectedMedicFee,
                        `Medic${i + 1} owner balance incorrect`
                    );
                }

                console.log(`   Treasury balance change:
                    Initial: ${ethers.formatEther(initialTreasuryBalance)} COM
                    Final: ${ethers.formatEther(finalTreasuryBalance)} COM
                    Expected change: +${ethers.formatEther(expectedTreasuryFee)} COM
                    Actual change: +${ethers.formatEther(finalTreasuryBalance - initialTreasuryBalance)} COM`);
                expect(finalTreasuryBalance).to.equal(initialTreasuryBalance + expectedTreasuryFee, "Treasury balance incorrect");
            });

            it("Dovrebbe curare multipli NFT con successo", async function () {
                const { medicManager, mockCOM, mockNFT, user1 } = await loadFixture(deployContractsFixture);

                // Approva COM tokens per cure multiple
                await mockCOM.connect(user1).approve(await medicManager.getAddress(), ethers.parseEther("200"));

                // Verifica salute iniziale
                expect(await mockNFT.getHealth(0)).to.equal(20);
                expect(await mockNFT.getHealth(1)).to.equal(30);

                // Esegui cura multipla
                const tx = await medicManager.connect(user1).healBatch([0, 1]);
                const receipt = await tx.wait();

                // Verifica eventi singoli di cura
                const healEvents = receipt.logs.filter(
                    log => log.fragment && log.fragment.name === "NFTHealed"
                );
                expect(healEvents).to.have.length(2);

                // Verifica evento batch
                const batchEvent = receipt.logs.find(
                    log => log.fragment && log.fragment.name === "BatchHealing"
                );
                expect(batchEvent).to.not.be.undefined;
                expect(batchEvent.args.tokenIds).to.have.length(2);
                expect(batchEvent.args.medicIds).to.have.length(2);
                expect(batchEvent.args.totalFee).to.equal(ethers.parseEther("200"));

                // Verifica salute finale
                expect(await mockNFT.getHealth(0)).to.equal(100);
                expect(await mockNFT.getHealth(1)).to.equal(100);
            });

            it("Dovrebbe fallire se il batch è vuoto", async function () {
                const { medicManager, user1 } = await loadFixture(deployContractsFixture);

                await expect(medicManager.connect(user1).healBatch([]))
                    .to.be.revertedWithCustomError(medicManager, "EmptyBatch");
            });

            it("Dovrebbe fallire se non ci sono abbastanza medici", async function () {
                const { medicManager, mockCOM, mockProfManager, user1 } = await loadFixture(deployContractsFixture);
                await mockCOM.connect(user1).approve(await medicManager.getAddress(), ethers.parseEther("300"));
                await mockProfManager.setAllMedicsOnCooldown();

                await expect(medicManager.connect(user1).healBatch([0, 1, 2]))
                    .to.be.revertedWithCustomError(medicManager, "InsufficientMedics");
            });
        });
    });

    describe("Funzioni Admin", function () {
        it("Dovrebbe permettere all'owner di modificare la healing fee", async function () {
            const { medicManager, owner } = await loadFixture(deployContractsFixture);
            const newFee = ethers.parseEther("150");

            const tx = await medicManager.connect(owner).setHealingFee(newFee);
            const receipt = await tx.wait();

            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "HealingFeeUpdated"
            );
            expect(event.args.oldFee).to.equal(ethers.parseEther("100"));
            expect(event.args.newFee).to.equal(newFee);
            expect(await medicManager.healingFee()).to.equal(newFee);
        });

        it("Dovrebbe permettere all'owner di modificare la percentuale del medico", async function () {
            const { medicManager, owner } = await loadFixture(deployContractsFixture);
            const newPercentage = 60;

            const tx = await medicManager.connect(owner).setMedicFeePercentage(newPercentage);
            const receipt = await tx.wait();

            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "MedicFeePercentageUpdated"
            );
            expect(event.args.oldPercentage).to.equal(50);
            expect(event.args.newPercentage).to.equal(newPercentage);
            expect(await medicManager.medicFeePercentage()).to.equal(newPercentage);
        });

        it("Dovrebbe permettere all'owner di aggiornare la tesoreria", async function () {
            const { medicManager, owner, user1 } = await loadFixture(deployContractsFixture);

            const tx = await medicManager.connect(owner).setTreasury(user1.address);
            const receipt = await tx.wait();

            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "TreasuryUpdated"
            );
            expect(event.args.oldTreasury).to.not.equal(user1.address);
            expect(event.args.newTreasury).to.equal(user1.address);
            expect(await medicManager.treasury()).to.equal(user1.address);
        });
    });

    describe("Sicurezza", function () {
        it("Dovrebbe impedire a non-owner di chiamare funzioni admin", async function () {
            const { medicManager, user1 } = await loadFixture(deployContractsFixture);

            await expect(medicManager.connect(user1).setHealingFee(ethers.parseEther("150")))
                .to.be.revertedWithCustomError(medicManager, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });

        it("Dovrebbe impedire healing quando in pausa", async function () {
            const { medicManager, owner, mockCOM, user1 } = await loadFixture(deployContractsFixture);

            await medicManager.connect(owner).pause();
            await mockCOM.connect(user1).approve(await medicManager.getAddress(), ethers.parseEther("100"));

            await expect(medicManager.connect(user1).heal(0))
                .to.be.revertedWithCustomError(medicManager, "EnforcedPause");
        });

        it("Dovrebbe verificare correttamente l'allowance di COM", async function () {
            const { medicManager, user1 } = await loadFixture(deployContractsFixture);

            await expect(medicManager.connect(user1).heal(0))
                .to.be.revertedWithCustomError(medicManager, "InsufficientCOMAllowance");
        });
    });
}); 