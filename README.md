# Virtual-Classroom-Full-Stack

````markdown
# Project Setup Guide

## Overview

This project consists of a **backend** server and a **frontend** client application. Prisma is used for database management in the backend. Follow the steps below to set up and run the project successfully.

---

## A. Start Server (Backend)

1. **Open Visual Studio Code** (or your preferred code editor).
2. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
````

3. Install required dependencies:
   ```bash
   npm install
   ```
4. Open the `.env` file and set up your **environment variables**. Example:
   ```plaintext
   PORT=5000
   DATABASE_URL=postgresql://username:password@localhost:5432/database
   JWT_SECRET=your-jwt-secret
   ```
5. **Set up Prisma:**
   - Install Prisma dependencies:
     ```bash
     npm install prisma @prisma/client
     ```
   - Initialize Prisma:
     ```bash
     npx prisma init
     ```
   - Define your database schema in the `prisma/schema.prisma` file.
   - Run the migrations to create the tables:
     ```bash
     npx prisma migrate dev
     ```
6. Start the backend server:
   ```bash
   npm run dev
   ```

---

## B. Start Client Side (Frontend)

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install required dependencies:
   ```bash
   npm install
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   ```

---

## Notes:

- Ensure **Node.js** is installed before running the project ([Download Node.js](https://nodejs.org)).
- Verify backend connectivity by testing endpoints (e.g., `/api` routes).
- Use `.env` files to securely store environment variables for backend services.
- Both servers are expected to run locally:
  - **Backend**: `http://localhost:5000`
  - **Frontend**: `http://localhost:8081` (or another port as specified by Vite).
- After running Prisma migrations, use Prisma Studio to explore your database:
  ```bash
  npx prisma studio
  ```

---

## Contributing

Feel free to contribute to this project by creating pull requests or reporting issues.

---

## License

This project is open-source and uses the [MIT License](https://opensource.org/licenses/MIT).

---

Happy coding! 🚀

```

This version includes the steps for setting up Prisma migrations as part of the backend configuration. Let me know if you need further details or refinements! 😊
```
