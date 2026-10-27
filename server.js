
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import http from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';

import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import announcementsRoutes from './routes/announcementsRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import contactRoutes from './routes/contactRoutes.js';

import path from 'path';

// Creazione server Express e HTTP
const app = express();
const server = http.createServer(app);

// Render usa un proxy HTTPS davanti al server
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Verifica della configurazione
if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET non configurato');
}

// Origini autorizzate
const allowedOrigins = [
    'http://localhost:5173',
    'https://pronto-fatto2-react.vercel.app',
    'https://www.prontofattohub.it',
    'https://prontofattohub.it',
];

// Configurazione CORS per React e Axios
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Bloccato dalla policy CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// Log delle richieste
app.use((req, res, next) => {
    console.log('Metodo:', req.method);
    console.log('URL:', req.url);
    console.log('Origin:', req.headers.origin);
    next();
});

// Configurazione archivio sessioni MySQL
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({}, db);

sessionStore.on('error', (error) => {
    console.error('Errore archivio sessioni:', error);
});

// Configurazione cookie e sessioni
const isProduction = process.env.NODE_ENV === 'production';

const sessionMiddleware = session({
    name: 'prontofatto.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24
    }
});

app.use(sessionMiddleware);

// Configurazione Socket.IO
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});

// Socket.IO utilizza la stessa sessione di Express
io.engine.use(sessionMiddleware);

// Verifica autenticazione Socket.IO
io.use((socket, next) => {
    const utente = socket.request.session?.user;

    if (!utente?.id) {
        return next(new Error('Utente non autenticato'));
    }

    socket.userId = utente.id;
    socket.username = utente.username;

    next();
});

// Connessione e gestione chat
io.on('connection', (socket) => {
    console.log('Utente connesso:', socket.userId);

    socket.on('entra-conversazione', async (conversazioneId, callback) => {
        try {
            const id = Number(conversazioneId);

            if (!Number.isInteger(id) || id <= 0) {
                return callback?.({
                    error: 'Conversazione non valida'
                });
            }

            const [rows] = await db.execute(
                `SELECT id
                 FROM conversazioni
                 WHERE id = ?
                 AND (utente1_id = ? OR utente2_id = ?)`,
                [id, socket.userId, socket.userId]
            );

            if (rows.length === 0) {
                return callback?.({
                    error: 'Non puoi accedere a questa conversazione'
                });
            }

            socket.join(`conversazione-${id}`);

            callback?.({ success: true });
        } catch (error) {
            console.error('Errore accesso conversazione:', error);

            callback?.({
                error: "Errore durante l'accesso alla conversazione"
            });
        }
    });

    socket.on('invia-messaggio', async (dati, callback) => {
        try {
            const conversazioneId = Number(dati?.conversazioneId);

            const testo = typeof dati?.testo === 'string'
                ? dati.testo.trim()
                : '';

            if (
                !Number.isInteger(conversazioneId) ||
                conversazioneId <= 0 ||
                !testo ||
                testo.length > 5000
            ) {
                return callback?.({
                    error: 'Messaggio non valido'
                });
            }

            // Verifica che l'utente partecipi alla conversazione
            const [rows] = await db.execute(
                `SELECT id
                 FROM conversazioni
                 WHERE id = ?
                 AND (utente1_id = ? OR utente2_id = ?)`,
                [conversazioneId, socket.userId, socket.userId]
            );

            if (rows.length === 0) {
                return callback?.({
                    error: 'Conversazione non autorizzata'
                });
            }

            // Salvataggio del messaggio
            const [result] = await db.execute(
                `INSERT INTO messaggi
                    (conversazione_id, mittente_id, testo)
                 VALUES (?, ?, ?)`,
                [conversazioneId, socket.userId, testo]
            );

            const [messaggi] = await db.execute(
                `SELECT
                    m.id,
                    m.conversazione_id,
                    m.mittente_id,
                    u.username AS mittente_username,
                    m.testo,
                    m.data_invio
                 FROM messaggi m
                 JOIN utenti u ON u.id = m.mittente_id
                 WHERE m.id = ?`,
                [result.insertId]
            );

            const messaggio = messaggi[0];

            // Invio ai partecipanti della conversazione
            io.to(`conversazione-${conversazioneId}`)
                .emit('nuovo-messaggio', messaggio);

            callback?.({ success: true });
        } catch (error) {
            console.error('Errore invio messaggio:', error);

            callback?.({
                error: 'Impossibile inviare il messaggio'
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.userId);
    });
});

// Cartella per le immagini caricate
app.use(
    '/uploads',
    express.static(path.resolve('uploads'))
);

// Rotte API
app.use('/api/profile', profileRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api', contactRoutes);

// Rende Socket.IO disponibile alle rotte Express
app.set('io', io);

// Rotta di verifica del backend
app.get('/', (req, res) => {
    res.send('Backend ProntoFatto funzionante!');
});

// Avvio del server
server.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);
});
