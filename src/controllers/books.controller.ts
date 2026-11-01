import type { RequestHandler } from "express";
import { ObjectId, type Filter, type WithId } from "mongodb";

import { getBooksCollection } from "../lib/mongodb.js";
import type { BookDocument } from "../types/book.js";
import { listBooksQuerySchema } from "../validators/book.js";

function serializeBook(book: WithId<BookDocument>) {
  return {
    _id: book._id.toHexString(),
    title: book.title,
    author: book.author,
    category: book.category,
    imageUrl: book.imageUrl,
    description: book.description,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
    createdBy: {
      userId: book.createdBy.userId,
      name: book.createdBy.name,
    },
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

export const listBooks: RequestHandler = async (req, res) => {
  const parsedQuery = listBooksQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({
      success: false,
      message: "Invalid book query parameters.",
      errors: parsedQuery.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const { page, limit, category, search } = parsedQuery.data;
  const filter: Filter<BookDocument> = {};

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  try {
    const booksCollection = getBooksCollection();

    const [books, total] = await Promise.all([
      booksCollection
        .find(filter, {
          projection: { "createdBy.email": 0 },
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),

      booksCollection.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: books.map(serializeBook),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to list books:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve books.",
    });
  }
};

export const getBookById: RequestHandler<{ id: string }> = async (req, res) => {
  const id = req.params.id;

  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
    res.status(400).json({
      success: false,
      message: "Invalid book ID.",
    });
    return;
  }

  try {
    const book = await getBooksCollection().findOne(
      { _id: new ObjectId(id) },
      {
        projection: { "createdBy.email": 0 },
      },
    );

    if (!book) {
      res.status(404).json({
        success: false,
        message: "Book not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: serializeBook(book),
    });
  } catch (error) {
    console.error("Failed to retrieve book:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve the book.",
    });
  }
};
