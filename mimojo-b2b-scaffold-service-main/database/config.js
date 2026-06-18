require('dotenv').config();
const env = process.env.NODE_ENV || 'development';
exports[env] = {
  dialect: process.env.DB_DIALECT,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
};
