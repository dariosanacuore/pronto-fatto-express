
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cartella uploads nella directory principale del backend
const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const estensione = path.extname(file.originalname).toLowerCase();
        const nomeFile = `${Date.now()}-${Math.round(Math.random() * 1e9)}${estensione}`;

        cb(null, nomeFile);
    }
});

function fileFilter(req, file, cb) {
    const tipiConsentiti = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (tipiConsentiti.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Sono consentite solo immagini JPG, PNG e WEBP"));
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10
    }
});

export default upload;
