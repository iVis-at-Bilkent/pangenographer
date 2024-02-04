const { exec } = require("child_process");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

// Blast files path on the server
// This should be changed for individual users
const filePath = "/home/ivis/visuall/pangenographer/src/app/blast/";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

app.post("/makeBlastDb", async (req, res) => {
  try {
    // -in all_nodes.fasta -dbtype nucl

    const blastOutput = await new Promise((resolve, reject) => {
      const fileContent = req.body.fastaData;
      let curfilePath = filePath + "all_nodes.fasta";

      let fileError = undefined;

      fs.writeFile(curfilePath, fileContent, (err) => {
        if (err) {
          fileError = err;
        }
      });

      exec(
        "makeblastdb -in all_nodes.fasta -dbtype nucl",
        (error, stdout, stderr) => {
          if (error || fileError) {
            error = error || fileError;
            reject(error);
          } else {
            resolve(stdout);
          }
        }
      );
    });

    res.json({ results: blastOutput });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error running BLAST");
  }
});

app.post("/blastn", async (req, res) => {
  try {
    // -query query.fasta -db all_nodes.fasta -outfmt 6

    const blastOutput = await new Promise((resolve, reject) => {
      const fileContent = req.body.fastaData;
      let curfilePath = filePath + "query.fasta";

      let fileError = undefined;

      fs.writeFile(curfilePath, fileContent, (err) => {
        if (err) {
          fileError = err;
        }
      });

      exec(
        "blastn -query query.fasta -db all_nodes.fasta -outfmt 6",
        (error, stdout, stderr) => {
          if (error || fileError) {
            error = error || fileError;
            reject(error);
          } else {
            resolve(stdout);
          }
        }
      );
    });

    res.json({ results: blastOutput });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error running BLAST");
  }
});

app.listen(5201, () => {});
