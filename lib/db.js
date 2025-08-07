import mongoose from 'mongoose';

let cachedPromise = null;

export default async function connectDB() {
  if (cachedPromise) return cachedPromise;
  cachedPromise = mongoose
    .connect(process.env.MONGO_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => console.log('MongoDB connected'))
    .catch((e) => {
      console.error('Mongo connect error:', e);
      process.exit(1);
    });

  return cachedPromise;
}
