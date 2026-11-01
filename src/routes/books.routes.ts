import { Router } from "express";

import { getBookById, listBooks } from "../controllers/books.controller.js";

const router = Router();

router.get("/", listBooks);
router.get("/:id", getBookById);

export default router;
