
import express from "express";

import {
    creaConversazione,
    recuperaMessaggi,
    recuperaConversazioni
} from "../controllers/chatController.js";

const router = express.Router();

router.post("/conversazioni", creaConversazione);

router.get("/conversazioni", recuperaConversazioni);

router.get(
    "/conversazioni/:id/messaggi",
    recuperaMessaggi
);

export default router;
