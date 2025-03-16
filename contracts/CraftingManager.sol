// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./interfaces/ICOM.sol";
import "./interfaces/ICraftedItemNFT.sol";
import "./interfaces/IMaterialsNFT.sol";
import "./interfaces/IProfessionsManager.sol";

/// @title CraftingManager
/// @author Il tuo nome
/// @notice Contratto per la gestione del sistema di crafting
/// @dev Implementa un sistema modulare per la gestione delle ricette e del processo di crafting
contract CraftingManager is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // ========== Structs ==========
    
    struct Recipe {
        uint256 id;
        uint256[] materialIds;
        uint256[] materialAmounts;
        uint256 feeCOM;
        string outputURI;
        uint256 craftingTime;
        uint256 requiredArtisanLevel;
        bool active;
    }

    struct CraftingJob {
        uint256 recipeId;
        address artisan;
        uint256 endTime;
        bool completed;
    }

    // ========== State Variables ==========
    
    // Core Contract References
    ICOM public comToken;
    ICraftedItemNFT public craftedItemNFT;
    IMaterialsNFT public materialsNFT;
    IProfessionsManager public professionsManager;
    address public treasury;
    
    // Recipe Management
    uint256 public recipeCount;
    mapping(uint256 => Recipe) public recipes;
    
    // Crafting Management
    mapping(address => CraftingJob[]) public userCraftingJobs;
    
    // Constants
    uint256 private constant ARTISAN_FEE_PERCENTAGE = 50;
    uint256 private constant PERCENTAGE_BASE = 100;

    // ========== Events ==========
    
    event RecipeAdded(uint256 indexed recipeId, string outputURI);
    event RecipeUpdated(uint256 indexed recipeId);
    event RecipeDeactivated(uint256 indexed recipeId);
    event CraftingStarted(
        address indexed user, 
        uint256 indexed recipeId, 
        address indexed artisan, 
        uint256 endTime
    );
    event CraftingCompleted(
        address indexed user, 
        uint256 indexed recipeId, 
        address indexed artisan,
        uint256 tokenId
    );

    // ========== Custom Errors ==========
    
    error InvalidAddress();
    error InvalidRecipe();
    error RecipeNotFound();
    error RecipeNotActive();
    error InvalidMaterialArrays();
    error InsufficientCOMAllowance();
    error InsufficientCOMBalance();
    error InsufficientMaterials();
    error NoAvailableArtisan();
    error CraftingNotCompleted();
    error CraftingAlreadyCompleted();
    error InvalidCraftingJobIndex();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ========== Initializer ==========

    function initialize(
        address _comToken,
        address _craftedItemNFT,
        address _professionsManager,
        address _treasury
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_comToken == address(0) || 
            _craftedItemNFT == address(0) || 
            _professionsManager == address(0) ||
            _treasury == address(0)) revert InvalidAddress();

        comToken = ICOM(_comToken);
        craftedItemNFT = ICraftedItemNFT(_craftedItemNFT);
        professionsManager = IProfessionsManager(_professionsManager);
        treasury = _treasury;
    }

    function setMaterialsNFT(address _materialsNFT) external onlyOwner {
        if (_materialsNFT == address(0)) revert InvalidAddress();
        materialsNFT = IMaterialsNFT(_materialsNFT);
    }

    // ========== External Functions ==========

    /// @notice Aggiunge una nuova ricetta al sistema
    /// @param materialIds Array degli ID dei materiali richiesti
    /// @param materialAmounts Array delle quantità richieste per ciascun materiale
    /// @param feeCOM Fee in token COM richiesta per il crafting
    /// @param outputURI URI base dell'oggetto craftato
    /// @param craftingTime Tempo necessario per completare il crafting
    /// @param requiredArtisanLevel Livello minimo richiesto all'artigiano
    function addRecipe(
        uint256[] calldata materialIds,
        uint256[] calldata materialAmounts,
        uint256 feeCOM,
        string calldata outputURI,
        uint256 craftingTime,
        uint256 requiredArtisanLevel
    ) external onlyOwner {
        if (materialIds.length != materialAmounts.length) revert InvalidMaterialArrays();
        if (bytes(outputURI).length == 0) revert InvalidRecipe();
        if (craftingTime == 0) revert InvalidRecipe();

        uint256 newRecipeId = ++recipeCount;
        
        recipes[newRecipeId] = Recipe({
            id: newRecipeId,
            materialIds: materialIds,
            materialAmounts: materialAmounts,
            feeCOM: feeCOM,
            outputURI: outputURI,
            craftingTime: craftingTime,
            requiredArtisanLevel: requiredArtisanLevel,
            active: true
        });

        emit RecipeAdded(newRecipeId, outputURI);
    }

    /// @notice Avvia il processo di crafting per una ricetta
    /// @param recipeId ID della ricetta da craftare
    function craft(uint256 recipeId) external whenNotPaused nonReentrant {
        Recipe storage recipe = recipes[recipeId];
        if (!recipe.active) revert RecipeNotActive();
        
        // Verifica COM
        if (recipe.feeCOM > 0) {
            if (comToken.allowance(msg.sender, address(this)) < recipe.feeCOM) {
                revert InsufficientCOMAllowance();
            }
            if (comToken.balanceOf(msg.sender) < recipe.feeCOM) {
                revert InsufficientCOMBalance();
            }
        }

        // Verifica materiali
        if (recipe.materialIds.length > 0) {
            if (!_hasMaterials(msg.sender, recipe.materialIds, recipe.materialAmounts)) {
                revert InsufficientMaterials();
            }
        }

        // Trova un artigiano disponibile
        (address artisan, uint256 artisanId) = _getAvailableArtisan(recipe.requiredArtisanLevel);
        if (artisan == address(0)) revert NoAvailableArtisan();

        // Blocca uno slot dell'artigiano
        professionsManager.lockCraftingSlot(artisanId, recipe.craftingTime);

        // Gestisci il pagamento in COM
        if (recipe.feeCOM > 0) {
            uint256 artisanFee = (recipe.feeCOM * ARTISAN_FEE_PERCENTAGE) / PERCENTAGE_BASE;
            uint256 treasuryFee = recipe.feeCOM - artisanFee;

            comToken.transferFrom(msg.sender, artisan, artisanFee);
            comToken.transferFrom(msg.sender, treasury, treasuryFee);
        }

        // Consuma i materiali
        if (recipe.materialIds.length > 0) {
            _consumeMaterials(msg.sender, recipe.materialIds, recipe.materialAmounts);
        }

        // Crea il job di crafting
        CraftingJob memory newJob = CraftingJob({
            recipeId: recipeId,
            artisan: artisan,
            endTime: block.timestamp + recipe.craftingTime,
            completed: false
        });

        userCraftingJobs[msg.sender].push(newJob);

        emit CraftingStarted(
            msg.sender,
            recipeId,
            artisan,
            newJob.endTime
        );
    }

    /// @notice Completa un processo di crafting
    /// @param jobIndex Indice del job di crafting da completare
    function completeCrafting(uint256 jobIndex) external nonReentrant {
        CraftingJob[] storage jobs = userCraftingJobs[msg.sender];
        if (jobIndex >= jobs.length) revert InvalidCraftingJobIndex();

        CraftingJob storage job = jobs[jobIndex];
        if (job.completed) revert CraftingAlreadyCompleted();
        if (block.timestamp < job.endTime) revert CraftingNotCompleted();

        Recipe storage recipe = recipes[job.recipeId];
        
        // Minta l'NFT
        uint256 tokenId = craftedItemNFT.mintCraftedItem(
            msg.sender,
            job.recipeId,
            recipe.outputURI
        );

        job.completed = true;

        emit CraftingCompleted(
            msg.sender,
            job.recipeId,
            job.artisan,
            tokenId
        );
    }

    /// @notice Aggiorna i parametri di una ricetta
    /// @param recipeId ID della ricetta da aggiornare
    /// @param feeCOM Nuova fee in token COM
    /// @param craftingTime Nuovo tempo di crafting
    /// @param requiredArtisanLevel Nuovo livello minimo richiesto all'artigiano
    function updateRecipeParameters(
        uint256 recipeId,
        uint256 feeCOM,
        uint256 craftingTime,
        uint256 requiredArtisanLevel
    ) external onlyOwner {
        if (recipeId == 0 || recipeId > recipeCount) revert RecipeNotFound();
        if (craftingTime == 0) revert InvalidRecipe();

        Recipe storage recipe = recipes[recipeId];
        recipe.feeCOM = feeCOM;
        recipe.craftingTime = craftingTime;
        recipe.requiredArtisanLevel = requiredArtisanLevel;

        emit RecipeUpdated(recipeId);
    }

    // ========== View Functions ==========

    /// @notice Ottiene i dettagli di una ricetta
    /// @param recipeId ID della ricetta
    /// @return Recipe Dettagli della ricetta
    function getRecipe(uint256 recipeId) external view returns (Recipe memory) {
        return recipes[recipeId];
    }

    /// @notice Ottiene tutti i job di crafting di un utente
    /// @param user Indirizzo dell'utente
    /// @return CraftingJob[] Array dei job di crafting
    function getUserCraftingJobs(address user) external view returns (CraftingJob[] memory) {
        return userCraftingJobs[user];
    }

    // ========== Internal Functions ==========

    /// @dev Verifica se un utente ha i materiali necessari
    function _hasMaterials(
        address user,
        uint256[] memory materialIds,
        uint256[] memory amounts
    ) internal view returns (bool) {
        for (uint256 i = 0; i < materialIds.length; i++) {
            if (materialsNFT.balanceOf(user, materialIds[i]) < amounts[i]) {
                return false;
            }
        }
        return true;
    }

    /// @dev Consuma i materiali necessari per il crafting
    function _consumeMaterials(
        address user,
        uint256[] memory materialIds,
        uint256[] memory amounts
    ) internal {
        materialsNFT.burnBatch(user, materialIds, amounts);
    }

    /// @dev Trova un artigiano disponibile con il livello richiesto
    function _getAvailableArtisan(uint256 requiredLevel) internal view returns (address artisan, uint256 artisanId) {
        IProfessionsManager.ArtisanInfo[] memory artisans = professionsManager.getProfessionMembers();
        
        for (uint256 i = 0; i < artisans.length; i++) {
            if (artisans[i].level >= requiredLevel && artisans[i].availableCraftingSlots > 0) {
                return (artisans[i].owner, artisans[i].tokenId);
            }
        }
        
        return (address(0), 0);
    }

    // ========== Admin Functions ==========

    /// @notice Aggiorna l'indirizzo del contratto COM
    function setComToken(address _newComToken) external onlyOwner {
        if (_newComToken == address(0)) revert InvalidAddress();
        comToken = ICOM(_newComToken);
    }

    /// @notice Aggiorna l'indirizzo del contratto CraftedItemNFT
    function setCraftedItemNFT(address _newCraftedItemNFT) external onlyOwner {
        if (_newCraftedItemNFT == address(0)) revert InvalidAddress();
        craftedItemNFT = ICraftedItemNFT(_newCraftedItemNFT);
    }

    /// @notice Aggiorna l'indirizzo del contratto ProfessionsManager
    function setProfessionsManager(address _newProfessionsManager) external onlyOwner {
        if (_newProfessionsManager == address(0)) revert InvalidAddress();
        professionsManager = IProfessionsManager(_newProfessionsManager);
    }

    /// @notice Aggiorna l'indirizzo della tesoreria
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        treasury = _newTreasury;
    }

    /// @notice Disattiva una ricetta
    function deactivateRecipe(uint256 recipeId) external onlyOwner {
        if (recipeId == 0 || recipeId > recipeCount) revert RecipeNotFound();
        recipes[recipeId].active = false;
        emit RecipeDeactivated(recipeId);
    }

    /// @notice Mette in pausa il contratto
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Riprende il contratto
    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
} 