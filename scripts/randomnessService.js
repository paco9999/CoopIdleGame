const express = require('express');
const { ethers } = require('ethers');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configurazione
const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY; // Chiave privata del signer
if (!PRIVATE_KEY) {
    throw new Error('SIGNER_PRIVATE_KEY non trovata nelle variabili d\'ambiente');
}

// Inizializza il wallet con la chiave privata
const wallet = new ethers.Wallet(PRIVATE_KEY);

/**
 * Genera un numero casuale sicuro di 256 bit
 * @returns {Promise<bigint>} Numero casuale come BigInt
 */
async function generateSecureRandom() {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(32, (err, buf) => {
            if (err) reject(err);
            // Converti il buffer in BigInt
            const randomBigInt = BigInt('0x' + buf.toString('hex'));
            resolve(randomBigInt);
        });
    });
}

/**
 * Firma un messaggio contenente il numero casuale e il timestamp
 * @param {bigint} randomNumber - Numero casuale generato
 * @param {number} timestamp - Timestamp UNIX
 * @returns {Promise<string>} Firma del messaggio
 */
async function signRandomNumber(randomNumber, timestamp) {
    // Codifica il messaggio come lo farebbe Solidity
    const message = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [randomNumber, timestamp]
    );
    
    // Firma il messaggio
    const signature = await wallet.signMessage(ethers.getBytes(message));
    return signature;
}

// Endpoint per richiedere un nuovo numero casuale firmato
app.post('/random', async (req, res) => {
    try {
        // Genera il numero casuale
        const randomNumber = await generateSecureRandom();
        
        // Usa il timestamp corrente
        const timestamp = Math.floor(Date.now() / 1000);
        
        // Firma il numero + timestamp
        const signature = await signRandomNumber(randomNumber, timestamp);

        // Restituisci il risultato
        res.json({
            randomNumber: randomNumber.toString(), // Converti BigInt in stringa
            timestamp: timestamp,
            signature: signature,
            signer: wallet.address
        });
    } catch (error) {
        console.error('Errore nella generazione del numero casuale:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// Endpoint per verificare una firma (utile per debug)
app.post('/verify', async (req, res) => {
    try {
        const { randomNumber, timestamp, signature } = req.body;
        
        // Ricrea il messaggio
        const message = ethers.solidityPackedKeccak256(
            ['uint256', 'uint256'],
            [randomNumber, timestamp]
        );
        
        // Recupera l'indirizzo che ha firmato
        const recoveredAddress = ethers.verifyMessage(
            ethers.getBytes(message),
            signature
        );

        res.json({
            isValid: recoveredAddress === wallet.address,
            recoveredAddress,
            expectedAddress: wallet.address
        });
    } catch (error) {
        console.error('Errore nella verifica della firma:', error);
        res.status(500).json({ error: 'Errore nella verifica' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
    console.log(`Indirizzo del signer: ${wallet.address}`);
}); 