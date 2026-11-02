import { Router } from "express";

import {
  createBook,
  getBookById,
  listBooks,
} from "../controllers/books.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.get("/", listBooks);
router.get("/:id", getBookById);
router.post("/", requireAuth, createBook);

export default router;
