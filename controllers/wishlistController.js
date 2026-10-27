
import db from "../config/db.js";

// Recupera gli annunci salvati dall'utente autenticato
export async function getWishlist(req, res) {
    try {
        const userId = req.user.id;

        const [wishlist] = await db.query(
            `SELECT
        a.id AS announcement_id,
        a.title,
        a.description,
        a.price,
        a.category,
        a.subcategory,
        a.image,
        a.user_id,
        u.username AS user_name,
        w.created_at
    FROM wishlist w
    INNER JOIN announcements a
        ON a.id = w.announcement_id
    INNER JOIN utenti u
        ON u.id = a.user_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC`,
            [userId]
        );
        res.json(wishlist);
    } catch (error) {
        console.error("Errore getWishlist:", error);

        res.status(500).json({
            message: "Errore nel recupero della wishlist",
            error: error.message
        });
    }
}

// Aggiunge un annuncio ai preferiti
export async function addToWishlist(req, res) {
    try {
        const userId = req.user.id;
        const { announcement_id } = req.body;

        if (
            !Number.isInteger(Number(announcement_id)) ||
            Number(announcement_id) <= 0
        ) {
            return res.status(400).json({
                message: "ID annuncio non valido"
            });
        }

        const [announcements] = await db.query(
            "SELECT id FROM announcements WHERE id = ?",
            [announcement_id]
        );

        if (announcements.length === 0) {
            return res.status(404).json({
                message: "Annuncio non trovato"
            });
        }

        await db.query(
            `INSERT INTO wishlist (user_id, announcement_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE announcement_id = VALUES(announcement_id)`,
            [userId, Number(announcement_id)]
        );

        res.status(201).json({
            message: "Annuncio aggiunto alla wishlist"
        });
    } catch (error) {
        console.error("Errore addToWishlist:", error);
        res.status(500).json({
            message: "Errore durante l'aggiunta ai preferiti"
        });
    }
}

// Rimuove un annuncio dai preferiti
export async function removeFromWishlist(req, res) {
    try {
        const userId = req.user.id;
        const announcementId = req.params.id;

        await db.query(
            `DELETE FROM wishlist
             WHERE user_id = ? AND announcement_id = ?`,
            [userId, announcementId]
        );

        res.json({
            message: "Annuncio rimosso dalla wishlist"
        });
    } catch (error) {
        console.error("Errore removeFromWishlist:", error);
        res.status(500).json({
            message: "Errore durante la rimozione dai preferiti"
        });
    }
}
