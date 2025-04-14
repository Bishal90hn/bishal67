
const Telegraf = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Bot Token और चैनल ID
const bot = new Telegraf(process.env.BOT_TOKEN);
const targetChannel = process.env.TARGET_CHANNEL; // अपना चैनल ID, जैसे -100123456789

// Proxy सेटअप (free-proxy-list.net से IP लें)
const proxy = {
  host: process.env.PROXY_HOST || 'your_proxy_ip', // Proxy IP यहाँ डालें
  port: process.env.PROXY_PORT || 8080
};

// अन्य चैनल लिंक (कोई भी नहीं दिखेगा, आप .env में डालें)
const channelLinks = process.env.OTHER_CHANNELS ? process.env.OTHER_CHANNELS.split(',') : [];

// Flipkart से Hidden Deals स्क्रैप
async function scrapeFlipkart() {
  try {
    const url = 'https://www.flipkart.com/search?q=hidden+deals'; // अनुकूलित खोज
    const response = await axios.get(url, {
      proxy: {
        protocol: 'http',
        host: proxy.host,
        port: proxy.port
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const deals = [];

    $('.s1Q9rs').each((i, elem) => {
      if (i < 10) { // 10 Deals तक
        const title = $(elem).find('a._2UzuFa').text().trim();
        const price = $(elem).find('div._30jeq3').text().trim();
        const originalPrice = $(elem).find('div._3I9_wc').text().trim() || 'N/A';
        const discount = $(elem).find('span._3ayrbg').text().trim() || 'Great Savings';
        const image = $(elem).find('img._2r_T1I').attr('src');

        if (title && price) {
          deals.push({ title, price, originalPrice, discount, image });
        }
      }
    });

    return deals;
  } catch (error) {
    console.error('Flipkart Scraping Error:', error.message);
    return [];
  }
}

// अन्य Telegram चैनल से डेटा स्क्रैप
async function scrapeOtherChannels() {
  const deals = [];
  for (const link of channelLinks) {
    try {
      const response = await axios.get(link, {
        proxy: {
          protocol: 'http',
          host: proxy.host,
          port: proxy.port
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      $('div.message').each((i, elem) => {
        if (i < 5) { // 5 पोस्ट तक
          let text = $(elem).find('div.text-content').text().trim();
          let image = $(elem).find('img').attr('src') || null;

          if (!image && text.includes('http')) {
            const linkMatch = text.match(/https?:\/\/[^\s]+/);
            if (linkMatch) {
              const linkResponse = await axios.get(linkMatch[0], { responseType: 'arraybuffer' });
              image = `data:image/jpeg;base64,${Buffer.from(linkResponse.data, 'binary').toString('base64')}`;
            }
          }

          if (text) {
            text = rephraseContent(text); // कॉपीराइट से बचने के लिए री-राइट
            deals.push({ text, image });
          }
        }
      });
    } catch (error) {
      console.error(`Channel ${link} Scraping Error:`, error.message);
    }
  }
  return deals;
}

// कंटेंट को री-राइट करने का फंक्शन (कॉपीराइट से बचाव)
function rephraseContent(text) {
  // सरल पैराफ्रेजिंग, वास्तविक लॉजिक को अनुकूलित करें
  return text
    .replace(/deal/i, 'exclusive offer')
    .replace(/loot/i, 'special savings')
    .replace(/price/i, 'cost')
    .replace(/discount/i, 'reduction')
    .split('. ')
    .map(sentence => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join('. ') + '.';
}

// प्रोफेशनल पोस्टिंग
function createPost(deal, source = 'Online Find') {
  let message = '';
  if (deal.title || deal.text) {
    message += `[Unveiled] Amazing Find: ${deal.title || deal.text.split(' ').slice(0, 3).join(' ')}\n`;
    message += `Starting at ${deal.price || 'Best Price'}\n\n`;
    if (deal.image) {
      message += `<a href="${deal.image}">🔍 Check Visual</a>\n`;
    }
    message += `${deal.title || deal.text}\n`;
    message += `${deal.price || 'Limited Offer'} (${deal.originalPrice || 'Original Cost'} ${deal.discount || 'Huge Savings'})\n`;
    message += `Special Rate: ${deal.price || 'Grab Now'}\n\n`;
    message += `More Exciting Finds Below 👇\nhttps://t.me/YourSecretChannel`;
  } else if (deal.text) {
    message += `[Secret] Great Offer:\n${deal.text}\n\n`;
    if (deal.image) message += `<a href="${deal.image}">🔍 View Image</a>\n`;
    message += `More Surprises Below 👇\nhttps://t.me/YourSecretChannel`;
  }
  return message.trim();
}

// शेड्यूलिंग
schedule.scheduleJob('0 */3 * * *', async () => { // हर 3 घंटे में
  // Flipkart से डेटा
  const flipkartDeals = await scrapeFlipkart();
  flipkartDeals.forEach(deal => {
    const post = createPost(deal);
    bot.telegram.sendMessage(targetChannel, post, { parse_mode: 'HTML' });
  });

  // अन्य चैनलों से डेटा
  const channelDeals = await scrapeOtherChannels();
  channelDeals.forEach(deal => {
    const post = createPost(deal);
    bot.telegram.sendMessage(targetChannel, { parse_mode: 'HTML' });
  });
});

// Bot शुरू करें
bot.launch();
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
