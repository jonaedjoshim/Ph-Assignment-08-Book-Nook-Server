# BookNook Server

The BookNook Server is the Express and MongoDB API for the BookNook online library. It manages books, copy availability, borrowing records, and returns. Protected operations validate JWTs issued by Better Auth.

## Live API

**API base URL:**  
[https://book-nook-server-gz2l.onrender.com](https://book-nook-server-gz2l.onrender.com)

**Browse books:**  
[GET /books](https://book-nook-server-gz2l.onrender.com/books)

The free Render instance may sleep while inactive, so its first request after a period of inactivity can take longer.

## Features

- MongoDB-backed book and borrow collections.
- JSON Schema validation and indexes initialized for the library collections.
- JWT validation for protected API operations.
- Ownership checks for updating and deleting books.
- MongoDB transactions for borrowing and returning books.
- Atomic copy updates when a book is borrowed or returned.
- Seven-day borrowing period.
- Duplicate active borrow protection.
- Borrow records retain returned-book history.

## Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB Node.js Driver
- Better Auth JWT verification with `jose`
- Zod

## API Routes

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/books` | Public | List books; supports search, category, and pagination |
| `GET` | `/books/:id` | Public | Get one book by its ID |
| `POST` | `/books` | JWT required | Add a book; the Server derives the creator from the verified token |
| `PATCH` | `/books/:id` | JWT required; owner only | Update a book you added |
| `DELETE` | `/books/:id` | JWT required; owner only | Delete a book when it has no active borrows |
| `POST` | `/borrows` | JWT required | Borrow an available book |
| `GET` | `/borrows` | JWT required | Get the signed-in user's borrowing history |
| `DELETE` | `/borrows/:id` | JWT required; owner only | Return a borrowed book |

### Book List Options

`GET /books` supports these query parameters:

- `search` — search books by title or author
- `category` — filter by category
- `page` — page number
- `limit` — maximum books per page
- `mine=true` — return books belonging to the authenticated user; requires a valid JWT

### Add a Book

Send the book details in the request body. The book creator's identity is taken from the verified JWT.

```json
{
  "title": "The Hobbit",
  "author": "J. R. R. Tolkien",
  "category": "Fiction",
  "imageUrl": "https://example.com/book-cover.jpg",
  "description": "A quiet life changes when a journey begins.",
  "totalCopies": 3
}
```

The Server initializes the available copy count from `totalCopies`.

### Borrow a Book

Send the book's MongoDB ID:

```json
{
  "bookId": "YOUR_BOOK_OBJECT_ID"
}
```

The authenticated user's identity comes from the JWT. The Server sets the borrowing date and the due date, seven days later.

### Return a Book

`DELETE /borrows/:id` marks the borrow as returned and restores an available copy. It preserves the borrow record as history.

## Authentication and Data Integrity

Protected routes require a valid Better Auth JWT in the `Authorization: Bearer <token>` header. The Server verifies tokens using Better Auth's JWKS endpoint.

Borrow and return operations use MongoDB transactions so that changes to the book's copy count and borrow record succeed or fail together. MongoDB transactions require a replica-set deployment; MongoDB Atlas supports replica sets.

A database index prevents the same user from having multiple active borrows for the same book.

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the Server project root and configure the required values:

   - `PORT` — local development port, normally `5000`
   - `CLIENT_URL` — Client origin allowed to call the API
   - `MONGODB_URI` — MongoDB connection string
   - `DB_NAME` — database name, normally `booknook`
   - `DNS_SERVERS` — comma-separated DNS resolver addresses, if configured
   - `BETTER_AUTH_URL` — base URL of the Better Auth application

   Never commit the `.env` file or share its secret values.

3. Start the development server:

   ```bash
   npm run dev
   ```

The local API runs at `http://localhost:5000`.

## Build and Start

```bash
npm run build
npm start
```

The production start script runs the compiled Server from `dist/server.js`.

## Deployment

The API is deployed as a Render Web Service. Configure the environment variables in the Render dashboard rather than committing secrets.

Render assigns the production `PORT` value automatically. Set `CLIENT_URL` and `BETTER_AUTH_URL` to the production Client origin.

## Security

- Never commit `.env`, database credentials, authentication secrets, or JWTs.
- Do not trust user identity sent in a request body; protected operations use the verified JWT identity.
- Book updates and deletion are restricted to the book's owner.
