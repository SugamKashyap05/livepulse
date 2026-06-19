import { getPaginatedFeed } from "./src/lib/paginatedFeed"

async function check() {
    const feed = await getPaginatedFeed({ scope: "home", limit: 5 });
    console.log("Feed returned:", feed.articles.length, "articles");
}

check().catch(console.error)
