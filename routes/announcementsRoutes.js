
import express from "express";
import { auth } from "../middleware/auth.js";
import upload from "../uploads/upload.js";

import {
    index,
    store,
    update,
    destroy,
    myAnnouncements,
    getById
} from "../controllers/announcementsController.js";

const router = express.Router();

function handleUpload(req, res, next) {
    upload.array("images", 10)(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                message: err.message
            });
        }

        next();
    });
}

// Visualizzare gli annunci
router.get("/", index);

// Visualizzare i propri annunci
router.get("/mine", auth, myAnnouncements);

// Creare un annuncio con più immagini
router.post("/", auth, handleUpload, (req, res, next) => {
    console.log("File ricevuti:", req.files);
    console.log("Dati ricevuti:", req.body);

    next();
}, store);

// Modificare un annuncio
router.put("/:id", auth, update);

// Eliminare un annuncio
router.delete("/:id", auth, destroy);

// Visualizzare un singolo annuncio
router.get("/:id", getById);

export default router;
