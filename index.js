const Telegraf = require('telegraf');
const axios = require('axios');
const cheerio = require('cheerio');
const schedule = require('node-schedule');
require('dotenv').config();

// Bot सेटअप
const bot = new Telegraf(process.env.BOT_TOKEN || '');
const targetChannel = process.env.TARGET_CHANNEL || '';
const proxyHost = process.env.PROXY_HOST || 'your_proxy_ip';
const proxyPort = process.env.PROXY_PORT || 8080;
const otherChannels = process.env.OTHER_CHANNELS ? process.env.OTHER_CHANNELS.split(',') : [];

// Proxy कॉन्फिगरेशन
const proxy = {
  protocol: 'http',
  host: proxyHost,
  port: proxyPort
};

// Flipkart से डेटा स्क्रैप
async function scrapeFlipkart() {
  try {
    const url = 'https://www.flipkart.com/search?q=deals'; // सामान्य डील्स खोज
    const response = await axios.get(url, {
      proxy,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const deals = [];

    $('.s1Q9rs').each((i, elem) => {
      if (i < 10) {
        const title = $(elem).find('a._2UzuFa').text().trim() || 'Exclusive Item';
        const price = $(elem).find('div._30jeq3').text().trim() || 'Best Price';
        const originalPrice = $(elem).find('div._3I9_wc').text().trim() || 'N/A';
        const discount = $(elem).find('span._3ayrbg').text().trim() || 'Great Offer';
        const image = $(elem).find('img._2r_T1I').attr('src') || '';

        if (title) {
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

// अन्य चैनलों से डेटा स्क्रैप (बेसिक, इमेज के बिना)
async function scrapeOtherChannels() {
  const deals = [];
  for (const link of otherChannels) {
    try {
      const response = await axios.get(link, {
        proxy,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      $('div.message').each((i, elem) => {
        if (i < 5) {
          const text = $(elem).find('div.text-content').text().trim() || 'Special Offer';
          deals.push({ text });
        }
      });
    } catch (error) {
      console.error(`Channel ${link} Scraping Error:`, error.message);
    }
  }
  return deals;
}

// प्रोफेशनल पोस्टिंग
function createPost(deal, source = 'Online Discovery') {
  let message = '';
  if (deal.title) {
    message += `[Unveiled] Amazing Find: ${deal.title.split(' ').slice(0, 3).join(' ')}\n`;
    message += `Starting at ${deal.price}\n\n`;
    if (deal.image) message += `<a href="${deal.image}">🔍 View</a>\n`;
    message += `${deal.title}\n${deal.price} (${deal.originalPrice} ${deal.discount})\n`;
    message += `Special Rate: ${deal.price}\n\n`;
    message += `More Below 👇\nhttps://t.me/YourChannel`;
  } else if (deal.text) {
    message += `[Secret] Great Offer:\n${deal.text}\n\n`;
    message += `More Below 👇\nhttps://t.me/YourChannel`;
  }
  return message.trim();
}

// शेड्यूलिंग
schedule.scheduleJob('0 */4 * * *', async () => {
  const flipkartDeals = await scrapeFlipkart();
  flipkartDeals.forEach(deal => {
    const post = createPost(deal);
    if (post && targetChannel) {
      bot.telegram.sendMessage(targetChannel, post, { parse_mode: 'HTML' })
        .catch(err => console.error('Send Error:', err.message));
    }
  });

  const channelDeals = await scrapeOtherChannels();
  channelDeals.forEach(deal => {
    const post = createPost(deal);
    if (post && targetChannel) {
      bot.telegram.sendMessage(targetChannel, post, { parse_mode: 'HTML' })
        .catch(err => console.error('Send Error:', err.message));
    }
  });
});

// Bot शुरू करें
bot.launch().catch(err => console.error('Bot Launch Error:', err.message));
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
