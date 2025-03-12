const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MaterialsLib", function () {
    let materialsNFT;
    let owner;

    before(async function () {
        [owner] = await ethers.getSigners();

        // Deploy del contratto MaterialsNFT che utilizza la libreria
        const MaterialsNFT = await ethers.getContractFactory("MaterialsNFT");
        materialsNFT = await upgrades.deployProxy(MaterialsNFT, ["https://api.example.com"]);
        await materialsNFT.waitForDeployment();
    });

    describe("Range di Rarità", function () {
        it("Dovrebbe mintare materiali nel range corretto per ogni rarità", async function () {
            const ranges = [
                { rarity: 0, start: 0, end: 4 },   // COMMON
                { rarity: 1, start: 5, end: 9 },   // RARE
                { rarity: 2, start: 10, end: 14 }, // EPIC
                { rarity: 3, start: 15, end: 19 }  // LEGENDARY
            ];

            for (const range of ranges) {
                // Minta 5 materiali per ogni rarità
                for (let i = 0; i < 5; i++) {
                    const tx = await materialsNFT.mint(owner.address, range.rarity);
                    const receipt = await tx.wait();
                    
                    // Trova l'evento di mint per ottenere il token ID
                    const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'Transfer');
                    const tokenId = event.args[2];
                    
                    const material = await materialsNFT.getMaterial(tokenId);
                    expect(material).to.be.greaterThanOrEqual(range.start);
                    expect(material).to.be.lessThanOrEqual(range.end);
                }
            }
        });
    });

    describe("Rarità dei Materiali", function () {
        it("Dovrebbe assegnare la rarità corretta per ogni materiale", async function () {
            // Minta un materiale per ogni rarità
            for (let r = 0; r < 4; r++) {
                const tx = await materialsNFT.mint(owner.address, r);
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'Transfer');
                const tokenId = event.args[2];
                
                const rarity = await materialsNFT.getRarity(tokenId);
                expect(rarity).to.equal(r);
            }
        });
    });

    describe("URI dei Materiali", function () {
        it("Dovrebbe generare URI corretti per ogni rarità", async function () {
            const rarityPaths = [
                "materials/common/",
                "materials/rare/",
                "materials/epic/",
                "materials/legendary/"
            ];

            // Minta un materiale per ogni rarità
            for (let r = 0; r < 4; r++) {
                const tx = await materialsNFT.mint(owner.address, r);
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'Transfer');
                const tokenId = event.args[2];
                
                const uri = await materialsNFT.tokenURI(tokenId);
                expect(uri).to.include(rarityPaths[r]);
            }
        });

        it("Dovrebbe mantenere la coerenza tra materiale e URI", async function () {
            const materialSlugs = [
                // Comuni
                ["wood", "stone", "iron_ore", "copper_ore", "leather"],
                // Rari
                ["silver_ore", "gold_ore", "mithril_ore", "moonstone", "stardust"],
                // Epici
                ["dragon_scale", "phoenix_feather", "void_crystal", "ancient_wood", "celestial_ore"],
                // Leggendari
                ["eternal_flame", "cosmic_dust", "divine_metal", "chaos_essence", "infinity_stone"]
            ];

            // Minta alcuni materiali
            for (let r = 0; r < 4; r++) {
                const tx = await materialsNFT.mint(owner.address, r);
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'Transfer');
                const tokenId = event.args[2];
                
                const material = await materialsNFT.getMaterial(tokenId);
                const uri = await materialsNFT.tokenURI(tokenId);
                const rarity = await materialsNFT.getRarity(tokenId);

                // Verifica che l'URI contenga il percorso corretto in base alla rarità
                if (rarity == 0) {
                    expect(uri).to.include("materials/common/");
                } else if (rarity == 1) {
                    expect(uri).to.include("materials/rare/");
                } else if (rarity == 2) {
                    expect(uri).to.include("materials/epic/");
                } else {
                    expect(uri).to.include("materials/legendary/");
                }

                // Verifica che l'URI contenga lo slug corretto per il materiale
                const materialId = Number(material);
                const rarityIndex = Math.floor(materialId / 5);
                const slugIndex = materialId % 5;
                const expectedSlug = materialSlugs[rarityIndex][slugIndex];
                expect(uri).to.include(expectedSlug);
            }
        });
    });

    describe("Integrazione delle Funzionalità", function () {
        it("Dovrebbe mantenere la coerenza tra rarità e range dei materiali", async function () {
            // Minta materiali per ogni rarità
            for (let r = 0; r < 4; r++) {
                const tx = await materialsNFT.mint(owner.address, r);
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'Transfer');
                const tokenId = event.args[2];
                
                const material = await materialsNFT.getMaterial(tokenId);
                const rarity = await materialsNFT.getRarity(tokenId);

                // Verifica che il materiale sia nel range corretto per la sua rarità
                if (rarity == 0) {
                    expect(material).to.be.lessThanOrEqual(4);
                } else if (rarity == 1) {
                    expect(material).to.be.greaterThanOrEqual(5);
                    expect(material).to.be.lessThanOrEqual(9);
                } else if (rarity == 2) {
                    expect(material).to.be.greaterThanOrEqual(10);
                    expect(material).to.be.lessThanOrEqual(14);
                } else {
                    expect(material).to.be.greaterThanOrEqual(15);
                    expect(material).to.be.lessThanOrEqual(19);
                }
            }
        });
    });
}); 