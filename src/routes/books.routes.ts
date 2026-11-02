import type { RequestHandler } from "express";
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

const authenticateMyBooksRequest: RequestHandler = (req, res, next) => {
  if (req.query.mine !== "true") {
    next();
    return;
  }

  Promise.resolve(requireAuth(req, res, next)).catch(next);
};

router.get("/", authenticateMyBooksRequest, listBooks);
router.get("/:id", getBookById);

router.post("/", requireAuth, createBook);
router.patch("/:id", requireAuth, updateBook);
router.delete("/:id", requireAuth, deleteBook);

export default router;
