require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./configuration/db");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); //  Moved this here, before any routes

// Sample test route
app.get("/", (req, res) => {
  res.send(" Serverless Function Platform Backend is Running!");
});

// 1. Define warmUp at the top of your file (after imports)
const warmUp = () => {
  const langs = ["python", "node"];

  langs.forEach((lang) => {
    const dockerfilePath = path.resolve(
      __dirname,
      "docker",
      `DockerFile.${lang}`
    );
    const imageTag = `func-${lang}-image`;
    const buildCommand = `docker build -f "${dockerfilePath}" -t ${imageTag} "${__dirname}"`;

    exec(buildCommand, (err, stdout, stderr) => {
      if (err) {
        console.error(`⚠️ Warm-up failed for ${lang}:`, stderr || err.message);
      } else {
        console.log(` ${lang.toUpperCase()} container warmed up!`);
      }
    });
  });
};

const warmPool = () => {
  const poolSize = 2;
  const languages = ["python", "node"];

  languages.forEach((lang) => {
    const imageTag = `func-${lang}-image`;

    for (let i = 1; i <= poolSize; i++) {
      const containerName = `pool_${lang}_${i}`;
      const runCommand = `docker run -dit --name ${containerName} ${imageTag} tail -f /dev/null`;

      exec(runCommand, (err, stdout, stderr) => {
        if (err) {
          if (stderr.includes("is already in use")) {
            console.log(`🔁 Container ${containerName} already exists`);
          } else {
            console.error(
              `❌ Failed to start ${containerName}:`,
              stderr || err.message
            );
          }
        } else {
          console.log(`🧱 Started container ${containerName}`);
        }
      });
    }
  });
};

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

//execute

// app.post("/execute", (req, res) => {
//   const { functionId, runtime } = req.body;

//   if (!functionId) {
//     return res
//       .status(400)
//       .json({ success: false, error: "Function ID is required" });
//   }

//   const sql = "SELECT * FROM functions WHERE id = ?";
//   db.query(sql, [functionId], (err, results) => {
//     try {
//       if (err || results.length === 0) {
//         return res
//           .status(404)
//           .json({ success: false, error: "Function not found" });
//       }

//       const func = results[0];

//       if (!func.language || !func.code) {
//         return res
//           .status(400)
//           .json({ success: false, error: "Missing language or code" });
//       }

//       const ext = func.language === "python" ? "py" : "js";
//       const execDir = path.join(__dirname, "executions");
//       const filePath = path.join(execDir, `function.${ext}`);

//       // Ensure executions folder exists
//       if (!fs.existsSync(execDir)) {
//         fs.mkdirSync(execDir);
//       }

//       // Write the function code to a file
//       fs.writeFileSync(filePath, func.code);

//       const langMap = {
//         js: "node",
//         javascript: "node",
//         python: "python",
//       };

//       const language = langMap[func.language.toLowerCase()];
//       if (!language) {
//         return res
//           .status(400)
//           .json({ success: false, error: "Unsupported language" });
//       }

//       const imageTag = `func-${language}-image`;
//       const dockerfilePath = path.resolve(
//         __dirname,
//         "docker",
//         `DockerFile.${language}`
//       );
//       const buildCommand = `docker build -f "${dockerfilePath}" -t ${imageTag} "${__dirname}"`;

//       // Build Docker image
//       exec(buildCommand, (err, stdout, stderr) => {
//         if (err) {
//           console.error(" Docker build failed:\n", stderr || err.message);
//           return res
//             .status(500)
//             .json({ success: false, error: "Docker build failed" });
//         }

//         console.log("Docker build output:\n", stdout);

//         const dockerRuntime = runtime === "gvisor" ? "--runtime=runsc" : "";
//         const runCommand = `docker run --rm ${dockerRuntime} ${imageTag}`;

//         const start = Date.now();

//         exec(runCommand, (err, stdout, stderr) => {
//           const duration = Date.now() - start;

//           if (err) {
//             return res.status(500).json({
//               success: false,
//               error: stderr || err.message,
//               duration: `${duration}ms`,
//             });
//           }

//           res.json({
//             success: true,
//             output: stdout,
//             duration: `${duration}ms`,
//           });
//         });

//         const duration = Date.now() - start;
//         const success = !err;
//         const errorMessage = err ? stderr || err.message : null;

//         const insertMetric = `
//   INSERT INTO metrics (function_id, language, runtime, duration_ms, success, error_message)
//   VALUES (?, ?, ?, ?, ?, ?)
// `;

//         db.query(
//           insertMetric,
//           [
//             functionId,
//             func.language,
//             runtime || "default",
//             duration,
//             success,
//             errorMessage,
//           ],
//           (err) => {
//             if (err) console.error("❌ Failed to insert metric:", err);
//           }
//         );

//         exec(runCommand, (err, stdout, stderr) => {
//           const duration = Date.now() - start;

//           if (err) {
//             return res.status(500).json({
//               success: false,
//               error: stderr || err.message,
//               duration: `${duration}ms`,
//             }); // ✅ return added
//           }

//           return res.json({
//             success: true,
//             functionId: functionId,
//             language: func.language,
//             output: stdout,
//             duration: `${duration}ms`,
//           }); // ✅ return added
//         });
//       });
//     } catch (error) {
//       console.error(" Unexpected error in /execute:", error.message);
//       return res.status(500).json({ success: false, error: error.message });
//     }
//   });
// });

app.post("/execute", (req, res) => {
  const { functionId, runtime } = req.body;

  if (!functionId) {
    return res
      .status(400)
      .json({ success: false, error: "Function ID is required" });
  }

  const sql = "SELECT * FROM functions WHERE id = ?";
  db.query(sql, [functionId], (err, results) => {
    if (err || results.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Function not found" });
    }

    const func = results[0];

    if (!func.language || !func.code) {
      return res
        .status(400)
        .json({ success: false, error: "Missing language or code" });
    }

    const ext = func.language === "python" ? "py" : "js";
    const execDir = path.join(__dirname, "executions");
    const filePath = path.join(execDir, `function.${ext}`);

    if (!fs.existsSync(execDir)) {
      fs.mkdirSync(execDir);
    }

    fs.writeFileSync(filePath, func.code);

    const langMap = {
      js: "node",
      javascript: "node",
      python: "python",
    };

    const language = langMap[func.language.toLowerCase()];
    if (!language) {
      return res
        .status(400)
        .json({ success: false, error: "Unsupported language" });
    }

    const imageTag = `func-${language}-image`;
    const dockerfilePath = path.resolve(
      __dirname,
      "docker",
      `DockerFile.${language}`
    );
    const buildCommand = `docker build -f "${dockerfilePath}" -t ${imageTag} "${__dirname}"`;

    exec(buildCommand, (err, stdout, stderr) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, error: "Docker build failed" });
      }

      const dockerRuntime = runtime === "gvisor" ? "--runtime=runsc" : "";
      const runCommand = `docker run --rm ${dockerRuntime} ${imageTag}`;
      const start = Date.now();

      exec(runCommand, (err, stdout, stderr) => {
        const duration = Date.now() - start;
        const success = !err;
        const errorMessage = err ? stderr || err.message : null;

        // Insert metric into DB
        const insertMetric = `
          INSERT INTO metrics (function_id, language, runtime, duration_ms, success, error_message)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
          insertMetric,
          [
            functionId,
            func.language,
            runtime || "default",
            duration,
            success,
            errorMessage,
          ],
          (metricErr) => {
            if (metricErr) {
              console.error("❌ Failed to insert metric:", metricErr);
            }
          }
        );

        // Send response
        if (err) {
          return res.status(500).json({
            success: false,
            functionId,
            language: func.language,
            error: errorMessage,
            duration: `${duration}ms`,
          });
        }

        return res.status(200).json({
          success: true,
          functionId,
          language: func.language,
          output: stdout.trim(),
          duration: `${duration}ms`,
        });
      });
    });
  });
});

app.get("/metrics-summary", (req, res) => {
  const sql = `
    SELECT 
      function_id,
      runtime,
      COUNT(*) AS total_runs,
      AVG(duration_ms) AS avg_duration,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS error_count
    FROM metrics
    GROUP BY function_id, runtime
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch metrics summary" });
    }

    res.json(results);
  });
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
  warmUp();
  warmPool();
});
