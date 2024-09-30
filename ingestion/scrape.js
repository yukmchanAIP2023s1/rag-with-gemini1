import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { embeddingModel } from "../lib/bot.js";
import { collection } from "../lib/db.js";

const url = "";

// Fetch the content from the URL
const response = await fetch(url);
const text = await response.text();

// Parse the content using Readability
const doc = new JSDOM(text, { url }).window.document;
const reader = new Readability(doc);
const article = reader.parse();
const data = `${article.title}\n\n${article.textContent}`.trim();

// Split the content into chunks
const splitter = new RecursiveCharacterTextSplitter({
  chunkOverlap: 128,
  chunkSize: 1024,
});
const chunks = await splitter.splitText(data);

// Create vector embeddings of the data
const embeddings = await Promise.all(
  chunks.map(async (chunk) => {
    const result = await embeddingModel.embedContent(chunk);
    return result.embedding.values;
  })
);

// Create the documents that we will save in the database and store them in Astra DB
const documents = embeddings.map((embedding, i) => ({
  $vector: embedding,
  content: chunks[i],
  metadata: { url },
}));

const results = await collection.insertMany(documents);
console.log(`Inserted: ${results.insertedCount}`);
