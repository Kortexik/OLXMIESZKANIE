import { readFileSync, writeFileSync, existsSync } from 'fs';
import { QUERY_URL, CHAT_ID, TOKEN, INCLUDED_SUBDIVISIONS } from './const.js';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';


const SEEN_PATH = './data/seen.json';

function loadSeenLinks() {
  if (!existsSync(SEEN_PATH)) return new Set();
  const data = JSON.parse(readFileSync(SEEN_PATH));
  return new Set(data);
}

function saveSeenLinks(links) {
  writeFileSync(SEEN_PATH, JSON.stringify(Array.from(links), null, 2));
}

async function sendTelegramPhotoGroup({ title, price, description, link, photoLinks }) {

  const url = `https://api.telegram.org/bot${TOKEN}/sendMediaGroup`;

  const media = photoLinks.slice(0, 10).map((photo, idx) => ({
    type: "photo",
    media: photo,
    ...(idx === 0 && {
      caption: `🆕 ${title}\n💰 ${price}\n📝 Opis:\n${description}\n🔗 ${link}`
    })
  }));

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      media
    })
  });
}

async function getOfferDescription(browser, link) {
  const page = await browser.newPage();
  await page.goto(link, { waitUntil: 'load', timeout: 90000 });
  const result = await page.evaluate(() => {
    const description = document.querySelector('div[data-cy="ad_description"] div')?.innerText || '';
    const photoLinks = Array.from(document.querySelectorAll('div.swiper-zoom-container img'))
      .map(img => img.src)
      .filter(Boolean);
    return { description, photoLinks };
  });
  await page.close();
  return result;
}

async function scrapeOlx() {
  const seenLinks = loadSeenLinks();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(QUERY_URL, { waitUntil: 'load', timeout: 90000 });

  const listings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div[data-cy="l-card"]')).map(card => {
      const title = card.querySelector('[data-cy="ad-card-title"]')?.innerText.split('\n')[0];
      const link = card.querySelector('a')?.href;
      const price = card.querySelector('[data-testid="ad-price"]')?.innerText;
      const img = card.querySelector('img')?.src;
      const location = card.querySelector('[data-testid="location-date"]')?.innerText?.split('-')[0]?.trim().toLowerCase() || '';
      return { title, link, price, img, location };
    });
  });

  const inLocationScopeListings = listings.filter(item =>
    INCLUDED_SUBDIVISIONS.some(sub => item.location.includes(sub))
  );

  const newListings = inLocationScopeListings.filter(item => !seenLinks.has(item.link));

  if (newListings.length > 0) {
    for (const item of newListings) {
      const { description, photoLinks } = await getOfferDescription(browser, item.link);
      await sendTelegramPhotoGroup({
        title: item.title,
        price: item.price,
        description,
        link: item.link,
        photoLinks
      });
    }
    newListings.forEach(item => seenLinks.add(item.link));
    saveSeenLinks(seenLinks);
  }

  await browser.close();
}


scrapeOlx();
