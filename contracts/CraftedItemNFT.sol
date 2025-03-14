// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title CraftedItemNFT
/// @notice Contratto per la gestione degli oggetti craftati come NFT
/// @dev Implementa un sistema di minting di oggetti craftati con URI personalizzati
contract CraftedItemNFT is 
    Initializable,
    ERC721Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // ========== Constants ==========
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ========== Structs ==========
    struct CraftedItemAttributes {
        uint256 recipeId;
        uint256 craftedAt;
        address crafter;
        string name;
        string description;
        string[] traits;
    }

    // ========== State Variables ==========
    uint256 private _tokenIdCounter;
    string private _customBaseURI;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) private _recipeIds;
    mapping(uint256 => CraftedItemAttributes) private _attributes;

    // ========== Events ==========
    event CraftedItemMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed recipeId,
        string uri
    );

    event CraftedItemBurned(
        address indexed owner,
        uint256 indexed tokenId
    );

    event CraftedItemAttributesUpdated(
        uint256 indexed tokenId
    );

    event BaseURIUpdated(
        string newBaseURI
    );

    // ========== Custom Errors ==========
    error InvalidAddress();
    error TokenNotExists();
    error InvalidURI();
    error UnauthorizedCaller();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ========== Initializer ==========
    function initialize(
        string memory name,
        string memory symbol,
        string memory baseURI
    ) public initializer {
        __ERC721_init(name, symbol);
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _customBaseURI = baseURI;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        _tokenIdCounter = 0;
    }

    // ========== External Functions ==========

    /// @notice Minta un nuovo oggetto craftato
    /// @param to Indirizzo del destinatario
    /// @param recipeId ID della ricetta usata
    /// @param uri URI dell'oggetto craftato
    /// @return tokenId ID del nuovo NFT
    function mintCraftedItem(
        address to,
        uint256 recipeId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        if (to == address(0)) revert InvalidAddress();
        if (bytes(uri).length == 0) revert InvalidURI();

        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        _recipeIds[tokenId] = recipeId;

        emit CraftedItemMinted(to, tokenId, recipeId, uri);
        return tokenId;
    }

    /// @notice Brucia un oggetto craftato
    /// @param tokenId ID del token da bruciare
    function burnCraftedItem(uint256 tokenId) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        
        address owner = ownerOf(tokenId);
        _burn(tokenId);
        delete _tokenURIs[tokenId];
        delete _recipeIds[tokenId];
        delete _attributes[tokenId];

        emit CraftedItemBurned(owner, tokenId);
    }

    /// @notice Imposta gli attributi di un oggetto craftato
    /// @param tokenId ID del token
    /// @param attributes Attributi da impostare
    function setCraftedItemAttributes(
        uint256 tokenId,
        CraftedItemAttributes memory attributes
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        
        _attributes[tokenId] = attributes;
        emit CraftedItemAttributesUpdated(tokenId);
    }

    /// @notice Imposta il nuovo base URI
    /// @param newBaseURI Nuovo base URI
    function setBaseURI(string memory newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _customBaseURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /// @notice Mette in pausa il contratto
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Riprende il contratto dalla pausa
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ========== View Functions ==========

    /// @notice Ottiene l'URI di un token
    /// @param tokenId ID del token
    /// @return URI del token
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        return _tokenURIs[tokenId];
    }

    /// @notice Ottiene l'ID della ricetta usata per craftare un token
    /// @param tokenId ID del token
    /// @return ID della ricetta
    function getRecipeId(uint256 tokenId) external view returns (uint256) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        return _recipeIds[tokenId];
    }

    /// @notice Ottiene gli attributi di un oggetto craftato
    /// @param tokenId ID del token
    /// @return Attributi dell'oggetto craftato
    function getCraftedItemAttributes(uint256 tokenId) external view returns (CraftedItemAttributes memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists();
        return _attributes[tokenId];
    }

    // ========== Internal Functions ==========

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function _baseURI() internal view override returns (string memory) {
        return _customBaseURI;
    }

    // ========== Override Functions ==========

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 