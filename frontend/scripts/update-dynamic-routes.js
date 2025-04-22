const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readDirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

const API_ROUTES_DIR = path.join(__dirname, "..", "app", "api");

// Check if a file imports cookies from next/headers
async function usesNextCookies(filePath) {
  try {
    const content = await readFileAsync(filePath, "utf8");
    return (
      content.includes('import { cookies } from "next/headers"') ||
      content.includes("import { cookies } from 'next/headers'")
    );
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return false;
  }
}

// Check if the file already has the dynamic export
async function hasDynamicExport(filePath) {
  try {
    const content = await readFileAsync(filePath, "utf8");
    return (
      content.includes("export const dynamic = 'force-dynamic'") ||
      content.includes('export const dynamic = "force-dynamic"')
    );
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return false;
  }
}

// Add dynamic export to the file
async function addDynamicExport(filePath) {
  try {
    let content = await readFileAsync(filePath, "utf8");

    // Find the imports to determine where to insert the dynamic export
    const lines = content.split("\n");
    let lastImportLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        lastImportLineIndex = i;
      }
    }

    if (lastImportLineIndex >= 0) {
      // Add the dynamic export after the last import with a blank line
      lines.splice(
        lastImportLineIndex + 1,
        0,
        "",
        "export const dynamic = 'force-dynamic';"
      );

      // Write the modified content back to the file
      await writeFileAsync(filePath, lines.join("\n"), "utf8");
      console.log(`✅ Added dynamic export to ${filePath}`);
      return true;
    } else {
      console.warn(`⚠️ Could not find import lines in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding dynamic export to ${filePath}:`, error);
    return false;
  }
}

// Process a single file
async function processFile(filePath) {
  if (!/\.(js|ts)x?$/.test(filePath)) return;

  if (
    filePath.includes("route.") &&
    (await usesNextCookies(filePath)) &&
    !(await hasDynamicExport(filePath))
  ) {
    console.log(`Found route handler using cookies: ${filePath}`);
    await addDynamicExport(filePath);
  }
}

// Recursively process directories
async function processDirectory(directoryPath) {
  try {
    const items = await readDirAsync(directoryPath);

    for (const item of items) {
      const itemPath = path.join(directoryPath, item);
      const stat = await statAsync(itemPath);

      if (stat.isDirectory()) {
        await processDirectory(itemPath);
      } else {
        await processFile(itemPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${directoryPath}:`, error);
  }
}

// Main function to run the script
async function main() {
  console.log("🔍 Scanning API routes for cookies usage...");
  await processDirectory(API_ROUTES_DIR);
  console.log("✨ Finished processing API routes");
}

main().catch(console.error);
