import { z } from "zod";

import { BOOK_CATEGORIES } from "../types/book.js";

export const createBookSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    author: z.string().trim().min(1).max(100),
    category: z.enum(BOOK_CATEGORIES),
    imageUrl: z.string().trim().url(),
    description: z.string().trim().min(1).max(1000),
    totalCopies: z.coerce.number().int().min(1).max(10000),
  })
  .strict();

export const updateBookSchema = createBookSchema
  .partial()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided.",
  });

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
