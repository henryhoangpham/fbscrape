document.addEventListener('DOMContentLoaded', async () => {
  // Load and display previously scraped data
  const resultDiv = document.getElementById('result');
  const finishButton = document.getElementById('finishButton');
  const data = await chrome.storage.local.get(['scrapedData', 'isScrapingInProgress']);
  
  if (data.scrapedData && data.scrapedData.length > 0) {
    resultDiv.innerHTML = data.scrapedData.join('\n\n').replace(/\n/g, '<br>');
  }

  // Show finish button if scraping was in progress
  if (data.isScrapingInProgress) {
    finishButton.style.display = 'flex';
  }

  // Add event listeners for buttons
  document.getElementById('scrapeButton').addEventListener('click', () => {
    finishButton.style.display = 'flex';
    chrome.storage.local.set({ isScrapingInProgress: true });
    scrape('scrapeSpecific');
  });
  
  document.getElementById('scrapeAllButton').addEventListener('click', () => {
    scrape('scrapeAll');
  });

  document.getElementById('copyButton').addEventListener('click', () => {
    copyToClipboard();
  });

  document.getElementById('clearButton').addEventListener('click', async () => {
    await chrome.storage.local.clear();
    resultDiv.innerHTML = '';
    finishButton.style.display = 'none';
  });

  finishButton.addEventListener('click', async () => {
    // Set a flag in storage to indicate scraping should stop
    await chrome.storage.local.set({ shouldStopScraping: true });
    finishButton.style.display = 'none';
    await chrome.storage.local.set({ isScrapingInProgress: false });
  });
});

// Add message listener for display updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateDisplay') {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = request.data.replace(/\n/g, '<br>');
    // Scroll to the bottom to show the latest content
    resultDiv.scrollTop = resultDiv.scrollHeight;
  } else if (request.action === 'scrapingFinished') {
    // Hide finish button when scraping is complete
    document.getElementById('finishButton').style.display = 'none';
    chrome.storage.local.set({ isScrapingInProgress: false });
  }
});

function scrape(scrapeType) {
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = 'Scraping...';
  
  chrome.runtime.sendMessage({ 
    action: 'inject',
    scrapeType: scrapeType 
  }, response => {
    if (chrome.runtime.lastError) {
      resultDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }
    
    if (response.error) {
      resultDiv.textContent = `Error: ${response.error}`;
    } else {
      resultDiv.innerHTML = response.result ? response.result.replace(/\n/g, '<br>') : 'No content found';
    }
  });
}

function copyToClipboard() {
  const resultDiv = document.getElementById('result');
  const textToCopy = resultDiv.textContent;

  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      alert('Content copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
    });
}