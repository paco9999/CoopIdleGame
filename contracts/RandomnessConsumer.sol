// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RandomnessConsumer
 * @dev Contratto per la verifica di numeri casuali generati off-chain
 * @notice Questo contratto verifica la validità delle firme dei numeri casuali generati off-chain
 */
contract RandomnessConsumer is Ownable {
    /// @notice Indirizzo autorizzato a firmare i numeri casuali
    address public randomnessSigner;

    /// @notice Mapping per tenere traccia dei numeri casuali già utilizzati
    mapping(uint256 => bool) public usedRandomNumbers;

    /// @notice Evento emesso quando un numero casuale viene verificato con successo
    event RandomnessVerified(uint256 indexed randomNumber, uint256 timestamp);
    
    /// @notice Evento emesso quando viene cambiato il signer
    event RandomnessSignerUpdated(address indexed oldSigner, address indexed newSigner);

    /// @notice Errori custom
    error InvalidSigner();
    error RandomNumberAlreadyUsed();
    error InvalidSignature();
    error InvalidAddress();

    /**
     * @dev Costruttore che imposta l'owner e il signer iniziale
     * @param _randomnessSigner Indirizzo autorizzato a firmare i numeri casuali
     */
    constructor(address _randomnessSigner) Ownable(msg.sender) {
        if (_randomnessSigner == address(0)) revert InvalidAddress();
        randomnessSigner = _randomnessSigner;
        emit RandomnessSignerUpdated(address(0), _randomnessSigner);
    }

    /**
     * @dev Funzione per aggiornare l'indirizzo del signer
     * @param _newSigner Nuovo indirizzo autorizzato
     */
    function setRandomnessSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert InvalidAddress();
        address oldSigner = randomnessSigner;
        randomnessSigner = _newSigner;
        emit RandomnessSignerUpdated(oldSigner, _newSigner);
    }

    /**
     * @dev Verifica e consuma un numero casuale firmato
     * @param randomNumber Numero casuale generato off-chain
     * @param timestamp Timestamp della generazione del numero
     * @param signature Firma del numero casuale + timestamp
     * @return Il numero casuale verificato
     */
    function consumeRandomness(
        uint256 randomNumber,
        uint256 timestamp,
        bytes calldata signature
    ) external returns (uint256) {
        // Verifica che il numero non sia già stato usato
        if (usedRandomNumbers[randomNumber]) revert RandomNumberAlreadyUsed();

        // Crea il messaggio da verificare (randomNumber + timestamp)
        bytes32 message = keccak256(abi.encodePacked(randomNumber, timestamp));
        
        // Recupera l'indirizzo che ha firmato il messaggio
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(ethSignedMessageHash, signature);

        // Verifica che il firmatario sia quello autorizzato
        if (signer != randomnessSigner) revert InvalidSignature();

        // Marca il numero come utilizzato
        usedRandomNumbers[randomNumber] = true;

        // Emetti l'evento
        emit RandomnessVerified(randomNumber, timestamp);

        return randomNumber;
    }

    /**
     * @dev Verifica una firma senza consumare il numero casuale
     * @param randomNumber Numero casuale da verificare
     * @param timestamp Timestamp della generazione del numero
     * @param signature Firma del numero casuale + timestamp
     * @return bool True se la firma è valida
     */
    function verifySignature(
        uint256 randomNumber,
        uint256 timestamp,
        bytes calldata signature
    ) public view returns (bool) {
        bytes32 message = keccak256(abi.encodePacked(randomNumber, timestamp));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        return signer == randomnessSigner;
    }

    // ========== Test Functions ==========
    /// @notice Registra direttamente un numero casuale per i test
    /// @dev Solo per scopi di test
    /// @param requestId ID univoco della richiesta
    /// @param timestamp Timestamp della generazione
    function registerRandomNumber(uint256 requestId, uint256 timestamp) external {
        // Questa funzione è solo per i test e non dovrebbe essere usata in produzione
        usedRandomNumbers[requestId] = false;
    }
} 