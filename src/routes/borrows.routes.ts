import { Router } from "express";

import {
  createBorrow,
  getMyBorrows,
  returnBorrow,
} from "../controllers/borrows.controller.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.use(requireAuth);

router.post("/", createBorrow);
router.get("/", getMyBorrows);
router.delete("/:id", returnBorrow);

export default router;
