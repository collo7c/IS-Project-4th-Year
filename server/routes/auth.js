const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/init");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/register  (use case: Register and Login)
router.post("/register", (req, res) => {
  const { name, email, password, role, schoolId, tscNumber, department } = req.body;
  if (!name || !email || !password || !role || !schoolId) {
    return res.status(400).json({ error: "name, email, password, role and schoolId are required" });
  }
  if (!["teacher", "administrator"].includes(role)) {
    return res.status(400).json({ error: "role must be 'teacher' or 'administrator'" });
  }

  const existing = db.prepare("SELECT UserID FROM User WHERE Email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const hash = bcrypt.hashSync(password, 10);
  const insertUser = db.prepare(
    "INSERT INTO User (Name, Email, PasswordHash, Role, SchoolID) VALUES (?, ?, ?, ?, ?)"
  );
  const userId = insertUser.run(name, email, hash, role, schoolId).lastInsertRowid;

  if (role === "teacher") {
    db.prepare("INSERT INTO Teacher (UserID, TSCNumber) VALUES (?, ?)").run(userId, tscNumber || null);
  } else {
    db.prepare("INSERT INTO Administrator (UserID, Department) VALUES (?, ?)").run(userId, department || null);
  }

  res.status(201).json({ message: "Registered successfully", userId });
});

// POST /api/auth/login  (use case: Register and Login)
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM User WHERE Email = ?").get(email);
  if (!user || !bcrypt.compareSync(password || "", user.PasswordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = jwt.sign(
    { userId: user.UserID, role: user.Role, schoolId: user.SchoolID, name: user.Name },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({
    token,
    user: { userId: user.UserID, name: user.Name, role: user.Role, schoolId: user.SchoolID },
  });
});

module.exports = router;
