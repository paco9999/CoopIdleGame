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
        await mockCOM.mint(user1.address, ethers.parseEther("1000"));
        await mockCOM.mint(user2.address, ethers.parseEther("1000"));
        await mockCOM.mint(user3.address, ethers.parseEther("1000"));

        // Mint NFTs con salute bassa
        console.log("   Minting NFTs with low health...");
        await mockNFT.safeMint(user1.address); // tokenId 0
        await mockNFT.safeMint(user2.address); // tokenId 1
        await mockNFT.safeMint(user3.address); // tokenId 2

        console.log("   Setting initial health values...");
        await mockNFT.setHealth(0, 20);
        await mockNFT.setHealth(1, 30);
        await mockNFT.setHealth(2, 40);

        // Mint Medic NFTs
        console.log("   Minting and assigning Medic NFTs...");
        await mockNFT.safeMint(user1.address); // tokenId 3 (Medic)
        await mockNFT.safeMint(user2.address); // tokenId 4 (Medic)
        await mockProfManager.assignProfession(3, 1);
        await mockProfManager.assignProfession(4, 1);

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