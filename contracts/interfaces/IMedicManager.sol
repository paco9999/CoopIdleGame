// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IMedicManager
/// @notice Interfaccia per il contratto MedicManager
interface IMedicManager {
    // ========== Events ==========
    event HealingFeeUpdated(uint256 oldFee, uint256 newFee);
    event MedicFeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event NFTHealed(uint256 indexed tokenId, uint256 indexed medicId, uint256 healAmount);
    event BatchHealing(uint256[] tokenIds, uint256[] medicIds, uint256 totalFee);
    event ContractUpdated(string indexed contractType, address indexed oldContract, address indexed newContract);

    // ========== Custom Errors ==========
    error InvalidAddress();
    error InvalidPercentage();
    error NoAvailableMedic();
    error InsufficientCOMAllowance();
    error InsufficientCOMBalance();
    error NFTAlreadyAtFullHealth();
    error InvalidHealingFee();
    error InsufficientMedics();
    error EmptyBatch();

    // ========== View Functions ==========

    /// @notice Ottiene l'indirizzo del contratto COM
    function comToken() external view returns (address);

    /// @notice Ottiene l'indirizzo del contratto NFT
    function nftContract() external view returns (address);

    /// @notice Ottiene l'indirizzo del contratto ProfessionsManager
    function professionsManager() external view returns (address);

    /// @notice Ottiene l'indirizzo della tesoreria
    function treasury() external view returns (address);

    /// @notice Ottiene la fee di cura corrente
    function healingFee() external view returns (uint256);

    /// @notice Ottiene la percentuale della fee che va al medico
    function medicFeePercentage() external view returns (uint256);

    /// @notice Trova un medico disponibile per curare
    /// @return tokenId ID del primo medico disponibile, 0 se nessuno è disponibile
    function getAvailableMedic() external view returns (uint256);

    // ========== External Functions ==========

    /// @notice Cura un NFT usando un medico disponibile
    /// @param tokenId ID dell'NFT da curare
    function heal(uint256 tokenId) external;

    /// @notice Cura multipli NFT usando medici disponibili
    /// @param tokenIds Array degli ID degli NFT da curare
    function healBatch(uint256[] calldata tokenIds) external;

    /// @notice Imposta la fee di cura
    /// @param _newFee Nuova fee in token COM
    function setHealingFee(uint256 _newFee) external;

    /// @notice Imposta la percentuale della fee che va al medico
    /// @param _newPercentage Nuova percentuale (0-100)
    function setMedicFeePercentage(uint256 _newPercentage) external;

    /// @notice Aggiorna l'indirizzo della tesoreria
    function setTreasury(address _newTreasury) external;

    /// @notice Aggiorna l'indirizzo del contratto COM
    function setComToken(address _newComToken) external;

    /// @notice Aggiorna l'indirizzo del contratto NFT
    function setNFTContract(address _newNFTContract) external;

    /// @notice Aggiorna l'indirizzo del contratto ProfessionsManager
    function setProfessionsManager(address _newProfessionsManager) external;

    /// @notice Verifica se il contratto è in pausa
    function paused() external view returns (bool);

    /// @notice Mette in pausa il contratto
    function pause() external;

    /// @notice Riprende il contratto
    function unpause() external;
} 