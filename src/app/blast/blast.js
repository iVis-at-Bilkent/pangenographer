const { exec } = require("child_process");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const fsp = fs.promises;

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const filePath = process.env.BLAST_FILE_PATH || path.resolve(__dirname);
const port = process.env.BLAST_PORT || 5205;
const allNodesPath = path.join(filePath, "all_nodes.fasta");
const queryPath = path.join(filePath, "query.fasta");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "100mb" }));

app.post("/makeBlastDb", async (req, res) => {
  try {
    // -in all_nodes.fasta -dbtype nucl

    const blastOutput = await new Promise((resolve, reject) => {
      fsp
        .writeFile(allNodesPath, req.body.fastaData)
        .then(() => {
          exec(
            "makeblastdb -in all_nodes.fasta -dbtype nucl",
            { cwd: filePath },
            (error, stdout, stderr) => {
              if (error) {
                reject(error);
              } else {
                resolve(stdout);
              }
            }
          );
        })
        .catch(reject);
    });

    res.json({ results: blastOutput });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error running BLAST");
  }
});

app.post("/blastn", async (req, res) => {
  try {
    // -query query.fasta -db all_nodes.fasta

    const blastOutput = await new Promise((resolve, reject) => {
      fsp
        .writeFile(queryPath, req.body.fastaData)
        .then(() => {
          exec(
            "blastn -query query.fasta -db all_nodes.fasta " +
              req.body.commandLineArguments,
            { cwd: filePath },
            (error, stdout, stderr) => {
              if (error) {
                reject(error);
              } else {
                resolve(stdout);
              }
            }
          );
        })
        .catch(reject);
    });

    res.json({
      results: blastOutput,
      isFormat6: req.body.commandLineArguments.includes("-outfmt 6"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error running BLAST");
  }
});

app.listen(port, () => {
  console.log(`BLAST server running on port ${port}`);
});
