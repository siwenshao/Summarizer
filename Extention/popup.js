document.addEventListener("DOMContentLoaded", function () {
  const summarizeBtn = document.getElementById("summarizeBtn");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const resultContainer = document.getElementById("resultContainer");
  const summaryContent = document.getElementById("summaryContent");
  const errorContainer = document.getElementById("errorContainer");
  const errorMessage = document.getElementById("errorMessage");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveApiKey = document.getElementById("saveApiKey");
  const apiKeyStatus = document.getElementById("apiKeyStatus");

  // Check if API key exists and update UI
  chrome.storage.local.get(["openai_api_key"], function (result) {
    if (result.openai_api_key) {
      apiKeyInput.value = "************";
      apiKeyStatus.textContent = "API Key is set";
      apiKeyStatus.className = "success";
    } else {
      apiKeyStatus.textContent = "Please enter your OpenAI API Key";
      apiKeyStatus.className = "warning";
    }
  });

  // Save API key
  saveApiKey.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey.length > 0) {
      chrome.storage.local.set({ openai_api_key: apiKey }, function () {
        apiKeyInput.value = "************";
        apiKeyStatus.textContent = "API Key saved!";
        apiKeyStatus.className = "success";
      });
    } else {
      apiKeyStatus.textContent = "Please enter a valid API Key";
      apiKeyStatus.className = "error";
    }
  });

  // Summarize button click handler
  summarizeBtn.addEventListener("click", function () {
    // Show loading indicator
    loadingIndicator.classList.remove("hidden");
    resultContainer.classList.add("hidden");
    errorContainer.classList.add("hidden");

    // Get current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || tabs.length === 0) {
        showError("Could not access the current tab.");
        return;
      }

      const activeTab = tabs[0];

      // First inject content script to ensure it's loaded
      chrome.scripting
        .executeScript({
          target: { tabId: activeTab.id },
          files: ["content.js"],
        })
        .then(() => {
          // Once content script is injected, send the message
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "getPageContent" },
            function (response) {
              if (chrome.runtime.lastError) {
                showError(
                  "Error connecting to the page: " +
                    chrome.runtime.lastError.message
                );
                return;
              }

              if (response && response.success) {
                // Get the API key
                chrome.storage.local.get(["openai_api_key"], function (result) {
                  if (!result.openai_api_key) {
                    showError(
                      "API key not found. Please enter your OpenAI API key in the settings."
                    );
                    return;
                  }

                  // Forward the content to the background script for API processing
                  chrome.runtime.sendMessage(
                    {
                      action: "summarize",
                      content: response.content,
                    },
                    function (summaryResponse) {
                      if (chrome.runtime.lastError) {
                        showError(
                          "Error reaching background script: " +
                            chrome.runtime.lastError.message
                        );
                        return;
                      }

                      loadingIndicator.classList.add("hidden");

                      if (summaryResponse && summaryResponse.success) {
                        // Show the summary
                        resultContainer.classList.remove("hidden");
                        summaryContent.innerHTML = formatSummary(
                          summaryResponse.summary
                        );
                      } else {
                        // Show error
                        showError(
                          summaryResponse?.error || "Failed to generate summary"
                        );
                      }
                    }
                  );
                });
              } else {
                showError("Failed to extract page content");
              }
            }
          );
        })
        .catch((err) => {
          showError("Failed to inject content script: " + err.message);
        });
    });
  });

  function showError(message) {
    loadingIndicator.classList.add("hidden");
    errorContainer.classList.remove("hidden");
    errorMessage.textContent = message;
    console.error("Extension error:", message);
  }

  function formatSummary(text) {
    const lines = text.split("\n");
    let html = "";
    let inList = false;

    for (const line of lines) {
      let trimmedLine = line.trim();
      let isListItem = false;

      // First, handle italics and bold to avoid misinterpreting markers
      trimmedLine = trimmedLine.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );
      trimmedLine = trimmedLine.replace(/\*(.+?)\*/g, "<em>$1</em>");
      trimmedLine = trimmedLine.replace(/__(.+?)__/g, "<strong>$1</strong>");
      trimmedLine = trimmedLine.replace(/_(.+?)_/g, "<em>$1</em>");

      // Now, check for bullet points after processing italics/bold
      if (
        trimmedLine.startsWith("•") ||
        trimmedLine.startsWith("-") ||
        trimmedLine.startsWith("*")
      ) {
        isListItem = true;
        trimmedLine = trimmedLine.substring(1).trim(); // Remove bullet point marker
      }

      if (isListItem) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${trimmedLine}</li>`;
      } else if (trimmedLine.length > 0) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += `<p>${trimmedLine}</p>`;
      }
    }

    if (inList) {
      html += "</ul>";
    }

    return html;
  }

  sendChat.addEventListener("click", async () => {
    const userQuestion = chatInput.value.trim();
    if (!userQuestion) return;

    chatLoading.classList.remove("hidden");
    chatResponse.innerHTML = "";

    chrome.tabs.query(
      { active: true, currentWindow: true },
      async function (tabs) {
        const activeTab = tabs[0];

        try {
          // Inject content.js (in case it's not loaded yet)
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ["content.js"],
          });

          // Get readable content from the page
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "getPageContent" },
            async function (response) {
              if (!response || !response.success) {
                chatLoading.classList.add("hidden");
                chatResponse.innerHTML = " Could not read page content.";
                return;
              }

              const pageContent = response.content.substring(0, 4000); // trim for token limits
              const result = await chrome.storage.local.get(["gemini_api_key"]);
              const apiKey = result.gemini_api_key;

              if (!apiKey) {
                chatLoading.classList.add("hidden");
                chatResponse.innerHTML = " API key not found.";
                return;
              }

              const prompt = [
                {
                  text: "You are a helpful assistant that reads a webpage and answers questions based on its content.",
                },
                { text: "Webpage content:\n" + pageContent },
                { text: "User question:\n" + userQuestion },
              ];

              const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: prompt }],
                    generationConfig: { maxOutputTokens: 8192 },
                  }),
                }
              );

              const data = await res.json();
              console.log("Gemini chat response:", data);
              chatLoading.classList.add("hidden");

              if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                chatResponse.innerHTML = formatSummary(
                  data.candidates[0].content.parts[0].text
                );

                // `<br>${data.candidates[0].content.parts[0].text}`;
              } else {
                chatResponse.innerHTML = " Gemini returned no usable reply.";
              }
            }
          );
        } catch (err) {
          chatLoading.classList.add("hidden");
          chatResponse.innerHTML = ` Error: ${err.message}`;
        }
      }
    );
  });
});
