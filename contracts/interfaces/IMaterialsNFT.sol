// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMaterialsNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function burnBatch(address from, uint256[] memory ids, uint256[] memory amounts) external;
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
} 