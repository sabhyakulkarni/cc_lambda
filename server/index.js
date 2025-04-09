require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./configuration/db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // ✅ Moved this here, before any routes

// Sample test route
app.get("/", (req, res) => {
  res.send("🚀 Serverless Function Platform Backend is Running!");
});

// Check DB connection with a test route
app.get("/test-db", (req, res) => {
  db.query("SELECT 1", (err, result) => {
    if (err) {
      res.status(500).send("Database connection failed");
    } else {
      res.send("✅ Database is connected and responding");
    }
  });
});

//create
app.post("/submit-function", (req, res) => {
  const { title, description, code, route, language, timeout } = req.body;

  if (!title || !code || !route || !language || !timeout) {
    return res
      .status(400)
      .json({ message: "Missing required metadata fields" });
  }

  const sql = `
      INSERT INTO functions (title, description, code, route, language, timeout)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
  db.query(
    sql,
    [title, description, code, route, language, timeout],
    (err, result) => {
      if (err) {
        console.error("❌ Error inserting function:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(201).json({
        message: "✅ Function with metadata submitted successfully",
        functionId: result.insertId,
      });
    }
  );
});

//list all
app.get("/functions", (req, res) => {
  const sql = "SELECT * FROM functions";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching functions:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json(results);
  });
});

//view one
app.get("/functions/:id", (req, res) => {
  const functionId = req.params.id;
  const sql = "SELECT * FROM functions WHERE id = ?";
  db.query(sql, [functionId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ message: "Function not found" });
    }
    res.status(200).json(results[0]);
  });
});

//delete
app.delete("/functions/:id", (req, res) => {
  const functionId = req.params.id;
  const sql = "DELETE FROM functions WHERE id = ?";
  db.query(sql, [functionId], (err, result) => {
    if (err) {
      console.error("❌ Error deleting function:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json({ message: "🗑️ Function deleted successfully" });
  });
});

//update
app.put("/functions/:id", (req, res) => {
  const functionId = req.params.id;
  const { title, description, code } = req.body;

  const sql =
    "UPDATE functions SET title = ?, description = ?, code = ? WHERE id = ?";
  db.query(sql, [title, description, code, functionId], (err, result) => {
    if (err) {
      console.error("❌ Error updating function:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(200).json({ message: "✏️ Function updated successfully" });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
