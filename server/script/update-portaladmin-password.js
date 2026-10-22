import bcrypt from "bcryptjs";
import { pool } from '../db.js';
import { findByEmail, verifyPassword } from '../src/services/userStore.js';
import fs from "fs/promises";
import path from "path";
async function main() {
  const email = "portaladmin@gmail.com";
  const newPassword = "123456";
  console.log(`Searching for user ${email}...`);
  const user = await findByEmail(email);
  if (!user) {
    console.log(`User ${email} not found via userStore. Checking DB directly...`);
  } else {
    console.log(`Found user:`, { id: user.id, email: user.email, role: user.role, status: user.status });
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  if (pool) {
    const res = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (res.rows.length > 0) {
      const dbUser = res.rows[0];
      console.log(`Found in PostgreSQL users table with ID ${dbUser.id}. Updating password...`);
      await pool.query("UPDATE users SET password_hash = $1, status = $2 WHERE id = $3", [hashedPassword, "active", dbUser.id]);
      console.log(`PostgreSQL password updated.`);
    } else {
      console.log(`User not found in PostgreSQL. Creating user...`);
      const insertRes = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email, role`,
        ["Portal Admin", email, hashedPassword, "portal_admin", "active"]
      );
      console.log(`Created user in DB:`, insertRes.rows[0]);
    }
  }
  const usersJsonPath = path.resolve(process.cwd(), "users.json");
  try {
    let jsonUsers = [];
    try {
      const raw = await fs.readFile(usersJsonPath, "utf8");
      jsonUsers = JSON.parse(raw);
    } catch (e) {
      jsonUsers = [];
    }
    const jsonIdx = jsonUsers.findIndex((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (jsonIdx !== -1) {
      jsonUsers[jsonIdx].password = hashedPassword;
      jsonUsers[jsonIdx].status = "active";
      console.log(`Updated user in users.json`);
    } else {
      const maxId = jsonUsers.reduce((m, u) => Math.max(m, u.id || 0), 0);
      jsonUsers.push({
        id: maxId + 1,
        name: "Portal Admin",
        email,
        role: "portal_admin",
        password: hashedPassword,
        status: "active",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      console.log(`Added user to users.json`);
    }
    await fs.writeFile(usersJsonPath, JSON.stringify(jsonUsers, null, 2), "utf8");
  } catch (err) {
    console.error("Error updating users.json:", err);
  }
  console.log("--- Verifying login with updated password ---");
  const verifiedUser = await findByEmail(email);
  if (!verifiedUser) {
    throw new Error("Verification failed: User not found after update!");
  }
  const isMatch = await verifyPassword(verifiedUser, newPassword);
  console.log("Password verification result:", isMatch ? "SUCCESS (Password matches!)" : "FAILED");
  if (!isMatch) {
    throw new Error("Verification failed: Password does not match!");
  }
  console.log("User details after update:", {
    id: verifiedUser.id,
    name: verifiedUser.name,
    email: verifiedUser.email,
    role: verifiedUser.role,
    status: verifiedUser.status
  });
  process.exit(0);
}
main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
