// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library WhitelistLib {
    struct WhitelistData {
        mapping(address => bool) whitelistPhase1;
        mapping(address => bool) whitelistPhase2;
        mapping(address => uint256) mintedPerWallet;
        bool isPhase1Active;
        bool isPhase2Active;
        uint256 price;
    }

    event PriceUpdated(uint256 newPrice);
    event PhaseStatusUpdated(uint256 phase, bool isActive);

    function setWhitelistPhase1(
        WhitelistData storage self,
        address[] calldata addresses,
        bool status
    ) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            self.whitelistPhase1[addresses[i]] = status;
        }
    }

    function setWhitelistPhase2(
        WhitelistData storage self,
        address[] calldata addresses,
        bool status
    ) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            self.whitelistPhase2[addresses[i]] = status;
        }
    }

    function setPhaseStatus(
        WhitelistData storage self,
        uint256 phase,
        bool status
    ) internal returns (bool) {
        if (phase == 1) {
            self.isPhase1Active = status;
            if (status) self.isPhase2Active = false;
        } else if (phase == 2) {
            self.isPhase2Active = status;
            if (status) self.isPhase1Active = false;
        }
        emit PhaseStatusUpdated(phase, status);
        return true;
    }

    function setPrice(WhitelistData storage self, uint256 _price) internal returns (bool) {
        self.price = _price;
        emit PriceUpdated(_price);
        return true;
    }

    function setWhitelistBatch(
        WhitelistData storage self,
        address[] calldata addresses,
        bool[] calldata phase1Status,
        bool[] calldata phase2Status
    ) internal {
        require(addresses.length <= 1000, "Batch troppo grande");
        require(
            addresses.length == phase1Status.length && 
            addresses.length == phase2Status.length,
            "Lunghezze array non corrispondenti"
        );
        for (uint256 i = 0; i < addresses.length; i++) {
            self.whitelistPhase1[addresses[i]] = phase1Status[i];
            self.whitelistPhase2[addresses[i]] = phase2Status[i];
        }
    }

    function checkMintConditions(
        WhitelistData storage self,
        address sender,
        uint256 value,
        uint256 mintPerWallet
    ) internal view returns (bool) {
        require(self.mintedPerWallet[sender] < mintPerWallet, "Limite per wallet raggiunto");

        if (self.isPhase1Active) {
            require(self.whitelistPhase1[sender], "Non sei nella whitelist fase 1");
            require(value == 0, "Il mint in fase 1 e' gratuito");
        } else if (self.isPhase2Active) {
            require(self.whitelistPhase2[sender], "Non sei nella whitelist fase 2");
            require(value >= self.price, "AVAX insufficienti");
        } else {
            revert("Nessuna fase attiva");
        }

        return true;
    }

    function getMintInfo(
        WhitelistData storage self,
        address wallet,
        uint256 mintPerWallet
    ) internal view returns (
        bool isWhitelistedPhase1,
        bool isWhitelistedPhase2,
        uint256 mintedAmount,
        uint256 remainingMints
    ) {
        return (
            self.whitelistPhase1[wallet],
            self.whitelistPhase2[wallet],
            self.mintedPerWallet[wallet],
            mintPerWallet - self.mintedPerWallet[wallet]
        );
    }
} 