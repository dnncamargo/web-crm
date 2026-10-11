import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repositoryRoot = process.cwd();
const outputDirectory = mkdtempSync(path.join(repositoryRoot, ".financial-api-runtime-"));

try {
  const entryPoint = path.join(repositoryRoot, "api/financial/apply-credit.ts");
  const program = ts.createProgram([entryPoint], {
    target: ts.ScriptTarget.ES2023,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    rootDir: repositoryRoot,
    outDir: outputDirectory,
    types: ["node"],
    skipLibCheck: true,
    strict: true,
    verbatimModuleSyntax: true,
    noEmitOnError: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  if (diagnostics.length > 0) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => repositoryRoot,
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => "\n",
    }));
    process.exitCode = 1;
  } else {
    const emitResult = program.emit();
    if (emitResult.emitSkipped || emitResult.diagnostics.length > 0) {
      console.error(ts.formatDiagnosticsWithColorAndContext(emitResult.diagnostics, {
        getCurrentDirectory: () => repositoryRoot,
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => "\n",
      }));
      process.exitCode = 1;
    } else {
      const emittedEntry = path.join(outputDirectory, "api/financial/apply-credit.js");
      const route = await import(pathToFileURL(emittedEntry).href);

      if (typeof route.POST !== "function") {
        throw new Error("The compiled financial API module does not export POST.");
      }

      console.log("Financial API runtime import passed under Node.js ESM.");
    }
  }
} catch (error) {
  console.error("Financial API runtime import failed under Node.js ESM.");
  console.error(error);
  process.exitCode = 1;
} finally {
  const resolvedRoot = path.resolve(repositoryRoot) + path.sep;
  const resolvedOutput = path.resolve(outputDirectory);

  if (resolvedOutput.startsWith(resolvedRoot)
    && path.basename(resolvedOutput).startsWith(".financial-api-runtime-")) {
    rmSync(resolvedOutput, { recursive: true, force: true });
  } else {
    console.error("Refusing to remove an unexpected runtime-check output path.");
    process.exitCode = 1;
  }
}
