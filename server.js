//Install express server
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');
const https = require('https');
const compression = require('compression');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: 'text/*' }))
app.use(compression());

const appPath = '/dist/ng-visuall';
app.use(express.static(__dirname + appPath));

const port = process.env.PORT || 5200;
app.listen(port);

app.get('/urlquery/*', function (req, res) {
  let reqURL = req.url.substr(10);
  const data = [];
  if (reqURL.substr(0, 5).toLowerCase() != "https" && reqURL.substr(0, 4).toLowerCase() == "http") {
    let request = http.request(reqURL, function (response, body) {
      response.on('data', function (chunk) {
        data.push(chunk);
      });
      response.on('end', function () {
        let result = JSON.parse(data.join(''))
        res.send(result);

      });
    });
    request.on('error', function (e) {
      console.log(e.message);
    });
    request.end();
  }
  else {
    if (reqURL.substr(0, 4).toLowerCase() != "http") {
      reqURL = "https://" + reqURL;
    }
    let request = https.request(reqURL, function (response, body) {
      response.on('data', function (chunk) {
        data.push(chunk);
      });
      response.on('end', function () {
        try {
          const result = JSON.parse(data.join(''))
          res.send(result);
        } catch (e) {
          res.send('{}');
        }

      });
    });
    request.on('error', function (e) {
      console.log(e.message);
    });
    request.end();
  }
});

app.get('/e2e', function (req, res) {
  res.sendFile(path.join(__dirname + '/e2e-results.txt'));
});

app.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname + appPath + '/index.html'));
});

// Start the app by listening on the default port
console.log('server listening port: ', port);
