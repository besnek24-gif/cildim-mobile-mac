const fs = require("fs");

const p = "app.json";
const app = JSON.parse(fs.readFileSync(p, "utf8"));

if (!app.expo) throw new Error("app.json içinde expo alanı bulunamadı.");

const before = {
  buildNumber: app.expo?.ios?.buildNumber,
  newArchEnabled: app.expo?.newArchEnabled,
  reactCompiler: app.expo?.experiments?.reactCompiler,
};

app.expo.ios = app.expo.ios || {};
const currentBuild = Number(app.expo.ios.buildNumber || "4");
app.expo.ios.buildNumber = String(Math.max(currentBuild + 1, 5));

app.expo.newArchEnabled = false;

app.expo.experiments = app.expo.experiments || {};
app.expo.experiments.reactCompiler = false;

fs.writeFileSync(p, JSON.stringify(app, null, 2) + "\n");

const after = {
  buildNumber: app.expo?.ios?.buildNumber,
  newArchEnabled: app.expo?.newArchEnabled,
  reactCompiler: app.expo?.experiments?.reactCompiler,
};

console.log("=== ECZ4 BUILD 5 STABILITY PATCH ===");
console.log("Before:", before);
console.log("After :", after);
console.log("OK: app.json stabil Build 5 için hazırlandı.");
