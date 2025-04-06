// Ensure this script announces its presence
console.log("Content script loaded");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);

  if (message.action === "getPageContent") {
    try {
      // Get the readable content from the page
      const pageContent = extractReadableContent();
      console.log("Content extracted successfully");
      sendResponse({ success: true, content: pageContent });
    } catch (error) {
      console.error("Error extracting content:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Return true to indicate we'll handle the response asynchronously
  return true;
});

function extractReadableContent() {
  // Get the main content of the page
  // This is a simple implementation; you might want to use a more sophisticated approach

  // Remove script and style elements
  const bodyClone = document.body.cloneNode(true);
  const scriptsAndStyles = bodyClone.querySelectorAll(
    "script, style, nav, footer, header, aside"
  );
  scriptsAndStyles.forEach((element) => element.remove());

  // Get the text content
  let content = "";

  // First try to get content from article, main, or similar elements
  const mainContentElements = bodyClone.querySelectorAll(
    "article, main, .content, .main, #content, #main"
  );
  if (mainContentElements.length > 0) {
    mainContentElements.forEach((element) => {
      content += element.textContent + "\n";
    });
  } else {
    // If no specific content elements found, get paragraphs
    const paragraphs = bodyClone.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
    paragraphs.forEach((element) => {
      content += element.textContent + "\n";
    });
  }

  // Clean up the content
  content = content.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();

  return content;
}
