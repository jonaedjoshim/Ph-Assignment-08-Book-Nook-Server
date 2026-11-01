import type { ObjectId } from "mongodb";

export const BOOK_CATEGORIES = [
  "Fiction",
  "Science",
  "History",
  "Kids",
  "Others",
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export interface BookCreator {
  userId: string;
  name: string;
  email: string;
}

export interface BookDocument {
  title: string;
  author: string;
  category: BookCategory;
  imageUrl: string;
  description: string;
  totalCopies: number;
  availableCopies: number;
  createdBy: BookCreator;
  createdAt: Date;
  updatedAt: Date;
}

export type BorrowStatus = "active" | "returned";

export interface BorrowDocument {
  bookId: ObjectId;
  bookTitle: string;
  bookImageUrl: string;
  userId: string;
  userName: string;
  userEmail: string;
  borrowedAt: Date;
  dueAt: Date;
  status: BorrowStatus;
  returnedAt: Date | null;
}
