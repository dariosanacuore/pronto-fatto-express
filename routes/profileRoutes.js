
import express from "express";
import {
    getProfile,
    updateProfile,
    upload,
} from "../controllers/profileController.js";

const router = express.Router();

router.get("/", getProfile);

router.put("/", upload.single("immagine"), updateProfile);

export default router;
