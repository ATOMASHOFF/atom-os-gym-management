# 🏋️ ATOM FITNESS - Setup Guide

## Quick Fix for Login Error

If you're experiencing a **"Server error"** during login, it's likely due to database configuration issues. Follow these steps:

### Option 1: Automated Setup (Recommended)

Run the automated setup script:

```bash
cd backend
node setup-database.js
```

This will:
- Check if PostgreSQL is installed
- Guide you through database configuration
- Create the database
- Update your `.env` file
- Seed the database with sample data

### Option 2: Manual Setup

#### Step 1: Create the Database

Open your PostgreSQL terminal (psql) and run:

```sql
CREATE DATABASE atom_fitness_db;
```

Or use the command line:

```bash
psql -U postgres -c "CREATE DATABASE atom_fitness_db;"
```

#### Step 2: Update .env File

Edit `backend/.env` and update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/atom_fitness_db
```

Replace:
- `postgres` with your PostgreSQL username
- `YOUR_PASSWORD` with your PostgreSQL password
- `localhost` with your database host (if different)
- `5432` with your PostgreSQL port (if different)
- `atom_fitness_db` with your database name (if different)

#### Step 3: Seed the Database

Run the seed script to create tables and sample data:

```bash
cd backend
npm install
node seed.js
```

#### Step 4: Start the Server

```bash
npm start
```

## Default Login Credentials

After seeding, you can login with:

### Admin Account
- **Email:** admin@atom-fitness.com
- **Password:** Admin@123

### Staff Account
- **Email:** staff@atom-fitness.com
- **Password:** Staff@123

### Member Account
- **Email:** member1@atom-fitness.com
- **Password:** Member@123

## Common Issues

### Issue: "Database connection failed"
**Solution:** Make sure PostgreSQL is running:
```bash
# Windows
net start postgresql-x64-18

# Linux/Mac
sudo service postgresql start
```

### Issue: "Database does not exist"
**Solution:** Create the database using Step 1 above.

### Issue: "Database authentication failed"
**Solution:** Check your PostgreSQL credentials in the `.env` file.

### Issue: "Database tables not found"
**Solution:** Run the seed script: `node seed.js`

## Full Installation Guide

### Prerequisites

1. **Node.js** (v14 or higher)
2. **PostgreSQL** (v12 or higher)
3. **npm** or **yarn**

### Backend Setup

```bash
cd backend
npm install
node setup-database.js  # Follow the prompts
npm start
```

The backend will run on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000`

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/atom_fitness_db
JWT_SECRET=your_super_secret_jwt_key_minimum_64_characters_long_change_this
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Troubleshooting

### Check Database Connection

Test your database connection:

```bash
psql -U postgres -d atom_fitness_db -c "SELECT version();"
```

### View Server Logs

The backend logs will show specific error codes:
- `ECONNREFUSED` - PostgreSQL is not running
- `3D000` - Database doesn't exist
- `28P01` - Wrong password
- `42P01` - Tables not created

### Reset Database

To start fresh:

```bash
cd backend
psql -U postgres -c "DROP DATABASE IF EXISTS atom_fitness_db;"
psql -U postgres -c "CREATE DATABASE atom_fitness_db;"
node seed.js
```

## Need Help?

If you're still experiencing issues:

1. Check the backend console for detailed error messages
2. Verify PostgreSQL is running: `psql --version`
3. Test database connection with the credentials in your `.env` file
4. Make sure all dependencies are installed: `npm install`

## Production Deployment

For production deployment, make sure to:

1. Use a strong `JWT_SECRET` (minimum 64 characters)
2. Set `NODE_ENV=production`
3. Use a secure database connection (SSL enabled)
4. Update `FRONTEND_URL` to your production domain
5. Never commit `.env` files to version control

---

**ATOM FITNESS** - Gym Management OS
Developed by MAHNWAS TECHNOLOGIES
