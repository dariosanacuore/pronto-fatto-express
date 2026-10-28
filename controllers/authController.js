
import db from '../config/db.js';
import bcrypt from 'bcryptjs';

// REGISTRAZIONE
export async function register(req, res) {
    try {
        const {
            username,
            email,
            password,
            conferma_password
        } = req.body;

        // Controllo che tutti i campi siano compilati
        if (!username || !email || !password || !conferma_password) {
            return res.status(400).json({
                message: 'Compila tutti i campi'
            });
        }

        // Controllo che le password coincidano
        if (password !== conferma_password) {
            return res.status(400).json({
                message: 'Le password devono coincidere'
            });
        }

        // Controllo se l'email è già registrata
        const [utenti] = await db.query(
            'SELECT id FROM utenti WHERE email = ?',
            [email]
        );

        if (utenti.length > 0) {
            return res.status(409).json({
                message: 'Email già registrata'
            });
        }

        // Proteggo la password con bcrypt
        const passwordHash = await bcrypt.hash(password, 12);

        // Inserisco il nuovo utente impostandolo direttamente come verificato
        const [result] = await db.query(
            `INSERT INTO utenti
             (username, email, password, email_verificata)
             VALUES (?, ?, ?, TRUE)`,
            [username, email, passwordHash]
        );
        const insertId = result.insertId;

        return res.status(201).json({
            message: 'Registrazione effettuata con successo! Ora puoi accedere.',
            userId: insertId
        });

    } catch (error) {
        console.error('Errore nella registrazione:', error);

        return res.status(500).json({
            message: 'Errore nella registrazione'
        });
    }
}


// VERIFICA EMAIL (Disattivata/Non più necessaria)
export async function verificaEmail(req, res) {
    return res.status(200).json({
        message: 'La verifica email non è attiva.'
    });
}


// LOGIN
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Controllo che i campi siano compilati
        if (!email || !password) {
            return res.status(400).json({
                message: 'Devi compilare tutti i campi'
            });
        }

        // Cerco l'utente
        const [utenti] = await db.query(
            `SELECT id, username, email, password
             FROM utenti
             WHERE email = ?`,
            [email]
        );

        // Controllo che l'utente esista
        if (utenti.length === 0) {
            return res.status(401).json({
                message: 'Email o password non corrette'
            });
        }

        const utente = utenti[0];

        // Verifico la password
        const passwordCorretta = await bcrypt.compare(
            password,
            utente.password
        );

        if (!passwordCorretta) {
            return res.status(401).json({
                message: 'Email o password non corrette'
            });
        }

        // Salvo l'utente nella sessione
        req.session.user = {
            id: utente.id,
            username: utente.username,
            email: utente.email
        };

        // Salvo la sessione
        req.session.save((err) => {
            if (err) {
                console.error(
                    'Errore nel salvataggio della sessione:',
                    err
                );

                return res.status(500).json({
                    message: 'Errore durante il salvataggio della sessione'
                });
            }

            return res.status(200).json({
                message: 'Login effettuato',
                user: req.session.user
            });
        });

    } catch (error) {
        console.error('Errore nel login:', error);

        return res.status(500).json({
            message: 'Errore durante il login'
        });
    }
}