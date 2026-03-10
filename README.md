# Photo Billing App

React Native (Expo) frontend for the Photo Billing API, with a Node.js (Express) backend and MySQL database.

## UI ↔ Backend connection

- **Login / Register** → `POST /api/auth/login`, `POST /api/auth/register` → JWT stored in AsyncStorage and sent in `Authorization` header on every request.
- **Home (Photo Billing)** → Capture photo → `POST /api/upload/image` → Edit items → `POST /api/bills` → Backend updates inventory and cashflow.
- **Inventory** → `GET /api/products`, `PUT /api/products/:id`, `POST /api/products`.
- **Cashflow** → `GET /api/cashflow` (summary + entries).
- **Account & Analytics** → `GET /api/analytics`.

Set the API base URL with `EXPO_PUBLIC_API_URL` (e.g. `http://localhost:4000` or your machine IP when using a device). Default is `http://localhost:4000`.

---

## How to run

### 1. Backend (Node.js + MySQL)

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `backend/.env` with your MySQL credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) and optionally `JWT_SECRET`, `PORT` (default `4000`).

3. **Create the database**
   ```bash
   mysql -u root -p < backend/database/schema.sql
   ```
   (Or run `schema.sql` in MySQL Workbench / your MySQL client.)

4. **Seed demo data (optional)**
   ```bash
   node backend/database/seed.js
   ```
   Demo user: **demo@example.com** / **demo123**

5. **Start the API**
   ```bash
   cd backend
   npm run dev
   ```
   API runs at **http://localhost:4000**

### 2. Frontend (Expo / React Native)

1. **From the project root**, install dependencies (if not already):
   ```bash
   npm install
   ```

2. **Start the app**
   ```bash
   npx expo start
   ```
   Then press **w** for web, **a** for Android, or **i** for iOS simulator.

3. **Using a physical device?**  
   Set the backend URL to your machine’s IP so the app can reach the API:
   ```bash
   set EXPO_PUBLIC_API_URL=http://192.168.1.XXX:4000
   npx expo start
   ```
   (Replace `192.168.1.XXX` with your computer’s LAN IP. On Windows use `set`, on macOS/Linux use `export`.)

### Quick checklist

| Step | Command / action |
|------|------------------|
| Backend deps | `cd backend && npm install` |
| Backend env | `cp backend/.env.example backend/.env` and edit |
| Database | Run `backend/database/schema.sql` in MySQL |
| Seed (optional) | `node backend/database/seed.js` |
| Start API | `cd backend && npm run dev` |
| Frontend deps | `npm install` (in project root) |
| Start app | `npx expo start` |

---

## Get started (Expo)

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
