#!/usr/bin/env node
/**
 * Database Setup Script for ATOM FITNESS
 * This script helps you set up the PostgreSQL database
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n🏋️  ATOM FITNESS - Database Setup\n');
  console.log('This script will help you configure your PostgreSQL database.\n');

  try {
    // Check if PostgreSQL is installed
    try {
      execSync('psql --version', { stdio: 'ignore' });
      console.log('✅ PostgreSQL is installed\n');
    } catch (err) {
      console.error('❌ PostgreSQL is not installed or not in PATH');
      console.error('Please install PostgreSQL from: https://www.postgresql.org/download/\n');
      process.exit(1);
    }

    // Get database configuration
    console.log('Please provide your PostgreSQL configuration:\n');
    
    const dbHost = await question('Database Host (default: localhost): ') || 'localhost';
    const dbPort = await question('Database Port (default: 5432): ') || '5432';
    const dbUser = await question('Database User (default: postgres): ') || 'postgres';
    const dbPassword = await question('Database Password: ');
    const dbName = await question('Database Name (default: atom_fitness_db): ') || 'atom_fitness_db';

    console.log('\n📝 Configuration Summary:');
    console.log(`   Host: ${dbHost}`);
    console.log(`   Port: ${dbPort}`);
    console.log(`   User: ${dbUser}`);
    console.log(`   Database: ${dbName}\n`);

    const confirm = await question('Proceed with this configuration? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      process.exit(0);
    }

    // Create database
    console.log('\n🔨 Creating database...');
    try {
      const createDbCmd = `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -c "CREATE DATABASE ${dbName};"`;
      execSync(createDbCmd, { 
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: dbPassword }
      });
      console.log('✅ Database created successfully');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Database already exists, continuing...');
      } else {
        console.error('❌ Failed to create database:', err.message);
        process.exit(1);
      }
    }

    // Update .env file
    console.log('\n📝 Updating .env file...');
    const envPath = path.join(__dirname, '.env');
    const databaseUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /DATABASE_URL=.*/,
        `DATABASE_URL=${databaseUrl}`
      );
    } else {
      // Create from example
      const examplePath = path.join(__dirname, '.env.example');
      if (fs.existsSync(examplePath)) {
        envContent = fs.readFileSync(examplePath, 'utf8');
        envContent = envContent.replace(
          /DATABASE_URL=.*/,
          `DATABASE_URL=${databaseUrl}`
        );
      }
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file updated');

    // Run seed script
    console.log('\n🌱 Running seed script...');
    const runSeed = await question('Do you want to seed the database with sample data? (y/n): ');
    
    if (runSeed.toLowerCase() === 'y') {
      try {
        execSync('node seed.js', { 
          stdio: 'inherit',
          cwd: __dirname,
          env: { ...process.env, DATABASE_URL: databaseUrl }
        });
        console.log('\n✅ Database seeded successfully!');
      } catch (err) {
        console.error('❌ Failed to seed database:', err.message);
        process.exit(1);
      }
    }

    console.log('\n🎉 Setup complete!\n');
    console.log('You can now start the server with: npm start\n');
    console.log('Default login credentials:');
    console.log('  Admin: admin@atom-fitness.com / Admin@123');
    console.log('  Staff: staff@atom-fitness.com / Staff@123');
    console.log('  Member: member1@atom-fitness.com / Member@123\n');

  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

setup();
