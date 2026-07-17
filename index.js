const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const XAI_API_KEY = process.env.XAI_API_KEY;

app.get('/', (req, res) => {
  res.send('Grok Voice Skill is running on Railway!');
});

app.post('/', async (req, res) => {
  try {
    const request = req.body.request;
    let speechText = "I'm not quite sure how to help you with that.";

    if (request.type === "LaunchRequest") {
      speechText = "Welcome to Grok Voice. Ask me anything!";
    } else if (request.type === "IntentRequest") {
      // Catch-all for any intent
      const query = request.intent.slots?.query?.value || request.intent.slots?.searchQuery?.value || "Tell me something interesting";
      
      if (XAI_API_KEY) {
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
        speechText = data.output || "Sorry, I couldn't get a response from Grok.";
      } else {
        speechText = "Grok API key is not configured.";
      }
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
  } catch (error) {
    console.error(error);
    res.json({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text: "Sorry, something went wrong."
        },
        shouldEndSession: false
      }
    });
  }
});

app.listen(port, () => {
  console.log(`Grok Voice server running on port ${port}`);
});