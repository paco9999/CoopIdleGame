// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./libraries/MaterialsLib.sol";

/// @title MaterialsNFT
/// @notice Contratto per la gestione dei materiali di base come NFT
/// @dev Implementa un sistema di minting di materiali con rarità diverse
contract MaterialsNFT is 
    Initializable, 
    ERC721Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ========== State Variables ==========

    // Token counter
    uint256 private _nextTokenId;

    // Mapping per gli attributi dei token
    mapping(uint256 => MaterialsLib.Material) private _materials;
    mapping(uint256 => MaterialsLib.Rarity) private _rarities;

    // Base URI per i metadata
    string private _customBaseURI;

    // Nonce per la generazione pseudo-random
    uint256 private nonce;

    // ========== Events ==========

    event MaterialMinted(
        uint256 indexed tokenId,
        address indexed to,
        MaterialsLib.Material material,
        MaterialsLib.Rarity rarity
    );

    // ========== Custom Errors ==========

    error InvalidRarity();
    error InvalidAddress();
    error TokenNotExists();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ========== Initializer ==========

    function initialize(string memory baseURI) public initializer {
        __ERC721_init("Materials NFT", "MAT");
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        _customBaseURI = baseURI;
        nonce = 0;
        _nextTokenId = 0;
    }

    // ========== External Functions ==========

    /// @notice Minta un nuovo materiale
    /// @param to Indirizzo del destinatario
    /// @param rarity Rarità del materiale da generare
    function mint(address to, uint256 rarity) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (rarity > uint256(MaterialsLib.Rarity.LEGENDARY)) revert InvalidRarity();

        MaterialsLib.RarityRange memory range = MaterialsLib.getRarityRange(MaterialsLib.Rarity(rarity));
        uint256 materialId = _getRandomNumber(range.start, range.end);
        
        uint256 tokenId = _nextTokenId++;
        MaterialsLib.Material material = MaterialsLib.Material(materialId);

        _safeMint(to, tokenId);
        _materials[tokenId] = material;
        _rarities[tokenId] = MaterialsLib.Rarity(rarity);

        emit MaterialMinted(tokenId, to, material, MaterialsLib.Rarity(rarity));
    }

    // ========== View Functions ==========

    /// @notice Ottiene il materiale associato a un token
    function getMaterial(uint256 tokenId) external view returns (MaterialsLib.Material) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        return _materials[tokenId];
    }

    /// @notice Ottiene la rarità associata a un token
    function getRarity(uint256 tokenId) external view returns (MaterialsLib.Rarity) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        return _rarities[tokenId];
    }

    // ========== Admin Functions ==========

    /// @notice Aggiorna il base URI
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _customBaseURI = newBaseURI;
    }

    // ========== Internal Functions ==========

    /// @dev Converte un uint256 in string
    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /// @dev Genera un numero pseudo-random tra min e max (inclusi)
    function _getRandomNumber(uint256 min, uint256 max) internal returns (uint256) {
        nonce++;
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    msg.sender,
                    nonce
                )
            )
        );
        return min + (randomNumber % (max - min + 1));
    }

    function _baseURI() internal view override returns (string memory) {
        return _customBaseURI;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ========== Overrides ==========

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        
        MaterialsLib.Material material = _materials[tokenId];
        string memory materialURI = MaterialsLib.getMaterialURI(material);
        
        return string(abi.encodePacked(_customBaseURI, "/", materialURI));
    }
} 