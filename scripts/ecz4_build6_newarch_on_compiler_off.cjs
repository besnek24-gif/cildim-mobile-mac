const fs = require("fs");

const p = "app.json";
const app = JSON.parse(fs.readFileSync(p, "utf8"));

app.expo = app.expo || {};
app.expo.ios = app.expo.ios || {};
app.expo.experiments = app.expo.experiments || {};

const before = {
  buildNumber: app.expo.ios.buildNumber,
  newArchEnabled: app.expo.newArchEnabled,
  reactCompiler: app.expo.experiments.reactCompiler,
};

const currentBuild = Number(app.expo.ios.buildNumber || "5");
app.expo.ios.buildNumber = String(Math.max(currentBuild + 1, 6));

app.expo.newArchEnabled = true;
app.expo.experiments.reactCompiler = false;

fs.writeFileSync(p, JSON.stringify(app, null, 2) + "\n");

console.log("=== ECZ4 BUILD 6 PATCH ===");
console.log("Before:", before);
console.log("After :", {
  buildNumber: app.expo.ios.buildNumber,
  newArchEnabled: app.expo.newArchEnabled,
  reactCompiler: app.expo.experiments.reactCompiler,
});
console.log("OK: New Architecture geri açıldı, React Compiler kapalı kaldı.");
