import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const cssPath = path.join(rootDir, "src/styles/global.css");

const sourceExtensions = [".tsx", ".ts", ".jsx", ".js", ".html"];
const ignoredDirs = new Set(["node_modules", "dist", ".git", ".vercel"]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) return [];
      return walk(fullPath);
    }

    return [fullPath];
  });
}

function getCssClasses(cssContent) {
  const matches = cssContent.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);

  return [...new Set([...matches].map((match) => match[1]))].sort();
}

const cssContent = fs.readFileSync(cssPath, "utf8");
const cssClasses = getCssClasses(cssContent);

const sourceFiles = walk(path.join(rootDir, "src")).filter((filePath) =>
  sourceExtensions.includes(path.extname(filePath))
);

const sourceText = sourceFiles
  .map((filePath) => fs.readFileSync(filePath, "utf8"))
  .join("\n");

const possiblyUnused = cssClasses.filter((className) => {
  return !sourceText.includes(className);
});

console.log("\nClasses CSS possivelmente não usadas:\n");

possiblyUnused.forEach((className) => {
  console.log(`.${className}`);
});

console.log(`\nTotal: ${possiblyUnused.length}\n`);