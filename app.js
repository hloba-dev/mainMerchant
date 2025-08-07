import 'dotenv/config';
import express from 'express';

import mongoose from 'mongoose';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser'; 

import authRoutes from './routes/auth.js';

import apiRoutes from './routes/api.js';
import apiAdminRoutes from './routes/apiAdmin.js';
import notFound from './middlewares/notFound.js';
import errorHandler from './middlewares/errorHandler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(
  cors({
    origin: [
      'https://best.moneycame.com',
      'https://qw298ewr1902w24.moneycame.biz',
       ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    credentials: true, 
  })
);


app.use(cookieParser()); // Use cookie-parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error(err));

// app.use('/', authRoutes); // Auth routes were for EJS login
app.use('/api', apiRoutes);
// app.use('/irishkachikipiki7843', adminRoutes); // Disabling old admin
app.use('/admin', apiAdminRoutes);


app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
