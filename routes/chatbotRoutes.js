
import express from "express";
import { chatWithAI } from "../controllers/chatbotController.js";

const router = express.Router();

router.post("/", (req, res) => {
    console.log("ROUTE CHATBOT RAGGIUNTA");
    chatWithAI(req, res);
});

export default router;