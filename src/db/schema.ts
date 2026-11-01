import type { Document } from "mongodb";

import { BOOK_CATEGORIES } from "../types/book.js";

export const booksJsonSchema: Document = {
  bsonType: "object",
  required: [
    "_id",
    "title",
    "author",
    "category",
    "imageUrl",
    "description",
    "totalCopies",
    "availableCopies",
    "createdBy",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    _id: {
      bsonType: "objectId",
    },
    title: {
      bsonType: "string",
      minLength: 1,
      maxLength: 120,
    },
    author: {
      bsonType: "string",
      minLength: 1,
      maxLength: 100,
    },
    category: {
      bsonType: "string",
      enum: [...BOOK_CATEGORIES],
    },
    imageUrl: {
      bsonType: "string",
      minLength: 1,
    },
    description: {
      bsonType: "string",
      minLength: 1,
      maxLength: 1000,
    },
    totalCopies: {
      bsonType: "int",
      minimum: 1,
      maximum: 10000,
    },
    availableCopies: {
      bsonType: "int",
      minimum: 0,
      maximum: 10000,
    },
    createdBy: {
      bsonType: "object",
      required: ["userId", "name", "email"],
      additionalProperties: false,
      properties: {
        userId: {
          bsonType: "string",
          minLength: 1,
        },
        name: {
          bsonType: "string",
          minLength: 1,
        },
        email: {
          bsonType: "string",
          minLength: 1,
        },
      },
    },
    createdAt: {
      bsonType: "date",
    },
    updatedAt: {
      bsonType: "date",
    },
  },
};

export const borrowsJsonSchema: Document = {
  bsonType: "object",
  required: [
    "_id",
    "bookId",
    "bookTitle",
    "bookImageUrl",
    "userId",
    "userName",
    "userEmail",
    "borrowedAt",
    "dueAt",
    "status",
    "returnedAt",
  ],
  additionalProperties: false,
  properties: {
    _id: {
      bsonType: "objectId",
    },
    bookId: {
      bsonType: "objectId",
    },
    bookTitle: {
      bsonType: "string",
      minLength: 1,
    },
    bookImageUrl: {
      bsonType: "string",
      minLength: 1,
    },
    userId: {
      bsonType: "string",
      minLength: 1,
    },
    userName: {
      bsonType: "string",
      minLength: 1,
    },
    userEmail: {
      bsonType: "string",
      minLength: 1,
    },
    borrowedAt: {
      bsonType: "date",
    },
    dueAt: {
      bsonType: "date",
    },
    status: {
      bsonType: "string",
      enum: ["active", "returned"],
    },
    returnedAt: {
      bsonType: ["date", "null"],
    },
  },
};
