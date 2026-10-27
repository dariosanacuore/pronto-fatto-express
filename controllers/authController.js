
import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import transporter from '../config/mailer.js';

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

        // Genero un token casuale per verificare l'email
        const token = crypto.randomBytes(32).toString('hex');

        // Salvo nel database soltanto l'hash del token
        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Inserisco il nuovo utente
        const [result] = await db.query(
            `INSERT INTO utenti
             (username, email, password, email_verificata,
              token_verifica, scadenza_token)
             VALUES (?, ?, ?, FALSE, ?,
                     DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
            [username, email, passwordHash, tokenHash]
        );
        const insertId = result.insertId;

        // Creo il link di verifica
        const link =
            `${process.env.FRONTEND_URL}/verifica-email/${token}`;

        // Invio l'email di conferma
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Conferma la tua email - ProntoFatto',
            html: `
                <h2>Benvenuto su ProntoFatto!</h2>

                <p>Per completare la registrazione,
                verifica il tuo indirizzo email.</p>

                <a href="${link}"
                   style="display:inline-block;
                   padding:12px 20px;
                   background:#0d6efd;
                   color:white;
                   text-decoration:none;
                   border-radius:6px;">
                    Verifica la mia email
                </a>

                <p>Il link scade tra un'ora.</p>

                <p>Se non hai richiesto la registrazione,
                ignora questa email.</p>
            `
        });

        return res.status(201).json({
            message: 'Registrazione effettuata! Controlla la tua email per confermare l\'account.',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Errore nella registrazione:', error);

        return res.status(500).json({
            message: 'Errore nella registrazione'
        });
    }
}


// VERIFICA EMAIL
export async function verificaEmail(req, res) {
    try {
        // Recupero il token dall'URL
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                message: 'Token mancante'
            });
        }

        // Calcolo l'hash del token ricevuto
        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Verifico il token e attivo l'account
        const [result] = await db.query(
            `UPDATE utenti
             SET email_verificata = TRUE,
                 token_verifica = NULL,
                 scadenza_token = NULL
             WHERE token_verifica = ?
               AND scadenza_token > NOW()
               AND email_verificata = FALSE`,
            [tokenHash]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({
                message: 'Link non valido, scaduto o già utilizzato'
            });
        }

        return res.status(200).json({
            message: 'Email verificata correttamente! Ora puoi accedere.'
        });

    } catch (error) {
        console.error('Errore nella verifica email:', error);

        return res.status(500).json({
            message: 'Errore durante la verifica dell\'email'
        });
    }
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

        // Cerco l'utente, compreso lo stato di verifica dell'email
        const [utenti] = await db.query(
            `SELECT id, username, email, password, email_verificata
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

        // Controllo che l'email sia verificata
        if (!utente.email_verificata) {
            return res.status(403).json({
                message: 'Devi verificare la tua email prima di accedere.'
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
