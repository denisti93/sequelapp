import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { hashPassword } from '../utils/password.js';

async function run() {
  const [, , nameArg, usernameArg, passwordArg] = process.argv;

  const name = nameArg || 'Administrador';
  const username = usernameArg || 'admin';
  const password = passwordArg || 'admin123';

  if (password.length < 6) {
    throw new Error('A senha do ADM precisa ter no minimo 6 caracteres.');
  }

  await mongoose.connect(env.mongoUri);

  const passwordHash = await hashPassword(password);

  await User.findOneAndUpdate(
    { username },
    {
      $set: {
        name,
        username,
        passwordHash,
        role: 'ADM',
        approvalStatus: 'APPROVED',
        initialRating: 3,
        ratingAverage: 3
      }
    },
    { upsert: true, new: true }
  );

  // eslint-disable-next-line no-console
  console.log(`ADM pronto: username=${username}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
