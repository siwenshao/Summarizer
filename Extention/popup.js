document.addEventListener('DOMContentLoaded', function() {
  const summarizeBtn = document.getElementById('summarizeBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const resultContainer = document.getElementById('resultContainer');
  const summaryContent = document.getElementById('summaryContent');
  const errorContainer = document.getElementById('errorContainer');
  const errorMessage = document.getElementById('errorMessage');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKey = document.getElementById('saveApiKey');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  
  // Check if API key exists and update UI
  chrome.storage.local.get(['gemini_api_key'], function(result) {
    if (result.gemini_api_key) {
      apiKeyInput.value = '************';
      apiKeyStatus.textContent = 'API Key is set';
      apiKeyStatus.className = 'success';
    } else {
      apiKeyStatus.textContent = 'Please enter your Gemini API Key';
      apiKeyStatus.className = 'warning';
    }
  });
  
  // Save API key
  saveApiKey.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey.length > 0) {
      chrome.storage.local.set({gemini_api_key: apiKey}, function() {
        apiKeyInput.value = '************';
        apiKeyStatus.textContent = 'API Key saved!';
        apiKeyStatus.className = 'success';
      });
    } else {
      apiKeyStatus.textContent = 'Please enter a valid API Key';
      apiKeyStatus.className = 'error';
    }
  });
  
  // Summarize button click handler
  summarizeBtn.addEventListener('click', function() {
    // Show loading indicator
    loadingIndicator.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');
    
    // Get current active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showError('Could not access the current tab.');
        return;
      }
      
      const activeTab = tabs[0];
      
      // First inject content script to ensure it's loaded
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        files: ['content.js']
      }).then(() => {
        // Once content script is injected, send the message
        chrome.tabs.sendMessage(activeTab.id, {action: "getPageContent"}, function(response) {
          if (chrome.runtime.lastError) {
            showError('Error connecting to the page: ' + chrome.runtime.lastError.message);
            return;
          }
          
          if (response && response.success) {
            // Get the API key
            chrome.storage.local.get(['gemini_api_key'], function(result) {
              if (!result.gemini_api_key) {
                showError('API key not found. Please enter your Gemini API key in the settings.');
                return;
              }
              
              // Forward the content to the background script for API processing
              chrome.runtime.sendMessage({
                action: "summarize",
                content: response.content
              }, function(summaryResponse) {
                if (chrome.runtime.lastError) {
                  showError('Error reaching background script: ' + chrome.runtime.lastError.message);
                  return;
                }
                
                loadingIndicator.classList.add('hidden');
                
                if (summaryResponse && summaryResponse.success) {
                  // Show the summary
                  resultContainer.classList.remove('hidden');
                  summaryContent.innerHTML = formatSummary(summaryResponse.summary);
                } else {
                  // Show error
                  showError(summaryResponse?.error || 'Failed to generate summary');
                }
              });
            });
          } else {
            showError('Failed to extract page content');
          }
        });
      }).catch(err => {
        showError('Failed to inject content script: ' + err.message);
      });
    });
  });
  
  function showError(message) {
    loadingIndicator.classList.add('hidden');
    errorContainer.classList.remove('hidden');
    errorMessage.textContent = message;
    console.error('Extension error:', message);
  }
  
  function formatSummary(text) {
    // Break text into lines
    const lines = text.split('\n');
    let html = '';
    
    // Check if we need to create a list
    let inList = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this line is a bullet point
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        // Start a list if we're not in one
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        
        // Add the list item
        const content = trimmedLine.startsWith('•') ? 
          trimmedLine.substring(1).trim() : 
          trimmedLine.substring(1).trim();
        
        html += `<li>${content}</li>`;
      } else if (trimmedLine.length > 0) {
        // End the list if we were in one
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        
        // Add as paragraph
        html += `<p>${trimmedLine}</p>`;
      }
    }
    
    // Close the list if we're still in one
    if (inList) {
      html += '</ul>';
    }
    
    return html;
  }
});