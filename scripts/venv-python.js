// Runs the server venv's Python on Windows, macOS and Linux.
// Usage: node scripts/venv-python.js [args]   (defaults to app.py)
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const serverDir = path.join(__dirname, "..", "server");
const venvPython = process.platform === "win32"
  ? path.join(serverDir, ".venv", "Scripts", "python.exe")
  : path.join(serverDir, ".venv", "bin", "python");

if (!fs.existsSync(venvPython)) {
  console.error("No venv found in server/.venv. Follow the Backend setup steps in README.md first.");
  process.exit(1);
}

const args = process.argv.length > 2 ? process.argv.slice(2) : ["app.py"];
spawn(venvPython, args, { cwd: serverDir, stdio: "inherit" })
  .on("exit", (code) => process.exit(code ?? 0));
