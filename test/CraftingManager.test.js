// Test file for CraftingManager contract 
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("CraftingManager", function () {
    let craftingManager;
    let comToken;
    let materialsNFT;
    let mockCraftedItemNFT;
    let professionsManager;
    let owner;
    let artisan;
    let user;
    let treasury;
    let artisanOwner;

    const RECIPE_FEE = ethers.parseEther("10");
    const CRAFTING_TIME = 3600n; // 1 ora
    const REQUIRED_ARTISAN_LEVEL = 1;
    const ARTISAN_FEE_PERCENTAGE = 50n;
    const PERCENTAGE_BASE = 100n;

    beforeEach(async function () {
        try {
            console.log("Getting signers...");
            [owner, artisan, user, treasury, artisanOwner] = await ethers.getSigners();

            console.log("Deploying MockERC20...");
            const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
            comToken = await MockERC20.deploy("COM Token", "COM");
            await comToken.waitForDeployment();

            console.log("Deploying mock contracts...");
            const MockMaterialsNFT = await ethers.getContractFactory("MockMaterialsNFT");
            materialsNFT = await MockMaterialsNFT.deploy();
            await materialsNFT.waitForDeployment();

            const MockCraftedItemNFT = await ethers.getContractFactory("MockCraftedItemNFT");
            mockCraftedItemNFT = await MockCraftedItemNFT.deploy();
            await mockCraftedItemNFT.waitForDeployment();

            const MockProfessionsManager = await ethers.getContractFactory("MockProfessionsManager");
            professionsManager = await MockProfessionsManager.deploy();
            await professionsManager.waitForDeployment();

            console.log("Deploying CraftingManager...");
            const CraftingManager = await ethers.getContractFactory("CraftingManager");
            craftingManager = await upgrades.deployProxy(CraftingManager, [
                await comToken.getAddress(),
                await mockCraftedItemNFT.getAddress(),
                await professionsManager.getAddress(),
                treasury.address
            ]);
            await craftingManager.waitForDeployment();

            console.log("Setting up roles and initial token distribution...");
            await mockCraftedItemNFT.grantRole(await mockCraftedItemNFT.MINTER_ROLE(), await craftingManager.getAddress());
            await craftingManager.setMaterialsNFT(await materialsNFT.getAddress());
            await comToken.transfer(user.address, ethers.parseUnits("500", 18));
            await comToken.transfer(artisan.address, ethers.parseUnits("500", 18));

            // Setup artigiano
            console.log("   Setting up artisan...");
            const artisanTokenId = 1;
            await professionsManager.assignProfession(artisanTokenId, 1); // ARTISAN = 1
            await professionsManager.setTokenOwner(artisanTokenId, artisan.address);
            await professionsManager.setArtisanLevel(artisanTokenId, REQUIRED_ARTISAN_LEVEL);
            console.log("   Artisan token ID:", artisanTokenId);
            await professionsManager.setCraftingManager(await craftingManager.getAddress());

            console.log("🔧 Setup materiali utente...");
            // Mint dei materiali con tipi specifici
            await materialsNFT.mint(user.address, 0); // 1x tipo 0
            await materialsNFT.mint(user.address, 1); // 2x tipo 1
            await materialsNFT.mint(user.address, 1);

            // Crea la ricetta con i tipi di token
            await craftingManager.addRecipe(
                [0, 1], // Usa i tipi di token invece degli ID
                [1, 2], // Quantità richieste
                RECIPE_FEE,
                "ipfs://QmExample",
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

        } catch (error) {
            console.error("Error in beforeEach:", error);
            throw error;
        }
    });

    describe("Inizializzazione", function () {
        it("Dovrebbe inizializzare correttamente il contratto", async function () {
            expect(await craftingManager.comToken()).to.equal(await comToken.getAddress());
            expect(await craftingManager.materialsNFT()).to.equal(await materialsNFT.getAddress());
            expect(await craftingManager.craftedItemNFT()).to.equal(await mockCraftedItemNFT.getAddress());
            expect(await craftingManager.professionsManager()).to.equal(await professionsManager.getAddress());
            expect(await craftingManager.treasury()).to.equal(treasury.address);
        });
    });

    describe("Gestione Ricette", function () {
        it("Dovrebbe aggiungere una nuova ricetta correttamente", async function () {
            console.log("🔍 Aggiunta nuova ricetta...");
            const materialIds = [0, 1];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            await craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            console.log("🔍 Verifica dettagli ricetta...");
            const recipe = await craftingManager.recipes(1);
            expect(recipe.feeCOM).to.equal(RECIPE_FEE);
            expect(recipe.craftingTime).to.equal(CRAFTING_TIME);
            expect(recipe.requiredArtisanLevel).to.equal(REQUIRED_ARTISAN_LEVEL);
            expect(recipe.active).to.be.true;
            expect(recipe.outputURI).to.equal(outputURI);

            console.log("✅ Ricetta aggiunta e verificata correttamente");
        });

        it("Non dovrebbe permettere l'aggiunta di ricette con array di materiali non validi", async function () {
            console.log("🔍 Test validazione array materiali...");
            const materialIds = [0];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            await expect(craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            )).to.be.revertedWithCustomError(craftingManager, "InvalidMaterialArrays");

            console.log("✅ Validazione array materiali funziona correttamente");
        });
    });

    describe("Processo di Crafting", function () {
        beforeEach(async function () {
            console.log("🔧 Setup ricetta di test...");
            const materialIds = [0, 1];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            // Mint dei materiali necessari
            await materialsNFT.mint(user.address, 0);
            await materialsNFT.mint(user.address, 1);
            await materialsNFT.mint(user.address, 1);

            await craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            console.log("🔧 Approvazione token COM e materiali...");
            await materialsNFT.connect(user).setApprovalForAll(await craftingManager.getAddress(), true);
            await comToken.connect(user).approve(await craftingManager.getAddress(), RECIPE_FEE);
        });

        it("Dovrebbe avviare il crafting correttamente", async function () {
            const tx = await craftingManager.connect(user).craft(1);
            const receipt = await tx.wait();

            // Verifica che l'evento CraftingStarted sia stato emesso
            const craftingStartedEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === "CraftingStarted"
            );
            expect(craftingStartedEvent).to.not.be.undefined;

            // Verifica i parametri dell'evento
            const { user: eventUser, recipeId, artisan: eventArtisan, endTime } = craftingStartedEvent.args;
            expect(eventUser).to.equal(user.address);
            expect(recipeId).to.equal(1);
            expect(eventArtisan).to.equal(artisan.address);
            expect(endTime).to.be.gt(0);
        });

        it("Non dovrebbe permettere di completare il crafting prima del tempo", async function () {
            // Setup: avvia il crafting
            const tx = await craftingManager.connect(user).craft(1);
            await tx.wait();

            // Prova a completare il crafting immediatamente
            await expect(
                craftingManager.connect(user).completeCrafting(0)
            ).to.be.revertedWithCustomError(craftingManager, "CraftingNotCompleted");

            // Avanza il tempo ma non abbastanza
            await ethers.provider.send("evm_increaseTime", [Number(CRAFTING_TIME) / 2]);
            await ethers.provider.send("evm_mine");

            // Prova a completare il crafting a metà del tempo richiesto
            await expect(
                craftingManager.connect(user).completeCrafting(0)
            ).to.be.revertedWithCustomError(craftingManager, "CraftingNotCompleted");

            // Avanza il tempo fino al completamento
            await ethers.provider.send("evm_increaseTime", [Number(CRAFTING_TIME) / 2]);
            await ethers.provider.send("evm_mine");

            // Ora dovrebbe funzionare
            await expect(
                craftingManager.connect(user).completeCrafting(0)
            ).to.not.be.reverted;
        });
    });

    describe("Gestione Errori", function () {
        it("Dovrebbe gestire correttamente i casi di materiali insufficienti", async function () {
            console.log("🔍 Setup ricetta...");
            const [admin, user] = await ethers.getSigners();
            await materialsNFT.mint(user.address, 0); // Solo 1x tipo 0

            await craftingManager.connect(admin).addRecipe(
                [0], // Richiede 2x tipo 0
                [2], // Quantità richiesta
                RECIPE_FEE,
                "ipfs://QmExample",
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            console.log("🔍 Test crafting con materiali insufficienti...");
            await comToken.connect(user).approve(await craftingManager.getAddress(), RECIPE_FEE);
            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "InsufficientMaterials");
        });

        it("Dovrebbe gestire correttamente i casi di COM insufficienti", async function () {
            console.log("🔍 Setup ricetta...");
            await materialsNFT.mint(user.address, 0); // 1x tipo 0
            await materialsNFT.mint(user.address, 1); // 2x tipo 1
            await materialsNFT.mint(user.address, 1);

            const highFee = ethers.parseUnits("1000", 18); // Fee maggiore del balance
            await craftingManager.addRecipe(
                [0, 1], // Usa i tipi di token
                [1, 2],
                highFee,
                "ipfs://QmExample",
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            // Assicurati che l'utente non abbia abbastanza COM
            await comToken.connect(user).transfer(treasury.address, await comToken.balanceOf(user.address));
            expect(await comToken.balanceOf(user.address)).to.equal(0);

            await comToken.connect(user).approve(await craftingManager.getAddress(), highFee);
            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "InsufficientCOMBalance");
        });
    });

    describe("Funzionalità Admin", function () {
        it("Dovrebbe permettere l'aggiornamento dei parametri di una ricetta", async function () {
            console.log("🔍 Setup e aggiornamento ricetta...");
            const materialIds = [0, 1];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            await craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            const newFeeCOM = ethers.parseUnits("2", 18);
            const newCraftingTime = 7200;
            const newRequiredLevel = 2;

            await craftingManager.updateRecipeParameters(1, newFeeCOM, newCraftingTime, newRequiredLevel);

            console.log("🔍 Verifica aggiornamenti...");
            const recipe = await craftingManager.recipes(1);
            expect(recipe.feeCOM).to.equal(newFeeCOM);
            expect(recipe.craftingTime).to.equal(newCraftingTime);
            expect(recipe.requiredArtisanLevel).to.equal(newRequiredLevel);

            console.log("✅ Aggiornamento parametri ricetta funziona correttamente");
        });

        it("Dovrebbe permettere la disattivazione di una ricetta", async function () {
            console.log("🔍 Setup e disattivazione ricetta...");
            const materialIds = [0, 1];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            await craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            await craftingManager.deactivateRecipe(1);

            console.log("🔍 Verifica disattivazione...");
            const recipe = await craftingManager.recipes(1);
            expect(recipe.active).to.be.false;

            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "RecipeNotActive");
        });
    });

    describe("Selezione Artigiano", function () {
        beforeEach(async function () {
            console.log("🔧 Setup ricetta base...");
            const materialIds = [0, 1];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            console.log("🔧 Setup materiali utente...");
            await materialsNFT.mint(user.address, 0);
            await materialsNFT.mint(user.address, 1);
            await materialsNFT.mint(user.address, 1);

            await craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            await materialsNFT.connect(user).setApprovalForAll(await craftingManager.getAddress(), true);
            await comToken.connect(user).approve(await craftingManager.getAddress(), RECIPE_FEE);
        });

        it("Dovrebbe selezionare il primo artigiano con slot libero", async function () {
            const artisanTokenId = 1;
            await professionsManager.assignProfession(artisanTokenId, 1); // ARTISAN = 1
            await professionsManager.setTokenOwner(artisanTokenId, artisan.address);
            await professionsManager.setArtisanLevel(artisanTokenId, REQUIRED_ARTISAN_LEVEL);
            await professionsManager.setAvailableCraftingSlots(artisanTokenId, 1);

            const tx = await craftingManager.connect(user).craft(1);
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => log.fragment && log.fragment.name === "CraftingStarted");
            expect(event.args.artisan).to.equal(artisan.address);
        });

        it("Non dovrebbe permettere il crafting se non ci sono artigiani disponibili", async function () {
            const artisanTokenId = 1;
            await professionsManager.assignProfession(artisanTokenId, 1); // ARTISAN = 1
            await professionsManager.setTokenOwner(artisanTokenId, artisan.address);
            await professionsManager.setArtisanLevel(artisanTokenId, REQUIRED_ARTISAN_LEVEL);
            await professionsManager.setAvailableCraftingSlots(artisanTokenId, 0);

            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "NoAvailableArtisan");
        });

        it("Non dovrebbe permettere il crafting se gli artigiani non hanno il livello richiesto", async function () {
            const artisanTokenId = 1;
            await professionsManager.assignProfession(artisanTokenId, 1); // ARTISAN = 1
            await professionsManager.setTokenOwner(artisanTokenId, artisan.address);
            await professionsManager.setArtisanLevel(artisanTokenId, REQUIRED_ARTISAN_LEVEL - 1);
            await professionsManager.setAvailableCraftingSlots(artisanTokenId, 1);

            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "NoAvailableArtisan");
        });
    });

    describe("Crafting Multiplo", function () {
        let recipeId;

        beforeEach(async function () {
            const artisanTokenId = 1;
            await professionsManager.assignProfession(artisanTokenId, 1); // ARTISAN = 1
            await professionsManager.setTokenOwner(artisanTokenId, artisan.address);
            await professionsManager.setArtisanLevel(artisanTokenId, REQUIRED_ARTISAN_LEVEL);
            await professionsManager.setAvailableCraftingSlots(artisanTokenId, 5);
            await professionsManager.setCraftingManager(await craftingManager.getAddress());

            // Setup ricetta base senza materiali
            const tx = await craftingManager.connect(owner).addRecipe(
                [],
                [],
                RECIPE_FEE,
                "ipfs://QmExample",
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment && log.fragment.name === "RecipeAdded");
            recipeId = event.args.recipeId;

            await materialsNFT.connect(user).setApprovalForAll(await craftingManager.getAddress(), true);
            await comToken.connect(user).approve(await craftingManager.getAddress(), RECIPE_FEE * 3n);
        });

        it("Dovrebbe gestire correttamente il crafting di ricette multiple", async function () {
            // Avvia 3 crafting
            for (let i = 0; i < 3; i++) {
                await craftingManager.connect(user).craft(recipeId);
            }

            // Verifica che gli slot siano stati occupati
            const availableSlots = await professionsManager.getAvailableCraftingSlots(1);
            expect(availableSlots).to.equal(2n);
        });

        it("Dovrebbe distribuire correttamente le fee COM tra artigiano e tesoreria", async function () {
            const artisanBalanceBefore = await comToken.balanceOf(artisan.address);
            const treasuryBalanceBefore = await comToken.balanceOf(treasury.address);

            await craftingManager.connect(user).craft(recipeId);

            const artisanFee = RECIPE_FEE * ARTISAN_FEE_PERCENTAGE / PERCENTAGE_BASE;
            const treasuryFee = RECIPE_FEE - artisanFee;

            expect(await comToken.balanceOf(artisan.address)).to.equal(artisanBalanceBefore + artisanFee);
            expect(await comToken.balanceOf(treasury.address)).to.equal(treasuryBalanceBefore + treasuryFee);
        });

        it("Dovrebbe completare correttamente il crafting e mintare l'NFT all'utente", async function () {
            const tx = await craftingManager.connect(user).craft(recipeId);
            const receipt = await tx.wait();

            // Avanza il tempo
            await ethers.provider.send("evm_increaseTime", [Number(CRAFTING_TIME) + 1]);
            await ethers.provider.send("evm_mine");

            // Completa il crafting
            await craftingManager.connect(user).completeCrafting(0); // Usa l'indice del job invece dell'ID

            // Verifica che l'NFT sia stato mintato
            const balance = await mockCraftedItemNFT.balanceOf(user.address);
            expect(balance).to.equal(1n);
        });
    });
}); 