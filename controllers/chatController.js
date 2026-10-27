
import db from "../config/db.js";

// Crea una conversazione oppure recupera quella esistente
export async function creaConversazione(req, res) {
    try {
        const utenteLoggato = req.session.user?.id;
        const altroUtenteId = Number(req.body.altroUtenteId);

        console.log("Utente loggato:", utenteLoggato);
        console.log("Destinatario ricevuto:", req.body.altroUtenteId);
        console.log("Destinatario convertito:", altroUtenteId);

        if (!utenteLoggato) {
            return res.status(401).json({
                message: "Devi effettuare il login"
            });
        }

        if (
            !Number.isInteger(altroUtenteId) ||
            altroUtenteId <= 0 ||
            altroUtenteId === Number(utenteLoggato)
        ) {
            return res.status(400).json({
                message: "Utente destinatario non valido"
            });
        }

        const [utenti] = await db.execute(
            "SELECT id FROM utenti WHERE id = ?",
            [altroUtenteId]
        );

        if (utenti.length === 0) {
            return res.status(404).json({
                message: "Utente non trovato"
            });
        }

        const id1 = Math.min(
            Number(utenteLoggato),
            altroUtenteId
        );

        const id2 = Math.max(
            Number(utenteLoggato),
            altroUtenteId
        );

        await db.execute(
            `INSERT INTO conversazioni (utente1_id, utente2_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
            [id1, id2]
        );

        const [conversazioni] = await db.execute(
            `SELECT id, utente1_id, utente2_id
             FROM conversazioni
             WHERE utente1_id = ? AND utente2_id = ?`,
            [id1, id2]
        );

        return res.status(200).json(conversazioni[0]);

    } catch (error) {
        console.error("Errore creazione conversazione:", error);

        return res.status(500).json({
            message: "Errore durante la creazione della conversazione"
        });
    }
}

// Recupera lo storico dei messaggi
export async function recuperaMessaggi(req, res) {
    try {
        const utenteId = req.session.user?.id;
        const conversazioneId = Number(req.params.id);

        if (!utenteId) {
            return res.status(401).json({
                message: "Devi effettuare il login"
            });
        }

        const [conversazioni] = await db.execute(
            `SELECT id
             FROM conversazioni
             WHERE id = ?
             AND (utente1_id = ? OR utente2_id = ?)`,
            [conversazioneId, utenteId, utenteId]
        );

        if (conversazioni.length === 0) {
            return res.status(404).json({
                message: "Conversazione non trovata"
            });
        }

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
             WHERE m.conversazione_id = ?
             ORDER BY m.id ASC`,
            [conversazioneId]
        );

        return res.status(200).json(messaggi);

    } catch (error) {
        console.error("Errore recupero messaggi:", error);

        return res.status(500).json({
            message: "Errore durante il recupero dei messaggi"
        });
    }
}
// controllers/chatController.js

export async function recuperaConversazioni(req, res) {
    try {
        const utenteId = req.session.user?.id;

        if (!utenteId) {
            return res.status(401).json({
                message: "Devi effettuare il login"
            });
        }

        const [conversazioni] = await db.execute(
            `SELECT
                c.id AS conversazione_id,

                CASE
                    WHEN c.utente1_id = ? THEN u2.id
                    ELSE u1.id
                END AS altro_utente_id,

                CASE
                    WHEN c.utente1_id = ? THEN u2.username
                    ELSE u1.username
                END AS altro_utente_username,

                m.testo AS ultimo_messaggio,
                m.data_invio AS data_ultimo_messaggio,
                m.mittente_id AS ultimo_mittente_id

            FROM conversazioni c

            JOIN utenti u1
                ON u1.id = c.utente1_id

            JOIN utenti u2
                ON u2.id = c.utente2_id

            LEFT JOIN messaggi m
                ON m.id = (
                    SELECT m2.id
                    FROM messaggi m2
                    WHERE m2.conversazione_id = c.id
                    ORDER BY m2.id DESC
                    LIMIT 1
                )

            WHERE c.utente1_id = ?
               OR c.utente2_id = ?

            ORDER BY m.data_invio DESC, c.id DESC`,
            [
                utenteId,
                utenteId,
                utenteId,
                utenteId
            ]
        );

        return res.status(200).json(conversazioni);

    } catch (error) {
        console.error("Errore recupero conversazioni:", error);

        return res.status(500).json({
            message: "Errore durante il recupero delle conversazioni"
        });
    }
}
