import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import http from 'http';
import { Server } from 'socket.io';
import chatRoutes from "./routes/chatRoutes.js";
import db from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import announcementsRoutes from './routes/announcementsRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import "dotenv/config";
import chatbotRoutes from "./routes/chatbotRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";

import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);

const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({}, db);

const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    console.log('Metodo:', req.method);
    console.log('URL:', req.url);
    console.log('Origin:', req.headers.origin);
    next();
});

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

const sessionMiddleware = session({
    name: 'prontofatto.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24
    }
});

app.use(sessionMiddleware);

// Configurazione Socket.IO
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        credentials: true
    }
});

// Usa la stessa sessione Express anche per Socket.IO
io.engine.use(sessionMiddleware);

// Controlla che l'utente abbia una sessione autenticata
io.use((socket, next) => {
    const utente = socket.request.session?.user;

    if (!utente?.id) {
        return next(new Error('Utente non autenticato'));
    }

    socket.userId = utente.id;
    socket.username = utente.username;

    next();
});


io.on("connection", (socket) => {
    console.log("Utente connesso:", socket.userId);

    socket.on("entra-conversazione", async (conversazioneId, callback) => {
        try {
            const id = Number(conversazioneId);

            if (!Number.isInteger(id) || id <= 0) {
                return callback?.({
                    error: "Conversazione non valida"
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
                    error: "Non puoi accedere a questa conversazione"
                });
            }

            socket.join(`conversazione-${id}`);

            callback?.({ success: true });

        } catch (error) {
            console.error(error);

            callback?.({
                error: "Errore durante l'accesso alla conversazione"
            });
        }
    });

    socket.on("invia-messaggio", async (dati, callback) => {
        try {
            const conversazioneId = Number(dati?.conversazioneId);
            const testo = typeof dati?.testo === "string"
                ? dati.testo.trim()
                : "";

            if (
                !Number.isInteger(conversazioneId) ||
                conversazioneId <= 0 ||
                !testo ||
                testo.length > 5000
            ) {
                return callback?.({
                    error: "Messaggio non valido"
                });
            }

            // Verifica nuovamente che l'utente possa scrivere
            const [rows] = await db.execute(
                `SELECT id
                 FROM conversazioni
                 WHERE id = ?
                 AND (utente1_id = ? OR utente2_id = ?)`,
                [conversazioneId, socket.userId, socket.userId]
            );

            if (rows.length === 0) {
                return callback?.({
                    error: "Conversazione non autorizzata"
                });
            }

            // Salva il messaggio nel database
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

            // Invia il messaggio ai partecipanti della conversazione
            io.to(`conversazione-${conversazioneId}`)
                .emit("nuovo-messaggio", messaggio);

            callback?.({ success: true });

        } catch (error) {
            console.error("Errore invio messaggio:", error);

            callback?.({
                error: "Impossibile inviare il messaggio"
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("Utente disconnesso:", socket.userId);
    });
});


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.resolve('uploads')));

app.use('/api/profile', profileRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api", contactRoutes);

// Rendi io disponibile alle rotte Express, se necessario
app.set('io', io);

server.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});