# 🔧 Quick Fix for Login Server Error

## Problem
Getting "Server error" when trying to login? This is caused by invalid database credentials in your `.env` file.

## Solution (Choose One)

### Option 1: Automated Setup (Easiest) ⭐

```bash
cd backend
npm run setup
```

Follow the prompts to configure your database. The script will:
- ✅ Check PostgreSQL installation
- ✅ Create the database
- ✅ Update your .env file
- ✅ Seed sample data

### Option 2: Quick Manual Fix

1. **Find your PostgreSQL password** (the one you set during installation)

2. **Edit `backend/.env`** and update this line:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/atom_fitness_db
   ```
   Replace `YOUR_PASSWORD_HERE` with your actual PostgreSQL password.

3. **Create the database:**
   ```bash
   psql -U postgres -c "CREATE DATABASE atom_fitness_db;"
   ```
   Enter your PostgreSQL password when prompted.

4. **Seed the database:**
   ```bash
   cd backend
   node seed.js
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

## Test the Fix

1. Start the backend: `cd backend && npm start`
2. Start the frontend: `cd frontend && npm start`
3. Open http://localhost:3000
4. Login with: **admin@atom-fitness.com** / **Admin@123**

## Still Having Issues?

Check the detailed guide: [SETUP.md](SETUP.md)

### Common Error Messages:

- **"Database connection failed"** → PostgreSQL is not running
  ```bash
  # Windows
  net start postgresql-x64-18
  ```

- **"Database does not exist"** → Run: `psql -U postgres -c "CREATE DATABASE atom_fitness_db;"`

- **"Database authentication failed"** → Wrong password in .env file

- **"Database tables not found"** → Run: `node seed.js`

---

Need more help? See the full [SETUP.md](SETUP.md) guide.
