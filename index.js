const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const XAI_API_KEY = process.env.XAI_API_KEY;

app.get('/', (req, res) => {
  res.send('Grok Voice is running!');
});

app.post('/', async (req, res) => {
  console.log('Request received');

  let speechText = "Sorry, I couldn't get a response.";

  try {
    const request = req.body.request || req.body;
    let query = "Tell me something interesting";

    if (request.intent && request.intent.slots) {
      query = request.intent.slots.query?.value || query;
    }

    if (XAI_API_KEY) {
      console.log('Calling Grok with query:', query);
      const response = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${XAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "grok-4.3",
          input: [{ role: "user", content: query }]
        })
      });
      const data = await response.json();
      speechText = data.output || "Sorry, I couldn't get a response.";
    }
  } catch (error) {
    console.error('Error:', error);
  }

  res.json({
    version: "1.0",
    response: {
      outputSpeech: {
        type: "PlainText",
        text: speechText
      },
      shouldEndSession: false
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});