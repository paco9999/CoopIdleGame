const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CraftedItemNFT", function () {
    let CraftedItemNFT;
    let craftedItemNFT;
    let owner;
    let addr1;
    let addr2;
    let minter;
    let recipeId;
    let baseURI;
    let outputURI;

    async function deployFixture() {
        const [_owner, _addr1, _addr2, _minter] = await ethers.getSigners();

        baseURI = "https://api.example.com/token/";
        outputURI = "https://api.example.com/crafted/1.json";
        recipeId = 1;

        const CraftedItemNFTFactory = await ethers.getContractFactory("CraftedItemNFT");
        const _craftedItemNFT = await upgrades.deployProxy(CraftedItemNFTFactory, [
            "CraftedItemNFT",
            "CITEM",
            baseURI
        ], {
            initializer: 'initialize',
            kind: 'uups'
        });

        return {
            craftedItemNFT: _craftedItemNFT,
            owner: _owner,
            addr1: _addr1,
            addr2: _addr2,
            minter: _minter
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployFixture);

        CraftedItemNFT = fixture.craftedItemNFT;
        craftedItemNFT = fixture.craftedItemNFT;
        owner = fixture.owner;
        addr1 = fixture.addr1;
        addr2 = fixture.addr2;
        minter = fixture.minter;

        // Concedi il ruolo MINTER a minter
        await craftedItemNFT.grantRole(await craftedItemNFT.MINTER_ROLE(), minter.address);
    });

    describe("Deployment", function () {
        it("Dovrebbe impostare correttamente il nome e il simbolo", async function () {
            expect(await craftedItemNFT.name()).to.equal("CraftedItemNFT");
            expect(await craftedItemNFT.symbol()).to.equal("CITEM");
        });

        it("Dovrebbe impostare correttamente il base URI", async function () {
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);
            expect(await craftedItemNFT.tokenURI(0)).to.equal(outputURI);
        });

        it("Dovrebbe assegnare il ruolo DEFAULT_ADMIN_ROLE all'owner", async function () {
            expect(await craftedItemNFT.hasRole(await craftedItemNFT.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
        });

        it("Dovrebbe assegnare il ruolo MINTER_ROLE all'owner", async function () {
            expect(await craftedItemNFT.hasRole(await craftedItemNFT.MINTER_ROLE(), owner.address)).to.be.true;
        });
    });

    describe("Minting", function () {
        it("Dovrebbe permettere al minter di mintare un oggetto craftato", async function () {
            await expect(craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI))
                .to.emit(craftedItemNFT, "CraftedItemMinted")
                .withArgs(addr1.address, 0, recipeId, outputURI);

            expect(await craftedItemNFT.ownerOf(0)).to.equal(addr1.address);
            expect(await craftedItemNFT.tokenURI(0)).to.equal(outputURI);
        });

        it("Non dovrebbe permettere a un non-minter di mintare", async function () {
            await expect(craftedItemNFT.connect(addr1).mintCraftedItem(addr1.address, recipeId, outputURI))
                .to.be.revertedWithCustomError(craftedItemNFT, "AccessControlUnauthorizedAccount");
        });

        it("Non dovrebbe permettere di mintare a un indirizzo zero", async function () {
            await expect(craftedItemNFT.connect(minter).mintCraftedItem(ethers.ZeroAddress, recipeId, outputURI))
                .to.be.revertedWithCustomError(craftedItemNFT, "InvalidAddress");
        });

        it("Non dovrebbe permettere di mintare con URI vuoto", async function () {
            await expect(craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, ""))
                .to.be.revertedWithCustomError(craftedItemNFT, "InvalidURI");
        });

        it("Dovrebbe incrementare correttamente il tokenId", async function () {
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);
            await craftedItemNFT.connect(minter).mintCraftedItem(addr2.address, recipeId + 1, outputURI);

            expect(await craftedItemNFT.ownerOf(0)).to.equal(addr1.address);
            expect(await craftedItemNFT.ownerOf(1)).to.equal(addr2.address);
        });
    });

    describe("Burning", function () {
        beforeEach(async function () {
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);
        });

        it("Dovrebbe permettere al minter di bruciare un oggetto craftato", async function () {
            await expect(craftedItemNFT.connect(minter).burnCraftedItem(0))
                .to.emit(craftedItemNFT, "CraftedItemBurned")
                .withArgs(addr1.address, 0);

            await expect(craftedItemNFT.ownerOf(0)).to.be.reverted;
        });

        it("Non dovrebbe permettere a un non-minter di bruciare", async function () {
            await expect(craftedItemNFT.connect(addr1).burnCraftedItem(0))
                .to.be.revertedWithCustomError(craftedItemNFT, "AccessControlUnauthorizedAccount");
        });

        it("Non dovrebbe permettere di bruciare un token inesistente", async function () {
            await expect(craftedItemNFT.connect(minter).burnCraftedItem(999))
                .to.be.revertedWithCustomError(craftedItemNFT, "TokenNotExists");
        });
    });

    describe("Attributes Management", function () {
        let attributes;

        beforeEach(async function () {
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);

            attributes = {
                recipeId: recipeId,
                craftedAt: Math.floor(Date.now() / 1000),
                crafter: addr1.address,
                name: "Spada Magica",
                description: "Una spada potenziata con magia",
                traits: ["magico", "tagliente", "raro"]
            };
        });

        it("Dovrebbe permettere al minter di impostare gli attributi", async function () {
            await expect(craftedItemNFT.connect(minter).setCraftedItemAttributes(0, attributes))
                .to.emit(craftedItemNFT, "CraftedItemAttributesUpdated")
                .withArgs(0);

            const storedAttributes = await craftedItemNFT.getCraftedItemAttributes(0);
            expect(storedAttributes.recipeId).to.equal(attributes.recipeId);
            expect(storedAttributes.craftedAt).to.equal(attributes.craftedAt);
            expect(storedAttributes.crafter).to.equal(attributes.crafter);
            expect(storedAttributes.name).to.equal(attributes.name);
            expect(storedAttributes.description).to.equal(attributes.description);
            expect(storedAttributes.traits).to.deep.equal(attributes.traits);
        });

        it("Non dovrebbe permettere a un non-minter di impostare gli attributi", async function () {
            await expect(craftedItemNFT.connect(addr1).setCraftedItemAttributes(0, attributes))
                .to.be.revertedWithCustomError(craftedItemNFT, "AccessControlUnauthorizedAccount");
        });

        it("Non dovrebbe permettere di impostare attributi per un token inesistente", async function () {
            await expect(craftedItemNFT.connect(minter).setCraftedItemAttributes(999, attributes))
                .to.be.revertedWithCustomError(craftedItemNFT, "TokenNotExists");
        });
    });

    describe("Admin Functions", function () {
        it("Dovrebbe permettere all'admin di aggiornare il base URI", async function () {
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);

            const newBaseURI = "https://api.example.com/new/";
            await craftedItemNFT.setBaseURI(newBaseURI);
            expect(await craftedItemNFT.tokenURI(0)).to.equal(outputURI);
        });

        it("Non dovrebbe permettere a un non-admin di aggiornare il base URI", async function () {
            const newBaseURI = "https://api.example.com/new/";
            await expect(craftedItemNFT.connect(addr1).setBaseURI(newBaseURI))
                .to.be.reverted;
        });

        it("Dovrebbe permettere all'admin di mettere in pausa il contratto", async function () {
            await craftedItemNFT.pause();
            expect(await craftedItemNFT.paused()).to.be.true;

            await craftedItemNFT.unpause();
            expect(await craftedItemNFT.paused()).to.be.false;
        });

        it("Non dovrebbe permettere a un non-admin di mettere in pausa il contratto", async function () {
            await expect(craftedItemNFT.connect(addr1).pause())
                .to.be.reverted;
        });
    });

    describe("Pausa e Sicurezza", function () {
        beforeEach(async function () {
            await craftedItemNFT.pause();
        });

        it("Non dovrebbe permettere il minting quando il contratto è in pausa", async function () {
            await expect(craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI))
                .to.be.revertedWithCustomError(craftedItemNFT, "EnforcedPause");
        });

        it("Non dovrebbe permettere il burning quando il contratto è in pausa", async function () {
            await craftedItemNFT.unpause();
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);
            await craftedItemNFT.pause();

            await expect(craftedItemNFT.connect(minter).burnCraftedItem(0))
                .to.be.revertedWithCustomError(craftedItemNFT, "EnforcedPause");
        });

        it("Non dovrebbe permettere di impostare attributi quando il contratto è in pausa", async function () {
            await craftedItemNFT.unpause();
            await craftedItemNFT.connect(minter).mintCraftedItem(addr1.address, recipeId, outputURI);
            await craftedItemNFT.pause();

            const attributes = {
                recipeId: recipeId,
                craftedAt: Math.floor(Date.now() / 1000),
                crafter: addr1.address,
                name: "Spada Magica",
                description: "Una spada potenziata con magia",
                traits: ["magico", "tagliente", "raro"]
            };

            await expect(craftedItemNFT.connect(minter).setCraftedItemAttributes(0, attributes))
                .to.be.revertedWithCustomError(craftedItemNFT, "EnforcedPause");
        });
    });
}); 