import bcrypt from 'bcryptjs';

// Usage: pnpm --filter site admin:hash-password 'your password'
// Paste the output into ADMIN_PASSWORD_HASH. It is base64 so `$` survives .env expansion.
const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Give a password of at least 10 characters.');
  process.exit(1);
}
console.info(Buffer.from(bcrypt.hashSync(password, 12)).toString('base64'));
