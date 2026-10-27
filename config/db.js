import mysql2 from 'mysql2/promise';
import 'dotenv/config';
import { createPool } from 'mysql2';

const db = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306
});
export default db;