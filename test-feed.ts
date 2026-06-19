import { fetchAllFeeds } from './src/lib/fetchFeeds';

async function test() {
  console.log('Starting fetch...');
  try {
    const feeds = await fetchAllFeeds();
    console.log(`Fetched ${feeds.length} articles`);
    if (feeds.length > 0) {
      console.log('Sample:', feeds[0]);
    }
  } catch (err) {
    console.error('Error fetching feeds:', err);
  }
}

test();
