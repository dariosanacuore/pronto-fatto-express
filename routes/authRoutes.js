
import express from "express";
import { verificaEmail } from "../controllers/authController.js";

import {
    register,
    login
} from "../controllers/authController.js";

import { auth } from "../middleware/auth.js";

const router = express.Router();

// Verifica se l'utente è autenticato
router.get("/me", auth, (req, res) => {
    res.json({
        user: req.user
    });
});

// Registrazione
router.post("/register", register);
//Verifica email
router.get('/verifica-email/:token', verificaEmail);
// Login
router.post("/login", login);

// Logout
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                message: "Errore durante il logout"
            });
        }

        res.clearCookie("prontofatto.sid");

        res.json({
            message: "Logout effettuato"
        });
    });
});

export default router;
