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

    const RECIPE_FEE = BigInt(ethers.parseEther("10"));
    const CRAFTING_TIME = BigInt(3600); // 1 ora
    const REQUIRED_ARTISAN_LEVEL = 1;

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
            await professionsManager.setArtisanLevel(artisan.address, REQUIRED_ARTISAN_LEVEL);

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
            await professionsManager.setArtisanLevel(artisan.address, REQUIRED_ARTISAN_LEVEL);
            await professionsManager.setAvailableCraftingSlots(artisan.address, 1);

            const tx = await craftingManager.connect(user).craft(1);
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => log.fragment && log.fragment.name === "CraftingStarted");
            expect(event.args.artisan).to.equal(artisan.address);
        });

        it("Non dovrebbe permettere il crafting se non ci sono artigiani disponibili", async function () {
            await professionsManager.setArtisanLevel(artisan.address, REQUIRED_ARTISAN_LEVEL);
            await professionsManager.setAvailableCraftingSlots(artisan.address, 0);

            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "NoAvailableArtisan");
        });

        it("Non dovrebbe permettere il crafting se gli artigiani non hanno il livello richiesto", async function () {
            await professionsManager.setArtisanLevel(artisan.address, REQUIRED_ARTISAN_LEVEL - 1);
            await professionsManager.setAvailableCraftingSlots(artisan.address, 1);

            await expect(craftingManager.connect(user).craft(1))
                .to.be.revertedWithCustomError(craftingManager, "NoAvailableArtisan");
        });
    });

    describe("Crafting Multiplo", function () {
        it("Dovrebbe gestire correttamente il crafting di ricette multiple", async function () {
            // Setup
            const materialIds = [0, 1];
            const materialAmounts = [1, 2];
            const outputURI = "ipfs://QmExample";

            // Mint dei materiali necessari
            await materialsNFT.mint(user.address, 0);
            await materialsNFT.mint(user.address, 1);
            await materialsNFT.mint(user.address, 1);

            // Crea la ricetta
            await craftingManager.addRecipe(
                materialIds,
                materialAmounts,
                RECIPE_FEE,
                outputURI,
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            // Approvazioni
            await materialsNFT.connect(user).setApprovalForAll(await craftingManager.getAddress(), true);
            await comToken.connect(user).approve(await craftingManager.getAddress(), RECIPE_FEE * 2n);

            // Avvia il primo crafting
            await craftingManager.connect(user).craft(1);

            // Mint altri materiali per il secondo crafting
            await materialsNFT.mint(user.address, 0);
            await materialsNFT.mint(user.address, 1);
            await materialsNFT.mint(user.address, 1);

            // Avvia il secondo crafting
            await craftingManager.connect(user).craft(1);

            // Verifica che ci siano due job di crafting
            const jobs = await craftingManager.getUserCraftingJobs(user.address);
            expect(jobs.length).to.equal(2);
            expect(jobs[0].completed).to.be.false;
            expect(jobs[1].completed).to.be.false;
        });

        it("Dovrebbe distribuire correttamente le fee COM tra artigiano e tesoreria", async function () {
            // Mint dei materiali necessari
            const token1 = await materialsNFT.mint(user.address, 0);
            const token2 = await materialsNFT.mint(user.address, 1);
            const token3 = await materialsNFT.mint(user.address, 1);

            const tokenIds = [
                await token1.wait().then(r => r.logs[0].args[2]),
                await token2.wait().then(r => r.logs[0].args[2]),
                await token3.wait().then(r => r.logs[0].args[2])
            ];

            // Crea una ricetta con una fee COM specifica
            const recipeFee = ethers.parseUnits("10", 18); // 10 COM
            await craftingManager.addRecipe(
                tokenIds,
                [1, 2, 1],
                recipeFee,
                "ipfs://QmExample",
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            // Imposta il livello dell'artigiano e il suo proprietario
            await professionsManager.setArtisanLevel(artisan.address, REQUIRED_ARTISAN_LEVEL + 2);

            // Verifica i bilanci iniziali
            const initialArtisanBalance = BigInt(await comToken.balanceOf(artisan.address));
            const initialTreasuryBalance = BigInt(await comToken.balanceOf(treasury.address));

            console.log("Bilanci iniziali:");
            console.log("- Artigiano:", ethers.formatEther(initialArtisanBalance), "COM");
            console.log("- Tesoreria:", ethers.formatEther(initialTreasuryBalance), "COM");

            // Approva i token necessari
            await comToken.connect(user).approve(await craftingManager.getAddress(), recipeFee);
            await materialsNFT.connect(user).setApprovalForAll(await craftingManager.getAddress(), true);

            // Avvia il crafting
            const tx = await craftingManager.connect(user).craft(1);
            const receipt = await tx.wait();

            // Trova l'evento CraftingStarted per ottenere l'artigiano selezionato
            const craftingStartedEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === "CraftingStarted"
            );
            const selectedArtisan = craftingStartedEvent.args.artisan;

            // Verifica che l'artigiano selezionato sia quello corretto
            expect(selectedArtisan).to.equal(artisan.address);

            // Verifica che l'indirizzo della tesoreria sia corretto
            expect(await craftingManager.treasury()).to.equal(treasury.address);

            // Calcola l'importo atteso per ciascuno (50% della fee)
            const ARTISAN_FEE_PERCENTAGE = 50n;
            const PERCENTAGE_BASE = 100n;
            const expectedShare = BigInt(recipeFee) * ARTISAN_FEE_PERCENTAGE / PERCENTAGE_BASE;
            console.log("Fee attesa:", ethers.formatEther(expectedShare), "COM");

            // Verifica i bilanci finali
            const finalArtisanBalance = BigInt(await comToken.balanceOf(selectedArtisan));
            const finalTreasuryBalance = BigInt(await comToken.balanceOf(treasury.address));

            console.log("Bilanci finali:");
            console.log("- Artigiano:", ethers.formatEther(finalArtisanBalance), "COM");
            console.log("- Tesoreria:", ethers.formatEther(finalTreasuryBalance), "COM");

            // Verifica che l'artigiano abbia ricevuto il 50% della fee
            expect(finalArtisanBalance - initialArtisanBalance).to.equal(expectedShare);

            // Verifica che la tesoreria abbia ricevuto il 50% della fee
            expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedShare);

            // Verifica che il totale delle fee sia stato distribuito correttamente
            const totalDistributed = (finalArtisanBalance - initialArtisanBalance) + 
                                   (finalTreasuryBalance - initialTreasuryBalance);
            expect(totalDistributed).to.equal(BigInt(recipeFee));
        });

        it("Dovrebbe completare correttamente il crafting e mintare l'NFT all'utente", async function () {
            // Setup iniziale
            const token1 = await materialsNFT.mint(user.address, 0);
            const token2 = await materialsNFT.mint(user.address, 1);
            const token3 = await materialsNFT.mint(user.address, 1);

            const tokenIds = [
                await token1.wait().then(r => r.logs[0].args[2]),
                await token2.wait().then(r => r.logs[0].args[2]),
                await token3.wait().then(r => r.logs[0].args[2])
            ];

            // Crea la ricetta
            await craftingManager.addRecipe(
                [tokenIds[0], tokenIds[1]],
                [1, 2],
                RECIPE_FEE,
                "ipfs://QmExample",
                CRAFTING_TIME,
                REQUIRED_ARTISAN_LEVEL
            );

            // Setup artigiano
            await professionsManager.setArtisanLevel(artisan.address, REQUIRED_ARTISAN_LEVEL + 2);

            // Approva i token
            await comToken.connect(user).approve(await craftingManager.getAddress(), RECIPE_FEE);
            await materialsNFT.connect(user).setApprovalForAll(await craftingManager.getAddress(), true);

            // Avvia il crafting
            await craftingManager.connect(user).craft(1);

            // Verifica che il CraftingManager abbia il ruolo MINTER_ROLE
            const hasMinterRole = await mockCraftedItemNFT.hasRole(
                await mockCraftedItemNFT.MINTER_ROLE(),
                await craftingManager.getAddress()
            );
            expect(hasMinterRole, "CraftingManager non ha il ruolo MINTER_ROLE").to.be.true;

            // Simula il passaggio del tempo per completare il craft
            await ethers.provider.send("evm_increaseTime", [Number(CRAFTING_TIME)]);
            await ethers.provider.send("evm_mine");

            // Ottieni i job di crafting dell'utente
            const userJobs = await craftingManager.getUserCraftingJobs(user.address);
            const jobIndex = userJobs.length - 1;

            // Completa il craft
            const completeTx = await craftingManager.connect(user).completeCrafting(jobIndex);
            const completeReceipt = await completeTx.wait();

            // Trova l'evento CraftedItemMinted dal contratto MockCraftedItemNFT
            const mockCraftedItemNFTAddress = await mockCraftedItemNFT.getAddress();
            const mintEvent = completeReceipt.logs.find(
                log => {
                    if (log.address.toLowerCase() !== mockCraftedItemNFTAddress.toLowerCase()) {
                        return false;
                    }
                    try {
                        const event = mockCraftedItemNFT.interface.parseLog(log);
                        return event.name === "CraftedItemMinted";
                    } catch (e) {
                        return false;
                    }
                }
            );

            console.log("Logs della transazione:", completeReceipt.logs.map(log => {
                try {
                    const parsedLog = mockCraftedItemNFT.interface.parseLog(log);
                    return {
                        address: log.address,
                        name: parsedLog.name,
                        args: parsedLog.args
                    };
                } catch (e) {
                    return {
                        address: log.address,
                        raw: log
                    };
                }
            }));

            expect(mintEvent, "L'evento CraftedItemMinted non è stato emesso").to.not.be.undefined;

            // Parsifica l'evento per ottenere gli argomenti
            const parsedEvent = mockCraftedItemNFT.interface.parseLog(mintEvent);
            const tokenId = parsedEvent.args[1]; // Il tokenId è il secondo argomento

            // Verifica che l'NFT sia stato mintato all'utente
            expect(await mockCraftedItemNFT.ownerOf(tokenId)).to.equal(user.address);

            // Verifica che l'URI del token sia corretto
            const recipe = await craftingManager.recipes(1);
            expect(await mockCraftedItemNFT.tokenURI(tokenId)).to.equal(recipe.outputURI);
        });
    });
}); 