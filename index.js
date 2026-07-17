const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 8080;

app.use(bodyParser.json());

const XAI_API_KEY = process.env.XAI_API_KEY;

app.get('/', (req, res) => {
  res.send('Grok Voice Skill is running on Railway!');
});

app.post('/', async (req, res) => {
  console.log('=== FULL REQUEST RECEIVED ===');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const request = req.body.request;
    let speechText = "I'm not quite sure how to help you with that.";

    if (request.type === "LaunchRequest") {
      speechText = "Welcome to Grok Voice. Ask me anything!";
    } else if (request.type === "IntentRequest") {
      const intent = request.intent.name;
      const isPremium = req.body.context?.System?.user?.permissions?.purchased?.includes('grok_premium_subscription') || false;
      
      console.log('Intent:', intent, 'Premium:', isPremium);
      
      const query = request.intent.slots?.query?.value || "Tell me something interesting";
      
      console.log('Query:', query);

      if (XAI_API_KEY) {
        const model = isPremium ? "grok-4.5" : "grok-4.3";
        console.log('Calling Grok with model:', model);
        const response = await fetch("https://api.x.ai/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${XAI_API_KEY}`
          },
          body: JSON.stringify({
            model: model,
            input: [{ role: "user", content: query }]
          })
        });
        const data = await response.json();
        console.log('Grok response:', data);
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
    console.error('Error:', error);
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