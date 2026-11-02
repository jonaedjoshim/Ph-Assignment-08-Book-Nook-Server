import type { RequestHandler } from "express";
import { ObjectId, type Filter, type WithId } from "mongodb";

import { getBorrowsCollection, getBooksCollection } from "../lib/mongodb.js";
import type { BookDocument } from "../types/book.js";
import {
  createBookSchema,
  listBooksQuerySchema,
  updateBookSchema,
} from "../validators/book.js";

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

function parseBookId(value: unknown): ObjectId | null {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{24}$/.test(value)) {
    return null;
  }

  return new ObjectId(value);
}

export const createBook: RequestHandler = async (req, res) => {
  const user = req.authUser;

  if (!user?.userId) {
    res.status(401).json({
      success: false,
      message: "Sign in is required to add a book.",
    });
    return;
  }

  if (!user.email) {
    res.status(403).json({
      success: false,
      message:
        "The access token does not include your email. Please sign in again.",
    });
    return;
  }

  const parsedBody = createBookSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      success: false,
      message: "Invalid book information.",
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const now = new Date();
    const email = user.email.trim();

    const book: BookDocument = {
      ...parsedBody.data,
      availableCopies: parsedBody.data.totalCopies,
      createdBy: {
        userId: user.userId,
        name: user.name?.trim() || email.split("@")[0] || "BookNook Reader",
        email,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await getBooksCollection().insertOne(book);

    res.status(201).json({
      success: true,
      message: "Book added successfully.",
      data: serializeBook({
        ...book,
        _id: result.insertedId,
      }),
    });
  } catch (error) {
    console.error("Failed to create book:", error);

    res.status(500).json({
      success: false,
      message: "Unable to add the book.",
    });
  }
};

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
  const bookId = parseBookId(req.params.id);

  if (!bookId) {
    res.status(400).json({
      success: false,
      message: "Invalid book ID.",
    });
    return;
  }

  try {
    const book = await getBooksCollection().findOne(
      { _id: bookId },
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

export const updateBook: RequestHandler<{ id: string }> = async (req, res) => {
  const userId = req.authUser?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Sign in is required to update a book.",
    });
    return;
  }

  const bookId = parseBookId(req.params.id);

  if (!bookId) {
    res.status(400).json({
      success: false,
      message: "Invalid book ID.",
    });
    return;
  }

  const parsedBody = updateBookSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({
      success: false,
      message: "Invalid book information.",
      errors: parsedBody.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  try {
    const booksCollection = getBooksCollection();
    const ownerFilter: Filter<BookDocument> = {
      _id: bookId,
      "createdBy.userId": userId,
    };

    const currentBook = await booksCollection.findOne(ownerFilter);

    if (!currentBook) {
      res.status(404).json({
        success: false,
        message: "Book not found or you do not own this book.",
      });
      return;
    }

    const updateFields: Partial<BookDocument> = {
      ...parsedBody.data,
      updatedAt: new Date(),
    };

    const requestedCopies = parsedBody.data.totalCopies;

    if (requestedCopies !== undefined) {
      const activeBorrowCount = await getBorrowsCollection().countDocuments({
        bookId,
        status: "active",
      });

      if (requestedCopies < activeBorrowCount) {
        res.status(409).json({
          success: false,
          message:
            "Total copies cannot be less than the number of currently borrowed copies.",
        });
        return;
      }

      updateFields.availableCopies = requestedCopies - activeBorrowCount;
    }

    const updateFilter: Filter<BookDocument> = { ...ownerFilter };

    if (requestedCopies !== undefined) {
      updateFilter.totalCopies = currentBook.totalCopies;
      updateFilter.availableCopies = currentBook.availableCopies;
    }

    const result = await booksCollection.updateOne(updateFilter, {
      $set: updateFields,
    });

    if (result.matchedCount === 0) {
      res.status(409).json({
        success: false,
        message: "The book changed while you were editing. Please try again.",
      });
      return;
    }

    const updatedBook = await booksCollection.findOne(ownerFilter);

    if (!updatedBook) {
      res.status(404).json({
        success: false,
        message: "Book not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Book updated successfully.",
      data: serializeBook(updatedBook),
    });
  } catch (error) {
    console.error("Failed to update book:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update the book.",
    });
  }
};

export const deleteBook: RequestHandler<{ id: string }> = async (req, res) => {
  const userId = req.authUser?.userId;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Sign in is required to delete a book.",
    });
    return;
  }

  const bookId = parseBookId(req.params.id);

  if (!bookId) {
    res.status(400).json({
      success: false,
      message: "Invalid book ID.",
    });
    return;
  }

  try {
    const booksCollection = getBooksCollection();
    const ownerFilter: Filter<BookDocument> = {
      _id: bookId,
      "createdBy.userId": userId,
    };

    const currentBook = await booksCollection.findOne(ownerFilter);

    if (!currentBook) {
      res.status(404).json({
        success: false,
        message: "Book not found or you do not own this book.",
      });
      return;
    }

    const activeBorrowCount = await getBorrowsCollection().countDocuments({
      bookId,
      status: "active",
    });

    if (activeBorrowCount > 0) {
      res.status(409).json({
        success: false,
        message: "This book cannot be deleted while it has active borrows.",
      });
      return;
    }

    const result = await booksCollection.deleteOne({
      ...ownerFilter,
      totalCopies: currentBook.totalCopies,
      availableCopies: currentBook.availableCopies,
    });

    if (result.deletedCount === 0) {
      res.status(409).json({
        success: false,
        message:
          "The book changed while you were deleting it. Refresh and try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Book deleted successfully.",
      data: {
        id: bookId.toHexString(),
      },
    });
  } catch (error) {
    console.error("Failed to delete book:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete the book.",
    });
  }
};
