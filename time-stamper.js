const fs = require("fs");

main();

function main() {
  let app_desc_file = "dist/ng-visuall/app/custom/config/app_description.json";
  if (process.argv.length === 3) {
    app_desc_file = process.argv[2];
  }

  const app_desc = JSON.parse(readFile(app_desc_file));
  app_desc.appInfo.build_time =
    new Date().toLocaleString("tr-TR", { timeZone: "Europe/Athens" }) +
    " (Turkey)";
  writeFile(app_desc_file, JSON.stringify(app_desc));
}

function readFile(filename) {
  if (typeof filename !== "string") {
    console.log("Invalid use of function!\nread_file(filename:string)");
    return;
  }

  return fs.readFileSync(filename, "utf8");
}

function writeFile(filename, content) {
  if (typeof filename !== "string" || typeof content !== "string") {
    console.log(
      "Invalid use of function!\nwrite_file(filename:string, content:string)"
    );
    return;
  }

  fs.writeFile(filename, content, function (err) {
    if (err) throw err;

    console.log(filename + " written successfully!");
  });
}
