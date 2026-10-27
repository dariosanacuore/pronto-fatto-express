
import db from "../config/db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.resolve("uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
});

function fileFilter(req, file, cb) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Formato immagine non supportato"));
    }
}

export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 },
});

export async function getProfile(req, res) {
    console.log("Sessione ricevuta:", req.session);
    console.log("ID utente:", req.session.userId);
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Non autenticato" });
    }

    const [users] = await db.query(
        "SELECT id, username, email, immagine_profilo FROM utenti WHERE id = ?",
        [userId]
    );

    if (users.length === 0) {
        return res.status(404).json({ message: "Utente non trovato" });
    }

    res.json(users[0]);
}


export async function updateProfile(req, res) {
    try {
        const userId = req.session.user?.id;

        if (!userId) {
            return res.status(401).json({
                message: "Non autenticato"
            });
        }

        const { nome, email } = req.body;

        if (!nome?.trim() || !email?.trim()) {
            return res.status(400).json({
                message: "Nome ed email sono obbligatori"
            });
        }

        const [existing] = await db.query(
            "SELECT id FROM utenti WHERE email = ? AND id != ?",
            [email.trim(), userId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "Questa email è già utilizzata"
            });
        }

        const [users] = await db.query(
            "SELECT immagine_profilo FROM utenti WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "Utente non trovato"
            });
        }

        let immagine = users[0].immagine_profilo;

        if (req.file) {
            immagine = `/uploads/${req.file.filename}`;
        }

        await db.query(
            `UPDATE utenti
             SET username = ?, email = ?, immagine_profilo = ?
             WHERE id = ?`,
            [nome.trim(), email.trim(), immagine, userId]
        );

        return res.json({
            message: "Profilo aggiornato correttamente",
            user: {
                id: userId,
                nome: nome.trim(),
                email: email.trim(),
                immagine_profilo: immagine
            }
        });

    } catch (error) {
        console.error("Errore aggiornamento profilo:", error);

        return res.status(500).json({
            message: "Errore durante il salvataggio del profilo"
        });
    }
}
