chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "inject") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      
      // First inject the processFriendsList function
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Define processFriendsList in the page context
          window.processFriendsList = async function() {
            try {
              const data = await chrome.storage.local.get(['friendsToScrape', 'currentIndex', 'scrapedData', 'shouldStopScraping']);
              const { friendsToScrape, currentIndex, scrapedData, shouldStopScraping } = data;

              // Check if scraping should stop
              if (shouldStopScraping) {
                await chrome.storage.local.remove(['friendsToScrape', 'currentIndex', 'shouldStopScraping']);
                await chrome.storage.local.set({ scrapedData });
                // Notify popup that scraping is finished
                chrome.runtime.sendMessage({ action: 'scrapingFinished' });
                return scrapedData.join('\n');
              }

              if (currentIndex >= friendsToScrape.length) {
                const finalResult = scrapedData.join('\n');
                await chrome.storage.local.remove(['friendsToScrape', 'currentIndex', 'shouldStopScraping']);
                await chrome.storage.local.set({ scrapedData });
                // Notify popup that scraping is finished
                chrome.runtime.sendMessage({ action: 'scrapingFinished' });
                return finalResult;
              }

              const currentFriend = friendsToScrape[currentIndex];
              
              // Send message to background script to handle fetching
              const aboutContent = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                  action: 'fetchAboutPage',
                  url: currentFriend.sections
                }, response => {
                  resolve(response.content);
                });
              });

              scrapedData.push(`### ${currentFriend.name}
**Profile URL:** ${currentFriend.href}

${aboutContent}
___
`);

              await chrome.storage.local.set({
                currentIndex: currentIndex + 1,
                scrapedData
              });

              // Notify popup to update display
              chrome.runtime.sendMessage({
                action: 'updateDisplay',
                data: scrapedData.join('\n')
              });

              return processFriendsList();
            } catch (error) {
              console.error('Error in processFriendsList:', error);
              return `Error processing friends list: ${error.message}`;
            }
          };
        }
      }).then(() => {
        return chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: request.scrapeType === "scrapeSpecific" ? scrapeSpecificContent : scrapeAllContent,
        });
      }).then(async injectionResults => {
        const result = injectionResults[0].result;
        if (result instanceof Promise) {
          const resolvedResult = await result;
          sendResponse({ result: resolvedResult });
        } else {
          sendResponse({ result });
        }
      }).catch(err => {
        sendResponse({ error: err.message });
      });
    });
    return true;
  }

  // Handle fetchAboutPage requests
  if (request.action === "fetchAboutPage") {
    (async () => {
      try {
        const cookies = await chrome.cookies.getAll({ domain: ".facebook.com" });
        const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        // Create arrays to store section data
        const sectionData = {};
        
        // Create a tab for scraping
        const tab = await chrome.tabs.create({ 
          url: request.url.overview,
          active: false 
        });

        // Function to scrape a specific section
        const scrapeSection = async (url, sectionName) => {
          await chrome.tabs.update(tab.id, { url: url });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const [content] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const xpaths = [
                '/html/body/div[1]/div/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div[4]/div/div/div/div[1]/div/div/div/div/div[2]/div',
                '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div[4]/div/div/div/div[1]/div/div/div/div/div[2]/div'
            ];

              for (const xpath of xpaths) {
                const result = document.evaluate(
                  xpath,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null
                );
                
                const element = result.singleNodeValue;
                if (element && element.innerText.trim()) {
                  console.log(`Found content using XPath: ${xpath}`);
                  return element.innerText;
                }
              }
              
              return '(Not found)';
            }
          });
          
          return content.result;
        };

        // Scrape all sections
        sectionData.overview = await scrapeSection(request.url.overview, 'Overview');
        sectionData.work = await scrapeSection(request.url.work, 'Work and Education');
        sectionData.places = await scrapeSection(request.url.places, 'Places Lived');
        sectionData.contact = await scrapeSection(request.url.contact, 'Contact and Basic Info');

        // Close the tab
        await chrome.tabs.remove(tab.id);

        // Format the combined content
        const combinedContent = `
**Overview**
${sectionData.overview}

**Work and Education**
${sectionData.work}

**Places Lived**
${sectionData.places}

**Contact and Basic Info**
${sectionData.contact}
`;

        sendResponse({ content: combinedContent });
      } catch (error) {
        console.error('Fetch error:', error);
        sendResponse({ content: `Error fetching data: ${error.message}` });
      }
    })();
    return true;
  }
});

function scrapeSpecificContent() {
  try {
    const xpaths = [
      '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div[1]/div/div[2]/div[1]/div[2]/div',
      '/html/body/div[1]/div/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div[1]/div/div[2]/div[1]/div[2]/div',
      '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[2]/div[1]/div[1]/div/div[2]/div[1]/div[2]/div',
      '/html/body/div[1]/div/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div[4]/div/div/div/div[1]/div/div/div/div/div[3]',
      '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div[4]/div/div/div/div/div/div/div/div/div[3]',
      '/html/body/div[1]/div/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div/div[4]/div/div/div/div/div/div/div/div/div[3]',
      '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div[1]/div'
    ];

    let element = null;

    for (const xpath of xpaths) {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      element = result.singleNodeValue;

      if (element) {
        console.log(`Found element with XPath: ${xpath}`);
        break;
      }
    }

    if (element) {   
      const childDivs = element.children;
      const friends = Array.from(childDivs)
        .filter(div => div.getAttribute('role') !== 'button')
        .map(div => {
          const anchor = div.querySelector('a');
          if (anchor) {
            const baseUrl = anchor.href;
            // Check if it's a profile.php URL
            const isProfilePhpUrl = baseUrl.includes('profile.php');
            
            // Generate section URLs based on URL type
            const sections = isProfilePhpUrl ? {
              overview: `${baseUrl}&sk=about_overview`,
              work: `${baseUrl}&sk=about_work_and_education`,
              places: `${baseUrl}&sk=about_places`,
              contact: `${baseUrl}&sk=about_contact_and_basic_info`
            } : {
              overview: `${baseUrl}/about_overview`,
              work: `${baseUrl}/about_work_and_education`,
              places: `${baseUrl}/about_places`,
              contact: `${baseUrl}/about_contact_and_basic_info`
            };

            return {
              name: anchor.innerText.trim(),
              href: baseUrl,
              sections
            };
          }
          return null;
        })
        .filter(friend => friend !== null);

      chrome.storage.local.set({ 
        friendsToScrape: friends,
        currentIndex: 0,
        scrapedData: []
      });

      return window.processFriendsList();
    } else {
      return 'No matching element found';
    }
  } catch (error) {
    return `Error during specific scraping: ${error.message}`;
  }
}

function scrapeAllContent() {
  try {
    const bodyContent = document.body.innerText;
    return bodyContent.length > 0 ? bodyContent : 'No content found.';
  } catch (error) {
    return `Error during all content scraping: ${error.message}`;
  }
}
