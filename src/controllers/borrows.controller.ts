import type {
  ClientSession,
  MongoClient,
  ObjectId as MongoObjectId,
} from "mongodb";
import { ObjectId } from "mongodb";
import type { Request, RequestHandler, Response } from "express";

import { getDatabase } from "../lib/mongodb.js";

type BookDocument = {
  _id: ObjectId;
  title: string;
  imageUrl: string;
  totalCopies: number;
  availableCopies: number;
  updatedAt?: Date;
};

type BorrowStatus = "active" | "returned";

type BorrowDocument = {
  _id: ObjectId;
  bookId: string;
  bookTitle: string;
  bookImageUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
  borrowedAt: Date;
  dueAt: Date;
  status: BorrowStatus;
  returnedAt: Date | null;
};

type AuthenticatedIdentity = {
  userId: string;
  userName: string;
  userEmail: string;
};

type RequestWithIdentity = Request & {
  user?: unknown;
  auth?: unknown;
  authUser?: unknown;
  authenticatedUser?: unknown;
  jwtPayload?: unknown;
  tokenPayload?: unknown;
};

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getAuthenticatedIdentity(
  request: Request,
): AuthenticatedIdentity | null {
  const authenticatedRequest = request as RequestWithIdentity;

  const sources = [
    authenticatedRequest.user,
    authenticatedRequest.auth,
    authenticatedRequest.authUser,
    authenticatedRequest.authenticatedUser,
    authenticatedRequest.jwtPayload,
    authenticatedRequest.tokenPayload,
  ];

  for (const source of sources) {
    if (!isRecord(source)) {
      continue;
    }

    const possibleIdentities = [
      source,
      source.user,
      source.payload,
      source.claims,
      source.identity,
    ];

    for (const possibleIdentity of possibleIdentities) {
      if (!isRecord(possibleIdentity)) {
        continue;
      }

      const userId =
        readString(possibleIdentity.userId) ||
        readString(possibleIdentity.id) ||
        readString(possibleIdentity.sub);

      const userEmail =
        readString(possibleIdentity.email) ||
        readString(possibleIdentity.userEmail);

      if (!userId || !userEmail) {
        continue;
      }

      const userName =
        readString(possibleIdentity.name) ||
        readString(possibleIdentity.userName) ||
        userEmail.split("@")[0] ||
        "BookNook member";

      return {
        userId,
        userName,
        userEmail,
      };
    }
  }

  return null;
}

function toPublicBorrow(borrow: BorrowDocument) {
  const id = borrow._id.toHexString();

  return {
    ...borrow,
    _id: id,
    id,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return isRecord(error) && error.code === 11000;
}

function sendError(
  response: Response,
  error: unknown,
  fallbackMessage: string,
): void {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  if (isDuplicateKeyError(error)) {
    response.status(409).json({
      message: "You already have an active borrow for this book.",
    });
    return;
  }

  console.error("[BookNook] Borrow API error:", error);

  response.status(500).json({
    message: fallbackMessage,
  });
}

function getMongoClient(database: unknown): MongoClient {
  const client = (database as { client?: MongoClient }).client;

  if (!client) {
    throw new Error("The MongoDB client could not be accessed.");
  }

  return client;
}

async function closeSession(session: ClientSession | undefined) {
  if (session) {
    await session.endSession().catch(() => undefined);
  }
}

export const createBorrow: RequestHandler = async (request, response) => {
  const identity = getAuthenticatedIdentity(request);

  if (!identity) {
    response.status(401).json({ message: "Please log in to borrow a book." });
    return;
  }

  const body: unknown = request.body;
  const bookIdValue = isRecord(body) ? readString(body.bookId) : "";

  if (!/^[a-f\d]{24}$/i.test(bookIdValue)) {
    response.status(400).json({ message: "A valid bookId is required." });
    return;
  }

  let session: ClientSession | undefined;

  try {
    const database = await getDatabase();
    const client = getMongoClient(database);

    const books = database.collection<BookDocument>("books");
    const borrows = database.collection<BorrowDocument>("borrows");

    session = client.startSession();

    const bookObjectId = new ObjectId(bookIdValue);
    const borrowedAt = new Date();
    const dueAt = new Date(borrowedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const borrowId = new ObjectId();

    let createdBorrow: BorrowDocument | undefined;

    await session.withTransaction(async () => {
      const existingBorrow = await borrows.findOne(
        {
          bookId: bookIdValue,
          userId: identity.userId,
          status: "active",
        },
        { session },
      );

      if (existingBorrow) {
        throw new ApiError(
          409,
          "You already have an active borrow for this book.",
        );
      }

      const updatedBook = await books.findOneAndUpdate(
        {
          _id: bookObjectId,
          availableCopies: { $gt: 0 },
        },
        {
          $inc: { availableCopies: -1 },
          $set: { updatedAt: borrowedAt },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updatedBook) {
        const bookExists = await books.findOne(
          { _id: bookObjectId },
          { session },
        );

        if (!bookExists) {
          throw new ApiError(404, "This book could not be found.");
        }

        throw new ApiError(409, "This book is currently not available.");
      }

      const borrow: BorrowDocument = {
        _id: borrowId,
        bookId: bookIdValue,
        bookTitle: updatedBook.title,
        bookImageUrl: updatedBook.imageUrl,
        userId: identity.userId,
        userName: identity.userName,
        userEmail: identity.userEmail,
        borrowedAt,
        dueAt,
        status: "active",
        returnedAt: null,
      };

      await borrows.insertOne(borrow, { session });
      createdBorrow = borrow;
    });

    if (!createdBorrow) {
      throw new Error("The borrow transaction did not return a borrow record.");
    }

    response.status(201).json({
      message: "Book borrowed successfully.",
      borrow: toPublicBorrow(createdBorrow),
    });
  } catch (error) {
    sendError(response, error, "The book could not be borrowed.");
  } finally {
    await closeSession(session);
  }
};

export const getMyBorrows: RequestHandler = async (request, response) => {
  const identity = getAuthenticatedIdentity(request);

  if (!identity) {
    response
      .status(401)
      .json({ message: "Please log in to view your borrows." });
    return;
  }

  try {
    const database = await getDatabase();
    const borrows = database.collection<BorrowDocument>("borrows");

    const userBorrows = await borrows
      .find({ userId: identity.userId })
      .sort({ status: 1, borrowedAt: -1 })
      .toArray();

    response.status(200).json({
      borrows: userBorrows.map(toPublicBorrow),
    });
  } catch (error) {
    sendError(response, error, "Your borrowed books could not be loaded.");
  }
};

export const returnBorrow: RequestHandler = async (request, response) => {
  const identity = getAuthenticatedIdentity(request);

  if (!identity) {
    response.status(401).json({ message: "Please log in to return a book." });
    return;
  }

  const borrowIdValue = request.params.id;

  if (
    typeof borrowIdValue !== "string" ||
    !/^[a-f\d]{24}$/i.test(borrowIdValue)
  ) {
    response.status(400).json({ message: "A valid borrow id is required." });
    return;
  }

  let session: ClientSession | undefined;

  try {
    const database = await getDatabase();
    const client = getMongoClient(database);

    const borrows = database.collection<BorrowDocument>("borrows");
    const books = database.collection<BookDocument>("books");

    session = client.startSession();

    const borrowObjectId = new ObjectId(borrowIdValue);
    const returnedAt = new Date();

    let returnedBorrow: BorrowDocument | undefined;

    await session.withTransaction(async () => {
      const activeBorrow = await borrows.findOneAndUpdate(
        {
          _id: borrowObjectId,
          userId: identity.userId,
          status: "active",
        },
        {
          $set: {
            status: "returned",
            returnedAt,
          },
        },
        {
          returnDocument: "before",
          session,
        },
      );

      if (!activeBorrow) {
        const existingBorrow = await borrows.findOne(
          {
            _id: borrowObjectId,
            userId: identity.userId,
          },
          { session },
        );

        if (!existingBorrow) {
          throw new ApiError(404, "This borrow record could not be found.");
        }

        throw new ApiError(409, "This book has already been returned.");
      }

      if (!/^[a-f\d]{24}$/i.test(activeBorrow.bookId)) {
        throw new Error("The borrow record contains an invalid book id.");
      }

      const bookResult = await books.updateOne(
        {
          _id: new ObjectId(activeBorrow.bookId),
          $expr: { $lt: ["$availableCopies", "$totalCopies"] },
        },
        {
          $inc: { availableCopies: 1 },
          $set: { updatedAt: returnedAt },
        },
        { session },
      );

      if (bookResult.matchedCount !== 1) {
        throw new ApiError(
          409,
          "The available copy count could not be updated.",
        );
      }

      returnedBorrow = {
        ...activeBorrow,
        status: "returned",
        returnedAt,
      };
    });

    if (!returnedBorrow) {
      throw new Error("The return transaction did not return a borrow record.");
    }

    response.status(200).json({
      message: "Book returned successfully.",
      borrow: toPublicBorrow(returnedBorrow),
    });
  } catch (error) {
    sendError(response, error, "The book could not be returned.");
  } finally {
    await closeSession(session);
  }
};
