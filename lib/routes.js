import { Router } from "express";
import { SYSTEM_MESSAGE } from "./consts.js";
import { createBot, embeddingModel } from "./bot.js";
import { collection } from "./db.js";

const router = Router();

router.get("/history", (req, res) => {
  const messages = req.session.messages || [];
  res.json(messages);
});

router.get("/clear-history", (req, res) => {
  req.session.regenerate(() => {
    req.session.messages = [];
    res.redirect("/");
  });
});

router.post("/messages", async (req, res) => {
  const messages = req.session.messages || [];
  const { query } = req.body;
  res.set("Content-Type", "text/plain");

  const embeddingResult = await embeddingModel.embedContent(query);
  const cursor = await collection.find(
    {},
    {
      sort: { $vector: embeddingResult.embedding.values },
      limit: 10,
      includeSimilarity: true,
    }
  );
  const context = (await cursor.toArray())
    .map((doc) => doc.content)
    .join("\n\n");

  console.log(context);

  const prompt = `Answer the question with the given context.
Question: ${query}
Context: ${context}
Answer:`;

  const bot = createBot(SYSTEM_MESSAGE, messages);

  const result = await bot.sendMessageStream(prompt);
  let text = "";
  for await (const chunk of result.stream) {
    text += chunk.text();
    res.write(chunk.text());
  }
  messages.push({ role: "user", parts: [{ text: query }] });
  messages.push({ role: "model", parts: [{ text }] });

  req.session.messages = messages;
  res.end();
});

export default router;
