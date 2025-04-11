const FacebookScraper = require('../services/facebookScraper');

exports.runScraper = async (req, res) => {
  try {
    const scraper = req.app.locals.scraper;
    const { pageIds, daysBack = 30 } = req.body;

    if (!pageIds) {
      return res.status(400).json({
        success: false,
        error: 'Page IDs array is required'
      });
    }

    if (!Array.isArray(pageIds)) {
      return res.status(400).json({
        success: false,
        error: 'Page IDs must be an array'
      });
    }

    if (pageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Page IDs array cannot be empty'
      });
    }

    const result = await scraper.scrapePages(pageIds, daysBack);

    if (result.success) {
      res.status(202).json({
        success: true,
        message: 'Scraper started successfully',
        stats: result.stats
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error starting scraper:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getComments = async (req, res) => {
  try {
    const scraper = req.app.locals.scraper;
    const { startDate, endDate, pageId, limit = 100, skip = 0 } = req.query;

    // Convert query parameters to proper format
    const queryParams = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      pageId,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    // Use the comment manager directly since FacebookScraper doesn't have a getComments method
    const comments = await scraper.commentManager.getComments(queryParams);

    res.status(200).json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getStats = async (req, res) => {
  try {
    const scraper = req.app.locals.scraper;
    const stats = await scraper.commentManager.getStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
