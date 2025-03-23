// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./libraries/StatsLib.sol";
import "./libraries/GameConstants.sol";
import "./interfaces/IIdleProcioneNFT.sol";

/// @title IdleProcioneEgg
/// @notice Contratto per la gestione delle uova dei Procioni
/// @dev Implementa ERC721 con sistema di incubazione
contract IdleProcioneEgg is ERC721Pausable, Ownable, ReentrancyGuard {
    // ========== State Variables ==========
    // Contratti esterni
    IIdleProcioneNFT public immutable nftContract;
    address public immutable breedingContract;

    // Contatore per gli ID delle uova
    uint256 private _eggIdCounter;

    // Mapping per i dati delle uova
    mapping(uint256 => EggData) private _eggData;

    // ========== Structs ==========
    /// @notice Struttura per i dati di un'uovo
    struct EggData {
        uint256 parentId1;
        uint256 parentId2;
        uint256 genetics;
        uint256 hatchTime;
        bool hatched;
    }

    // ========== Custom Errors ==========
    error UnauthorizedBreeder();
    error EggAlreadyHatched();
    error EggNotReadyToHatch();
    error InvalidAddress();
    error TokenNotExists();

    // ========== Events ==========
    event EggCreated(
        uint256 indexed eggId,
        address indexed owner,
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 hatchTime
    );
    event EggHatched(
        uint256 indexed eggId,
        uint256 indexed newProcioneId,
        address indexed owner
    );

    // ========== Constructor ==========
    /// @notice Costruttore del contratto
    /// @param _name Nome del token
    /// @param _symbol Simbolo del token
    /// @param _nftContract Indirizzo del contratto NFT
    /// @param _breedingContract Indirizzo del contratto di breeding
    constructor(
        string memory _name,
        string memory _symbol,
        address _nftContract,
        address _breedingContract
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        if (_nftContract == address(0) || _breedingContract == address(0)) revert InvalidAddress();
        nftContract = IIdleProcioneNFT(_nftContract);
        breedingContract = _breedingContract;
    }

    // ========== Public Functions ==========
    /// @notice Crea un nuovo uovo
    /// @param to Indirizzo del destinatario
    /// @param parentId1 ID del primo genitore
    /// @param parentId2 ID del secondo genitore
    /// @param genetics Genetica dell'uovo
    /// @param hatchTime Timestamp di schiusa
    /// @return eggId ID dell'uovo creato
    function mint(
        address to,
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 hatchTime
    ) external returns (uint256) {
        if (msg.sender != breedingContract) revert UnauthorizedBreeder();

        uint256 eggId = _eggIdCounter;
        _eggIdCounter++;

        _eggData[eggId] = EggData({
            parentId1: parentId1,
            parentId2: parentId2,
            genetics: genetics,
            hatchTime: hatchTime,
            hatched: false
        });

        _safeMint(to, eggId);

        emit EggCreated(eggId, to, parentId1, parentId2, genetics, hatchTime);

        return eggId;
    }

    /// @notice Schiude un uovo in un nuovo procione
    /// @param eggId ID dell'uovo da schiudere
    function hatch(uint256 eggId) external nonReentrant {
        if (!_exists(eggId)) revert TokenNotExists();
        if (ownerOf(eggId) != msg.sender) revert UnauthorizedBreeder();
        
        EggData storage egg = _eggData[eggId];
        if (egg.hatched) revert EggAlreadyHatched();
        if (block.timestamp < egg.hatchTime) revert EggNotReadyToHatch();

        // Marca l'uovo come schiuso
        egg.hatched = true;

        // Ottieni i dati dei genitori
        uint256 parent1Data = nftContract.getProcioneData(egg.parentId1);
        uint256 parent2Data = nftContract.getProcioneData(egg.parentId2);

        // Estrai classe e fazione da entrambi i genitori
        uint256 parent1Class = StatsLib.extractField(parent1Data, GameConstants.CLASS_MASK, GameConstants.CLASS_POSITION);
        uint256 parent2Class = StatsLib.extractField(parent2Data, GameConstants.CLASS_MASK, GameConstants.CLASS_POSITION);
        uint256 parent1Faction = StatsLib.extractField(parent1Data, GameConstants.FACTION_MASK, GameConstants.FACTION_POSITION);
        uint256 parent2Faction = StatsLib.extractField(parent2Data, GameConstants.FACTION_MASK, GameConstants.FACTION_POSITION);

        // 50% di probabilità per classe e fazione
        uint256 class = block.timestamp % 2 == 0 ? parent1Class : parent2Class;
        uint256 faction = block.timestamp % 2 == 0 ? parent1Faction : parent2Faction;

        // Crea il nuovo procione usando la funzione dedicata
        uint256 newProcioneId = nftContract.mintFromEgg(msg.sender, egg.genetics, class, faction);

        emit EggHatched(eggId, newProcioneId, msg.sender);
    }

    // ========== View Functions ==========
    /// @notice Restituisce i dati di un uovo
    /// @param eggId ID dell'uovo
    /// @return parentId1 ID del primo genitore
    /// @return parentId2 ID del secondo genitore
    /// @return genetics Genetica dell'uovo
    /// @return hatchTime Tempo di schiusa
    /// @return hatched Stato di schiusa
    function getEggData(uint256 eggId) external view returns (
        uint256 parentId1,
        uint256 parentId2,
        uint256 genetics,
        uint256 hatchTime,
        bool hatched
    ) {
        if (!_exists(eggId)) revert TokenNotExists();
        EggData memory egg = _eggData[eggId];
        return (
            egg.parentId1,
            egg.parentId2,
            egg.genetics,
            egg.hatchTime,
            egg.hatched
        );
    }

    /// @notice Verifica se un uovo è pronto per la schiusa
    /// @param eggId ID dell'uovo
    /// @return bool Indica se l'uovo può essere schiuso
    function canHatch(uint256 eggId) external view returns (bool) {
        if (!_exists(eggId)) revert TokenNotExists();
        EggData memory egg = _eggData[eggId];
        return !egg.hatched && block.timestamp >= egg.hatchTime;
    }

    // ========== Admin Functions ==========
    /// @notice Mette in pausa il contratto
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Riprende il contratto dalla pausa
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Verifica se un token esiste
    /// @param tokenId ID del token da verificare
    /// @return bool True se il token esiste
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
} 