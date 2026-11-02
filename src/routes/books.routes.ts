import { Router } from "express";

import {
  createBook,
  deleteBook,
  getBookById,
  listBooks,
  updateBook,
} from "../controllers/books.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.get("/", listBooks);
router.get("/:id", getBookById);

router.post("/", requireAuth, createBook);
router.patch("/:id", requireAuth, updateBook);
router.delete("/:id", requireAuth, deleteBook);

export default router;
