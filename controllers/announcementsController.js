
import db from "../config/db.js";

// Aggiunge tutte le immagini agli annunci restituiti dal database
async function attachImages(announcements) {
    if (announcements.length === 0) {
        return announcements;
    }

    const ids = announcements.map((announcement) => announcement.id);
    const placeholders = ids.map(() => "?").join(", ");

    const [images] = await db.query(
        `SELECT announcement_id, image_path
         FROM announcement_images
         WHERE announcement_id IN (${placeholders})
         ORDER BY id ASC`,
        ids
    );

    const imagesByAnnouncement = {};

    for (const image of images) {
        if (!imagesByAnnouncement[image.announcement_id]) {
            imagesByAnnouncement[image.announcement_id] = [];
        }

        imagesByAnnouncement[image.announcement_id].push(
            image.image_path
        );
    }

    return announcements.map((announcement) => ({
        ...announcement,
        images: imagesByAnnouncement[announcement.id] || []
    }));
}


// VISUALIZZARE I PROPRI ANNUNCI
export async function myAnnouncements(req, res) {
    try {
        const [annunci] = await db.query(
            `SELECT *
             FROM announcements
             WHERE user_id = ?
             ORDER BY id DESC`,
            [req.user.id]
        );

        const annunciConImmagini = await attachImages(annunci);

        res.json(annunciConImmagini);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Errore nel recupero dei tuoi annunci"
        });
    }
}


// VISUALIZZARE TUTTI GLI ANNUNCI
export async function index(req, res) {
    try {
        const [announcements] = await db.query(
            `SELECT announcements.*, utenti.username AS user_name
             FROM announcements
             JOIN utenti ON announcements.user_id = utenti.id
             ORDER BY announcements.created_at DESC`
        );

        const annunciConImmagini = await attachImages(announcements);

        res.json(annunciConImmagini);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Errore nel recupero degli annunci"
        });
    }
}


// CREARE UN ANNUNCIO CON PIÙ IMMAGINI
export async function store(req, res) {
    let connection;
    let transactionStarted = false;

    try {
        const {
            title,
            description,
            price,
            category,
            subcategory
        } = req.body;

        const files = req.files || [];

        if (
            !title?.trim() ||
            !description?.trim() ||
            price === undefined ||
            price === "" ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            !category
        ) {
            return res.status(400).json({
                message: "Compila tutti i campi obbligatori con dati validi"
            });
        }

        if (files.length === 0) {
            return res.status(400).json({
                message: "Seleziona almeno un'immagine"
            });
        }

        if (category === "Videogiochi" && !subcategory) {
            return res.status(400).json({
                message: "Seleziona una piattaforma"
            });
        }

        const sottoCategoria =
            category === "Videogiochi" ? subcategory || null : null;

        // Il campo image conserva il percorso della prima foto
        const primaImmagine = `/uploads/${files[0].filename}`;

        // Avvia una transazione per salvare annuncio e immagini insieme
        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [result] = await connection.query(
            `INSERT INTO announcements
             (title, description, price, category, subcategory, user_id, image)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description.trim(),
                Number(price),
                category,
                sottoCategoria,
                req.user.id,
                primaImmagine
            ]
        );

        const announcementId = result.insertId;

        // Salva ogni immagine nella tabella dedicata
        for (const file of files) {
            const imagePath = `/uploads/${file.filename}`;

            await connection.query(
                `INSERT INTO announcement_images
                 (announcement_id, image_path)
                 VALUES (?, ?)`,
                [announcementId, imagePath]
            );
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            message: "Annuncio pubblicato con successo",
            id: announcementId,
            image: primaImmagine,
            images: files.map(
                (file) => `/uploads/${file.filename}`
            )
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error("Errore creazione annuncio:", error);

        return res.status(500).json({
            message: "Errore durante la creazione dell'annuncio"
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}


// MODIFICARE UN ANNUNCIO
export async function update(req, res) {
    try {
        const { title, description, price, category, subcategory } = req.body;

        if (
            !title?.trim() ||
            !description?.trim() ||
            price === undefined ||
            price === "" ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            !category
        ) {
            return res.status(400).json({
                message: "Inserisci dati validi per tutti i campi"
            });
        }

        const sottoCategoria =
            category === "Videogiochi" ? subcategory || null : null;

        const [result] = await db.query(
            `UPDATE announcements
             SET title = ?,
                 description = ?,
                 price = ?,
                 category = ?,
                 subcategory = ?
             WHERE id = ? AND user_id = ?`,
            [
                title.trim(),
                description.trim(),
                Number(price),
                category,
                sottoCategoria,
                req.params.id,
                req.user.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Annuncio non trovato o non tuo"
            });
        }

        res.json({
            message: "Annuncio modificato con successo"
        });
    } catch (error) {
        console.error("Errore modifica annuncio:", error);

        res.status(500).json({
            message: "Errore durante la modifica dell'annuncio"
        });
    }
}


// ELIMINARE UN ANNUNCIO
export async function destroy(req, res) {
    try {
        const [result] = await db.query(
            `DELETE FROM announcements
             WHERE id = ? AND user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Annuncio non trovato o non tuo"
            });
        }

        res.json({
            message: "Annuncio eliminato con successo"
        });
    } catch (error) {
        console.error("Errore eliminazione annuncio:", error);

        res.status(500).json({
            message: "Errore durante l'eliminazione dell'annuncio"
        });
    }
}


// VISUALIZZARE UN SINGOLO ANNUNCIO CON TUTTE LE IMMAGINI
export async function getById(req, res) {
    try {
        const { id } = req.params;

        const [announcements] = await db.query(
            `SELECT
                a.*,
                u.username AS user_name
             FROM announcements a
             LEFT JOIN utenti u ON u.id = a.user_id
             WHERE a.id = ?`,
            [id]
        );

        if (announcements.length === 0) {
            return res.status(404).json({
                message: "Annuncio non trovato"
            });
        }

        const [images] = await db.query(
            `SELECT image_path
             FROM announcement_images
             WHERE announcement_id = ?
             ORDER BY id ASC`,
            [id]
        );

        const announcement = announcements[0];

        announcement.images = images.map(
            (image) => image.image_path
        );

        res.json(announcement);

    } catch (error) {
        console.error("Errore getById:", error);

        res.status(500).json({
            message: "Errore nel recupero dell'annuncio"
        });
    }
}
