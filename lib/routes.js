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

  const bot = createBot(SYSTEM_MESSAGE, messages);

  const result = await bot.sendMessageStream(query);
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
