const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

const PAGES_DIR = path.join(__dirname, "..", "app");

// Check if a file uses useSearchParams
async function usesSearchParams(filePath) {
  try {
    const content = await readFileAsync(filePath, "utf8");
    return content.includes("useSearchParams");
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return false;
  }
}

// Check if a file already has Suspense
async function hasSuspense(filePath) {
  try {
    const content = await readFileAsync(filePath, "utf8");
    return (
      content.includes("import { Suspense }") ||
      content.includes("import {Suspense}") ||
      content.includes("import { useState, useEffect, Suspense }") ||
      content.includes("import {useState, useEffect, Suspense}")
    );
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return false;
  }
}

// Process a single file
async function processFile(filePath) {
  // Only process page.tsx files
  if (!filePath.endsWith("page.tsx") && !filePath.endsWith("page.jsx")) return;

  if ((await usesSearchParams(filePath)) && !(await hasSuspense(filePath))) {
    console.log(`⚠️ Page uses useSearchParams without Suspense: ${filePath}`);
    return true;
  }

  return false;
}

// Recursively process directories
async function processDirectory(directoryPath) {
  try {
    const items = await readDirAsync(directoryPath);
    const pagesWithoutSuspense = [];

    for (const item of items) {
      const itemPath = path.join(directoryPath, item);
      const stat = await statAsync(itemPath);

      if (stat.isDirectory()) {
        const results = await processDirectory(itemPath);
        pagesWithoutSuspense.push(...results);
      } else {
        const needsSuspense = await processFile(itemPath);
        if (needsSuspense) {
          pagesWithoutSuspense.push(itemPath);
        }
      }
    }

    return pagesWithoutSuspense;
  } catch (error) {
    console.error(`Error processing directory ${directoryPath}:`, error);
    return [];
  }
}

// Main function to run the script
async function main() {
  console.log(
    "🔍 Scanning pages for useSearchParams usage without Suspense..."
  );
  const pagesWithoutSuspense = await processDirectory(PAGES_DIR);

  if (pagesWithoutSuspense.length === 0) {
    console.log("✅ All pages using useSearchParams have Suspense boundaries");
  } else {
    console.log("⚠️ The following pages need Suspense boundaries:");
    pagesWithoutSuspense.forEach((page) => {
      console.log(`  - ${page}`);
    });

    console.log("\nTo fix these issues:");
    console.log(
      '1. Add Suspense to imports: `import { Suspense } from "react"`'
    );
    console.log("2. Extract the page content to a separate component");
    console.log(
      "3. Wrap the component with Suspense in the default export function"
    );
    console.log("\nExample:");
    console.log("```");
    console.log("function PageContent() {");
    console.log("  const searchParams = useSearchParams();");
    console.log("  // ... existing code");
    console.log("}");
    console.log("");
    console.log("export default function Page() {");
    console.log("  return (");
    console.log("    <Suspense fallback={<div>Loading...</div>}>");
    console.log("      <PageContent />");
    console.log("    </Suspense>");
    console.log("  );");
    console.log("}");
    console.log("```");
  }
}

main().catch(console.error);
