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
  const result = await chrome.storage.local.get(['openai_api_key']);
  const apiKey = result.openai_api_key;
  
  if (!apiKey) {
    throw new Error("API key not found. Please set your OpenAI API key in the extension settings.");
  }
  
  // Trim the content if it's too long
  const trimmedContent = content.substring(0, 4000);
  
  try {
    console.log("Calling OpenAI API...");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that summarizes web content concisely."
          },
          {
            role: "user",
            content: `Please summarize the following web content in about 3-5 bullet points:\n\n${trimmedContent}`
          }
        ],
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("API returned error:", data.error);
      throw new Error(data.error.message || "API Error");
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}