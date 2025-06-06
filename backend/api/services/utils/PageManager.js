const FB = require('fb');
const fs = require('fs');
const path = require('path');
const KeywordManager = require('./KeywordManager');

class PageManager {
  constructor(db, fbPromise) {
    this.db = db;
    this.page_ids_collection = db.collection(process.env.MONGO_PAGE_IDS_COLLECTION || 'page_ids');
    this.scraped_posts = db.collection(process.env.MONGO_SCRAPED_POSTS_COLLECTION || 'scraped_posts');
    this.saved_posts = db.collection(process.env.MONGO_SAVED_POSTS_COLLECTION || 'saved_posts');
    this.fbPromise = fbPromise;
    this.keywordManager = new KeywordManager(db);
  }

  // Initialize page IDs from JSON file
  async initializePageIds() {
    try {
      // Get existing page IDs
      const existingPageIds = await this.page_ids_collection.find({}).toArray();

      if (existingPageIds.length === 0) {
        // Load page IDs from JSON file
        const defaultPagesPath = path.resolve(process.cwd(), 'page_ids.json');

        if (fs.existsSync(defaultPagesPath)) {
          // Load page IDs from JSON file
          const pageIdsData = fs.readFileSync(defaultPagesPath, 'utf8');
          let pageIds = JSON.parse(pageIdsData);
          // Add enabled: true by default if not present
          pageIds = pageIds.map(p => ({ ...p, enabled: p.enabled !== false, added_at: new Date(), last_updated: new Date() }));
          await this.page_ids_collection.insertMany(pageIds);
        }
      }
    } catch (err) {
      console.error('Failed to initialize page ids:', err);
    }
  }

  // Add a page ID to the database
  async addPageId(pageId, name = null, description = null) {
    try {
      // Check if the page exists on Facebook
      try {
        const pageInfo = await this.fbPromise('get', `/${pageId}`);

        // If no name was provided, use the one from Facebook
        if (!name && pageInfo.name) {
          name = pageInfo.name;
        }
      } catch (fbError) {
        console.warn(`Could not fetch page info from Facebook: ${fbError.message}`);
        // Continue anyway, as the page ID might be valid but not accessible
      }

      // Prepare document for MongoDB
      const pageDoc = {
        page_id: pageId,
        name,
        description,
        last_scraped: null,
        added_at: new Date(),
        last_updated: new Date(),
        enabled: true // Add enabled: true by default
      };

      // Insert or update page in MongoDB
      const result = await this.page_ids_collection.updateOne(
        { page_id: pageId },
        { $set: pageDoc },
        { upsert: true }
      );

      return {
        success: true,
        message: result.upsertedCount > 0
          ? `Added new page ID: ${pageId}`
          : `Updated existing page ID: ${pageId}`
      };
    } catch (error) {
      console.error('Error adding page ID:', error);
      return { success: false, message: error.message };
    }
  }

  // Remove a page ID from the database
  async removePageId(pageId) {
    try {
      const result = await this.page_ids_collection.deleteOne({ page_id: pageId });

      if (result.deletedCount === 0) {
        return { success: false, message: `Page ID not found: ${pageId}` };
      }

      return { success: true, message: `Removed page ID: ${pageId}` };
    } catch (error) {
      console.error('Error removing page ID:', error);
      return { success: false, message: error.message };
    }
  }

  // Get all page IDs from the database
  async getPageIds() {
    try {
      const pages = await this.page_ids_collection.find({}).toArray();
      return pages.map(p => p.page_id);
    } catch (error) {
      console.error('Error getting page IDs:', error);
      return [];
    }
  }

  // Only return enabled page ids
  async getEnabledPageIds() {
    return this.page_ids_collection.find({ enabled: true }).toArray();
  }

  // List all pages in the database with details
  async listPages() {
    try {
      return await this.page_ids_collection.find({}).toArray();
    } catch (error) {
      console.error('Error listing pages:', error);
      return [];
    }
  }

  // Update the last_scraped timestamp for a page
  async updatePageLastScraped(pageId) {
    try {
      await this.page_ids_collection.updateOne(
        { page_id: pageId },
        { $set: { last_scraped: new Date(), last_updated: new Date() } }
      );
    } catch (error) {
      console.error(`Error updating last_scraped for page ${pageId}:`, error);
    }
  }

  // Fetch posts from a Facebook page, filtering out already scraped posts
  async getPagePosts(pageId, limit = 100, daysBack = 30) {
    try {
      // Calculate the date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);

      // Get the page's last scraped timestamp
      const page = await this.page_ids_collection.findOne({ page_id: pageId });

      // Get already scraped post IDs for this page
      const existingPostIds = await this.scraped_posts
        .find({ page_id: pageId })
        .project({ post_id: 1 })
        .toArray();

      const existingPostIdSet = new Set(existingPostIds.map(p => p.post_id));

      // Fetch posts from Facebook
      const path = `/${pageId}/posts`;
      const params = {
        limit,
        fields: 'id,message,created_time,likes.summary(true),reactions.summary(true),comments.limit(25){id,message,from,created_time,like_count,comment_count,user_likes,reactions.summary(true)}'
      };

      const response = await this.fbPromise('get', path, params);

      if (!response || !response.data) {
        return [];
      }

      // Filter out already scraped posts and posts older than the threshold
      const newPosts = response.data.filter(post => {
        // Skip if already scraped
        if (existingPostIdSet.has(post.id)) {
          return false;
        }
        // Skip if older than threshold
        const postDate = new Date(post.created_time);
        if (postDate < dateThreshold) {
          return false;
        }
        return true;
      });

      // Save the new posts to the scraped_posts collection
      // Only include posts where post.message contains at least one enabled keyword
      if (newPosts.length > 0) {
        // Fetch enabled keywords from the keyword manager
        const enabledKeywords = await this.keywordManager.getEnabledKeywords();
        const keywordList = enabledKeywords.map(k => k.keyword);
        const filteredPosts = newPosts.filter(post => {
          if (!post.message || !Array.isArray(keywordList) || keywordList.length === 0) return false;
          const msg = post.message.toLowerCase();
          return keywordList.some(kw => msg.includes(kw.toLowerCase()));
        });
        if (filteredPosts.length > 0) {
          const scrapedPostDocs = await Promise.all(filteredPosts.map(async post => {
            const msg = post.message || '';
            // Use keywordManager to extract matched keywords
            const matched_keywords = await this.keywordManager.extractMatchedKeywords(msg);
            return {
              post_id: post.id,
              page_id: pageId,
              created_time: new Date(post.created_time),
              likes: post.likes ? post.likes.summary ? post.likes.summary.total_count : post.likes : 0,
              reactions: post.reactions ? post.reactions.data : [],
              message: msg,
              matched_keywords,
              scraped_at: new Date()
            };
          }));
          await this.scraped_posts.insertMany(scrapedPostDocs);
        }
      }

      console.log(`Found ${newPosts.length} new posts for page ${pageId}`);
      return newPosts;
    } catch (error) {
      console.error(`Error getting posts for page ${pageId}:`, error);
      return [];
    }
  }

  // Save a post to the saved_posts collection
  async savePost(post, pageId) {
    try {
      // Prepare document for MongoDB
      const postDoc = {
        post_id: post.id,
        page_id: pageId,
        message: post.message,
        created_time: new Date(post.created_time),
        scraped_at: new Date(),
        // Save likes and reactions summary if present
        likes: post.likes ? post.likes.summary ? post.likes.summary.total_count : post.likes : 0,
        reactions: post.reactions ? post.reactions.data : [],
        matched_keywords: post.matched_keywords || [],
      };

      // Insert post in MongoDB
      await this.saved_posts.insertOne(postDoc);
    } catch (error) {
      console.error(`Error saving post ${post.id}:`, error);
    }
  }
}

module.exports = PageManager;
