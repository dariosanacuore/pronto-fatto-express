import express from "express";

import {
    getWishlist,
    addToWishlist,
    removeFromWishlist
} from "../controllers/wishlistController.js";

import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth, getWishlist);

router.post("/", auth, addToWishlist);

router.delete("/:id", auth, removeFromWishlist);

export default router;