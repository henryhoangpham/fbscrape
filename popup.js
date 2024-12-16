document.addEventListener('DOMContentLoaded', async () => {
  // Load and display previously scraped data
  const resultDiv = document.getElementById('result');
  const finishButton = document.getElementById('finishButton');
  const data = await chrome.storage.local.get(['scrapedData', 'isScrapingInProgress']);
  
  if (data.scrapedData && data.scrapedData.length > 0) {
    updateDisplay(data.scrapedData.join('\n\n'));
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
    updateDisplay(request.data);
    const resultDiv = document.getElementById('result');
    resultDiv.scrollTop = resultDiv.scrollHeight;
  } else if (request.action === 'scrapingFinished') {
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
      updateDisplay(response.result || 'No content found');
    }
  });
}

function copyToClipboard() {
  const resultDiv = document.getElementById('result');
  // Convert HTML back to markdown
  const textToCopy = resultDiv.innerHTML
    .replace(/<h3>(.*?)<\/h3>/g, '### $1')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<hr\s*\/?>/g, '___')
    .replace(/&nbsp;/g, ' ')
    .replace(/(<([^>]+)>)/gi, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      alert('Content copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
    });
}

function updateDisplay(text) {
  const resultDiv = document.getElementById('result');
  // Convert markdown to HTML
  resultDiv.innerHTML = text
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/___/g, '<hr>');
}