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
  console.log('=== FULL REQUEST ===');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    const request = req.body.request || req.body;
    let speechText = "I'm not quite sure how to help you with that.";

    if (request.type === "LaunchRequest") {
      speechText = "Welcome to Grok Voice. Ask me anything!";
    } else {
      // Catch all queries
      let query = "Tell me something interesting";
      
      if (request.intent && request.intent.slots) {
        query = request.intent.slots.query?.value || 
                request.intent.slots.searchQuery?.value || 
                query;
      } else if (request.intent && request.intent.name) {
        query = request.intent.name;
      }

      console.log('Final query:', query);

      if (XAI_API_KEY) {
        console.log('Calling Grok...');
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