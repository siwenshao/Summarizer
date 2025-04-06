// Background script initialization
console.log("Background service worker started");

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);

  if (message.action === "summarize") {
    // Forward the content to the API and return the summary
    fetchSummaryFromAPI(message.content)
      .then(summary => {
        console.log("Summary generated successfully");
        sendResponse({ success: true, summary: summary });
      })
      .catch(error => {
        console.error("Error generating summary:", error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

async function fetchSummaryFromAPI(content) {
  // Get the API key from storage
  const result = await chrome.storage.local.get(['gemini_api_key']);
  const apiKey = result.gemini_api_key;

  if (!apiKey) {
    throw new Error("API key not found. Please set your Gemini API key in the extension settings.");
  }

  // Trim the content if it's too long
  const trimmedContent = content.substring(0, 4000);

  try {
    console.log("Calling Gemini API with gemini-2.0-flash...");
    // Using the correct model name for Gemini 2.0 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "You are a helpful assistant that summarizes web content concisely."
              },
              {
                text: `Please summarize the following web content in about 3-5 bullet points:\n\n${trimmedContent}`
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 500
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("API returned error:", data.error);
      throw new Error(data.error.message || "API Error");
    }

    // The structure of the response might be slightly different for different models.
    // Ensure you are accessing the correct property for the generated text.
    // For gemini-2.0-flash, it's likely still within `candidates[0].content.parts[0].text`.
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      console.error("Unexpected API response structure:", data);
      throw new Error("Failed to extract summary from API response.");
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}