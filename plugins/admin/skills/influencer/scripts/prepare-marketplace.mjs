#!/usr/bin/env bun
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseResponses, sha256, validateCapture } from "./capture-marketplace.mjs";

export async function prepareMarketplace(directory, outputDirectory) {
  const documents = [];
  const seen = new Set();
  for (const file of (await readdir(directory)).filter(name => name.endsWith(".json")).sort()) {
    const record = JSON.parse(await readFile(join(directory, file), "utf8"));
    if (typeof record.bodyFile !== "string" || basename(record.bodyFile) !== record.bodyFile || !record.bodyFile.endsWith(".body")) throw new Error("Invalid response body filename");
    const body = await readFile(join(directory, record.bodyFile), "utf8");
    if (sha256(body) !== record.sha256) throw new Error("Response body hash mismatch");
    if (!/^Business.*(?:CreatorMarketplace|CreatorPortfolio)/.test(record.operation) || !Number.isFinite(Date.parse(record.observedAt))) throw new Error("Invalid observed metadata");
    const responses = parseResponses(body);
    validateCapture(record);
    const identity = sha256(JSON.stringify([record.operation, record.variables, record.sha256]));
    if (seen.has(identity)) continue;
    seen.add(identity);
    documents.push({ operation: record.operation, variables: record.variables, docId: record.docId, observedAt: record.observedAt, sha256: record.sha256, responses });
  }
  if (!documents.length) throw new Error("No captured Marketplace documents");
  const batches = [];
  let batch = [];
  const encode = items => JSON.stringify({ schema: "ongleam.marketplace.browser-capture.v1", documents: items });
  for (const document of documents) {
    if (Buffer.byteLength(encode([document])) > 2 * 1024 * 1024) throw new Error("One document exceeds 2 MiB; do not split response fragments");
    if (Buffer.byteLength(encode([...batch, document])) > 2 * 1024 * 1024) { batches.push(batch); batch = []; }
    batch.push(document);
  }
  batches.push(batch);
  await mkdir(outputDirectory, { mode: 0o700 });
  const manifest = [];
  for (const [index, items] of batches.entries()) {
    const body = encode(items);
    const file = `batch-${String(index + 1).padStart(4, "0")}.json`;
    await writeFile(join(outputDirectory, file), body, { mode: 0o600, flag: "wx" });
    manifest.push({ file, documents: items.length, sha256: sha256(body) });
  }
  await writeFile(join(outputDirectory, "manifest.json"), JSON.stringify({ documents: documents.length, batches: manifest }), { mode: 0o600, flag: "wx" });
  return { documents: documents.length, batches: manifest.length };
}

if (import.meta.main) {
  const [directory, outputDirectory] = process.argv.slice(2);
  if (!directory || !outputDirectory || process.argv.length !== 4) throw new Error("Usage: bun prepare-marketplace.mjs <captureDir> <new-outputDir>");
  console.log(JSON.stringify(await prepareMarketplace(directory, outputDirectory)));
}
