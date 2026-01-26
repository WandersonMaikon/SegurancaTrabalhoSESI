const mysql = require('mysql2');
require('dotenv').config();

// conexões 
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'maikon123',
    database: process.env.DB_NAME || 'seguranca_trabalho',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exporta a Promises (permite usar await)
module.exports = pool.promise();