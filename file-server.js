const express = require("express");
const compression = require("compression");
const path = require("path");

const app = express();
app.use(compression());

const port = process.env.PORT || 8080;
app.listen(port);

app.get("/*", function (req, res) {
  res.sendFile(path.join(__dirname + "/logs.txt"));
});
