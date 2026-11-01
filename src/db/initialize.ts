import type { Db, Document } from "mongodb";

import { borrowsJsonSchema, booksJsonSchema } from "./schema.js";

export const BOOKS_COLLECTION = "books";
export const BORROWS_COLLECTION = "borrows";

async function createCollectionIfMissing(
  database: Db,
  name: string,
  jsonSchema: Document,
) {
  const existingCollections = await database
    .listCollections({ name }, { nameOnly: true })
    .toArray();

  if (existingCollections.length > 0) {
    return;
  }

  await database.createCollection(name, {
    validator: {
      $jsonSchema: jsonSchema,
    },
    validationLevel: "strict",
    validationAction: "error",
  });
}

export async function initializeDatabase(database: Db) {
  await createCollectionIfMissing(database, BOOKS_COLLECTION, booksJsonSchema);

  await createCollectionIfMissing(
    database,
    BORROWS_COLLECTION,
    borrowsJsonSchema,
  );

  await database.collection(BOOKS_COLLECTION).createIndexes([
    {
      key: { createdAt: -1 },
      name: "books_created_at_desc",
    },
    {
      key: { category: 1, createdAt: -1 },
      name: "books_category_created_at",
    },
    {
      key: { "createdBy.userId": 1, createdAt: -1 },
      name: "books_owner_created_at",
    },
    {
      key: {
        title: "text",
        author: "text",
        description: "text",
      },
      name: "books_text_search",
    },
  ]);

  await database.collection(BORROWS_COLLECTION).createIndexes([
    {
      key: { userId: 1, bookId: 1 },
      name: "active_borrow_user_book_unique",
      unique: true,
      partialFilterExpression: {
        status: "active",
      },
    },
    {
      key: { userId: 1, borrowedAt: -1 },
      name: "borrow_user_date",
    },
    {
      key: { bookId: 1, status: 1 },
      name: "borrow_book_status",
    },
  ]);

  console.log("BookNook collections, validators, and indexes are ready.");
}
