// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdleProcioneNFT
/// @notice Interfaccia per il contratto NFT dei Procioni
interface IIdleProcioneNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function updateProcioneData(uint256 tokenId, uint256 newData) external;
    function getProcioneData(uint256 tokenId) external view returns (uint256);
} 