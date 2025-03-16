// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IMaterialsNFT.sol";

contract MockMaterialsNFT is ERC721, AccessControl, IMaterialsNFT {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Mapping per tenere traccia dei tipi di materiali per ogni token
    mapping(uint256 => uint256) private _materialTypes;
    // Counter per i token ID
    uint256 private _nextTokenId;

    constructor() ERC721("MockMaterials", "MMAT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _nextTokenId = 0;
    }

    function mint(address to, uint256 materialType) external override {
        uint256 tokenId = _nextTokenId++;
        _materialTypes[tokenId] = materialType;
        _safeMint(to, tokenId);
    }

    function burn(address from, uint256 id, uint256) external {
        require(
            from == ownerOf(id) && 
            (msg.sender == from || isApprovedForAll(from, msg.sender) || msg.sender == getApproved(id)),
            "Not approved"
        );
        _burn(id);
        delete _materialTypes[id];
    }

    // Funzione richiesta dall'interfaccia IMaterialsNFT
    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        return balanceOfType(account, id);
    }

    // Funzione di supporto per il conteggio dei token per tipo
    function balanceOfType(address account, uint256 materialType) public view returns (uint256) {
        uint256 balance = 0;
        for (uint256 i = 0; i < _nextTokenId; i++) {
            // Verifichiamo se il token esiste controllando se lancia un errore su ownerOf
            if (_ownerOf(i) == account && _materialTypes[i] == materialType) {
                balance++;
            }
        }
        return balance;
    }

    function burnBatch(
        address from,
        uint256[] memory materialTypes,
        uint256[] memory amounts
    ) external override {
        require(materialTypes.length == amounts.length, "Length mismatch");
        
        for (uint256 i = 0; i < materialTypes.length; i++) {
            uint256 toBurn = amounts[i];
            uint256 burned = 0;
            
            for (uint256 j = 0; j < _nextTokenId && burned < toBurn; j++) {
                address owner = _ownerOf(j);
                if (owner == from && 
                    _materialTypes[j] == materialTypes[i] &&
                    (msg.sender == from || 
                     isApprovedForAll(from, msg.sender) || 
                     msg.sender == getApproved(j))
                ) {
                    _burn(j);
                    delete _materialTypes[j];
                    burned++;
                }
            }
            
            require(burned == toBurn, "Not enough tokens to burn");
        }
    }

    // Implementazione delle funzioni richieste dall'interfaccia IMaterialsNFT
    function getMaterial(uint256 id) external view override returns (uint256) {
        require(_ownerOf(id) != address(0), "Token does not exist");
        return _materialTypes[id];
    }

    function getRarity(uint256 id) external pure override returns (uint256) {
        require(id < 20, "Invalid token ID"); // Per semplicità, supportiamo solo 20 tipi
        return id / 5; // 0-4: common, 5-9: rare, 10-14: epic, 15-19: legendary
    }

    function setBaseURI(string memory) external pure override {
        revert("Not implemented");
    }

    // Override delle funzioni ereditate sia da ERC721 che da IMaterialsNFT
    function name() public view virtual override(ERC721, IMaterialsNFT) returns (string memory) {
        return super.name();
    }

    function symbol() public view virtual override(ERC721, IMaterialsNFT) returns (string memory) {
        return super.symbol();
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721, IMaterialsNFT) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function setApprovalForAll(address operator, bool approved) public virtual override(ERC721, IMaterialsNFT) {
        super.setApprovalForAll(operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override(ERC721, IMaterialsNFT) returns (bool) {
        return super.isApprovedForAll(owner, operator);
    }

    // Override della funzione balanceOf di ERC721
    function balanceOf(address owner) public view virtual override(ERC721) returns (uint256) {
        return super.balanceOf(owner);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 