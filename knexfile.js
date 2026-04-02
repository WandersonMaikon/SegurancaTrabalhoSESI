// knexfile.js
require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'maikon123', // <-- A sua senha correta aqui!
      database: process.env.DB_NAME || 'seguranca_trabalho'
    },
    migrations: {
      directory: './src/database/migrations' // <-- Apontando para dentro da pasta src
    }
  }
};