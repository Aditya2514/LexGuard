const axios = require('axios');
const cheerio = require('cheerio');

async function testTOC(docId) {
  const url = `https://indiankanoon.org/doc/${docId}/`;
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(response.data);
    let links = [];
    $('a').each((i, el) => {
      if (links.length < 50 && $(el).attr('href')) {
        links.push({ text: $(el).text().trim().substring(0, 30), href: $(el).attr('href').substring(0, 30) });
      }
    });
    console.log(`\nDocID: ${docId}`);
    console.table(links);
  } catch (err) {
    console.error(err.message);
  }
}

testTOC('1905549'); // IT Act
testTOC('142106096'); // Consumer Protection Act
