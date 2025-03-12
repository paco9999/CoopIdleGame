const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("MaterialsNFT", function () {
    let materialsNFT;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    const BASE_URI = "https://api.example.com";

    beforeEach(async function () {
        // Setup degli account
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // Deploy del contratto
        const MaterialsNFT = await ethers.getContractFactory("MaterialsNFT");
        materialsNFT = await upgrades.deployProxy(MaterialsNFT, [BASE_URI]);
        await materialsNFT.waitForDeployment();
    });

    describe("Inizializzazione", function () {
        it("Dovrebbe impostare il nome e il simbolo corretti", async function () {
            expect(await materialsNFT.name()).to.equal("Materials NFT");
            expect(await materialsNFT.symbol()).to.equal("MAT");
        });

        it("Dovrebbe impostare il baseURI corretto", async function () {
            await materialsNFT.mint(addr1.address, 0);
            const tokenURI = await materialsNFT.tokenURI(0);
            expect(tokenURI.startsWith(BASE_URI)).to.be.true;
        });

        it("Dovrebbe impostare l'owner corretto", async function () {
            expect(await materialsNFT.owner()).to.equal(owner.address);
        });
    });

    describe("Minting", function () {
        it("Solo l'owner può mintare", async function () {
            await expect(
                materialsNFT.connect(addr1).mint(addr2.address, 0)
            ).to.be.revertedWithCustomError(materialsNFT, "OwnableUnauthorizedAccount");
        });

        it("Non dovrebbe permettere il mint a indirizzo zero", async function () {
            await expect(
                materialsNFT.mint(ethers.ZeroAddress, 0)
            ).to.be.revertedWithCustomError(materialsNFT, "InvalidAddress");
        });

        it("Non dovrebbe permettere rarità invalide", async function () {
            await expect(
                materialsNFT.mint(addr1.address, 4)
            ).to.be.revertedWithCustomError(materialsNFT, "InvalidRarity");
        });

        it("Dovrebbe mintare materiali comuni (0-4) con URI corretto", async function () {
            await materialsNFT.mint(addr1.address, 0);
            const tokenId = 0;
            const material = await materialsNFT.getMaterial(tokenId);
            const rarity = await materialsNFT.getRarity(tokenId);
            const tokenURI = await materialsNFT.tokenURI(tokenId);
            
            expect(material).to.be.lessThanOrEqual(4);
            expect(rarity).to.equal(0);
            expect(tokenURI).to.include("materials/common/");
        });

        it("Dovrebbe mintare materiali rari (5-9) con URI corretto", async function () {
            await materialsNFT.mint(addr1.address, 1);
            const tokenId = 0;
            const material = await materialsNFT.getMaterial(tokenId);
            const rarity = await materialsNFT.getRarity(tokenId);
            const tokenURI = await materialsNFT.tokenURI(tokenId);
            
            expect(material).to.be.greaterThanOrEqual(5);
            expect(material).to.be.lessThanOrEqual(9);
            expect(rarity).to.equal(1);
            expect(tokenURI).to.include("materials/rare/");
        });

        it("Dovrebbe mintare materiali epici (10-14) con URI corretto", async function () {
            await materialsNFT.mint(addr1.address, 2);
            const tokenId = 0;
            const material = await materialsNFT.getMaterial(tokenId);
            const rarity = await materialsNFT.getRarity(tokenId);
            const tokenURI = await materialsNFT.tokenURI(tokenId);
            
            expect(material).to.be.greaterThanOrEqual(10);
            expect(material).to.be.lessThanOrEqual(14);
            expect(rarity).to.equal(2);
            expect(tokenURI).to.include("materials/epic/");
        });

        it("Dovrebbe mintare materiali leggendari (15-19) con URI corretto", async function () {
            await materialsNFT.mint(addr1.address, 3);
            const tokenId = 0;
            const material = await materialsNFT.getMaterial(tokenId);
            const rarity = await materialsNFT.getRarity(tokenId);
            const tokenURI = await materialsNFT.tokenURI(tokenId);
            
            expect(material).to.be.greaterThanOrEqual(15);
            expect(material).to.be.lessThanOrEqual(19);
            expect(rarity).to.equal(3);
            expect(tokenURI).to.include("materials/legendary/");
        });

        it("Dovrebbe emettere l'evento MaterialMinted", async function () {
            const tx = await materialsNFT.mint(addr1.address, 0);
            const receipt = await tx.wait();
            const event = receipt.logs[1]; // Il secondo evento è MaterialMinted (il primo è Transfer)
            
            expect(event.fragment.name).to.equal("MaterialMinted");
            const { tokenId, to, material, rarity } = event.args;
            expect(tokenId).to.equal(0);
            expect(to).to.equal(addr1.address);
            expect(material).to.be.lessThanOrEqual(4);
            expect(rarity).to.equal(0);
        });

        it("Dovrebbe incrementare correttamente il tokenId", async function () {
            await materialsNFT.mint(addr1.address, 0);
            await materialsNFT.mint(addr1.address, 1);
            await materialsNFT.mint(addr1.address, 2);
            
            expect(await materialsNFT.ownerOf(0)).to.equal(addr1.address);
            expect(await materialsNFT.ownerOf(1)).to.equal(addr1.address);
            expect(await materialsNFT.ownerOf(2)).to.equal(addr1.address);
        });
    });

    describe("View Functions", function () {
        beforeEach(async function () {
            await materialsNFT.mint(addr1.address, 0);
        });

        it("Dovrebbe ritornare il materiale corretto", async function () {
            const material = await materialsNFT.getMaterial(0);
            expect(material).to.be.lessThanOrEqual(4);
        });

        it("Dovrebbe ritornare la rarità corretta", async function () {
            const rarity = await materialsNFT.getRarity(0);
            expect(rarity).to.equal(0);
        });

        it("Dovrebbe fallire per token non esistenti", async function () {
            await expect(
                materialsNFT.getMaterial(99)
            ).to.be.revertedWithCustomError(materialsNFT, "TokenNotExists");

            await expect(
                materialsNFT.getRarity(99)
            ).to.be.revertedWithCustomError(materialsNFT, "TokenNotExists");

            await expect(
                materialsNFT.tokenURI(99)
            ).to.be.revertedWithCustomError(materialsNFT, "TokenNotExists");
        });

        it("Dovrebbe ritornare l'URI corretto per ogni materiale", async function () {
            // Minta un materiale per ogni rarità
            await materialsNFT.mint(addr1.address, 0); // Comune
            await materialsNFT.mint(addr1.address, 1); // Raro
            await materialsNFT.mint(addr1.address, 2); // Epico
            await materialsNFT.mint(addr1.address, 3); // Leggendario

            for(let i = 0; i < 4; i++) {
                const material = await materialsNFT.getMaterial(i);
                const rarity = await materialsNFT.getRarity(i);
                const uri = await materialsNFT.tokenURI(i);

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

                // Verifica che l'URI inizi con il BASE_URI
                expect(uri.startsWith(BASE_URI)).to.be.true;
            }
        });
    });

    describe("Admin Functions", function () {
        it("Solo l'owner può aggiornare il baseURI", async function () {
            const newBaseURI = "https://new.api.example.com";
            
            await expect(
                materialsNFT.connect(addr1).setBaseURI(newBaseURI)
            ).to.be.revertedWithCustomError(materialsNFT, "OwnableUnauthorizedAccount");

            await materialsNFT.setBaseURI(newBaseURI);
            await materialsNFT.mint(addr1.address, 0);
            const tokenURI = await materialsNFT.tokenURI(0);
            expect(tokenURI.startsWith(newBaseURI)).to.be.true;
        });

        it("Il cambio di baseURI dovrebbe aggiornare tutti gli URI esistenti", async function () {
            // Minta alcuni token
            await materialsNFT.mint(addr1.address, 0);
            await materialsNFT.mint(addr1.address, 1);
            
            // Salva gli URI originali
            const originalURI1 = await materialsNFT.tokenURI(0);
            const originalURI2 = await materialsNFT.tokenURI(1);
            
            // Cambia il baseURI
            const newBaseURI = "https://new.api.example.com";
            await materialsNFT.setBaseURI(newBaseURI);
            
            // Verifica che gli URI siano stati aggiornati
            const newURI1 = await materialsNFT.tokenURI(0);
            const newURI2 = await materialsNFT.tokenURI(1);
            
            expect(newURI1).to.not.equal(originalURI1);
            expect(newURI2).to.not.equal(originalURI2);
            expect(newURI1.startsWith(newBaseURI)).to.be.true;
            expect(newURI2.startsWith(newBaseURI)).to.be.true;
        });
    });

    describe("Token Transfers", function () {
        beforeEach(async function () {
            await materialsNFT.mint(addr1.address, 0);
        });

        it("Dovrebbe permettere il trasferimento di token", async function () {
            await materialsNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 0);
            expect(await materialsNFT.ownerOf(0)).to.equal(addr2.address);
        });

        it("Non dovrebbe permettere il trasferimento da indirizzi non autorizzati", async function () {
            await expect(
                materialsNFT.connect(addr2).transferFrom(addr1.address, addr2.address, 0)
            ).to.be.revertedWithCustomError(materialsNFT, "ERC721InsufficientApproval");
        });

        it("L'URI del token dovrebbe rimanere invariato dopo il trasferimento", async function () {
            const uriBefore = await materialsNFT.tokenURI(0);
            await materialsNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 0);
            const uriAfter = await materialsNFT.tokenURI(0);
            expect(uriBefore).to.equal(uriAfter);
        });
    });

    describe("Randomness", function () {
        it("Dovrebbe generare materiali diversi per mint consecutivi della stessa rarità", async function () {
            const numMints = 5;
            const materials = new Set();

            for (let i = 0; i < numMints; i++) {
                await materialsNFT.mint(addr1.address, 0);
                const material = await materialsNFT.getMaterial(i);
                materials.add(material.toString());
            }

            // Ci aspettiamo che almeno alcuni materiali siano diversi
            expect(materials.size).to.be.greaterThan(1);
        });
    });
}); 