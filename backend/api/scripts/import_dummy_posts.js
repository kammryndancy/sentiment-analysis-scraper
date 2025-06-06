// Script to import dummy_scraped_posts.json into the MongoDB posts collection
import fs from 'fs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGO_DB || 'tonique';
const collectionName = process.env.MONGO_SCRAPED_POSTS_COLLECTION || 'scraped_posts';

async function importDummyPosts() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const posts = JSON.parse(fs.readFileSync('./scripts/dummy_scraped_posts.json', 'utf-8'));
    // Convert string dates to Date objects for created_time
    posts.forEach(post => {
      if (post.created_time && typeof post.created_time === 'string') {
        post.created_time = new Date(post.created_time);
      }
    });
    // Remove all existing dummy posts (optional, comment out if not desired)
    await collection.deleteMany({});
    await collection.insertMany(posts);
    console.log(`${posts.length} dummy posts imported into collection '${collectionName}'.`);
    await client.close();
  } catch (err) {
    console.error('Failed to import dummy posts:', err);
    process.exit(1);
  }
}

importDummyPosts();
