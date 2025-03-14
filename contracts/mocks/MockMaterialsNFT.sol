// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockMaterialsNFT is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 materialType) external returns (uint256) {
        _mint(to, materialType, 1, "");
        return materialType;
    }

    function mintBatch(
        address to,
        uint256[] memory materialTypes,
        uint256[] memory amounts
    ) external {
        _mintBatch(to, materialTypes, amounts, "");
    }

    function burn(address from, uint256 id, uint256 amount) external {
        require(msg.sender == from || isApprovedForAll(from, msg.sender), "Not approved");
        _burn(from, id, amount);
    }

    function burnBatch(
        address from,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external {
        require(msg.sender == from || isApprovedForAll(from, msg.sender), "Not approved");
        _burnBatch(from, ids, amounts);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 