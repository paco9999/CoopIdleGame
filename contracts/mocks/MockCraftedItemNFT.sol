// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockCraftedItemNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _tokenIdCounter;
    mapping(uint256 => string) private _tokenURIs;

    event CraftedItemMinted(address indexed to, uint256 indexed tokenId, string uri);

    constructor() ERC721("MockCraftedItem", "MCI") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, string memory uri) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        emit CraftedItemMinted(to, tokenId, uri);
        return tokenId;
    }

    function mintCraftedItem(
        address to,
        uint256 recipeId,
        string memory uri
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        emit CraftedItemMinted(to, tokenId, uri);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        try this.ownerOf(tokenId) returns (address) {
            return _tokenURIs[tokenId];
        } catch {
            revert("ERC721: URI query for nonexistent token");
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 