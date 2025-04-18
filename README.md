# sentiment-analysis-scraper
A data scraping module for social media platforms

## Node.js API for Facebook Sentiment Analysis

This module provides a RESTful API for scraping Facebook pages for posts and comments, then filtering and storing comments related to Avon products in a MongoDB database.

### Features

- RESTful API for scraping and data management
- Scrape posts from multiple Facebook pages using page IDs
- Extract all comments from these posts
- Filter comments for Avon product-related content using keyword matching
- Store filtered comments in MongoDB for further analysis
- Rate limit handling to avoid API restrictions
- **Incremental scraping**: Only processes new, unscraped posts and comments
- **Time-based filtering**: Specify how many days back to scrape
- **Page management**: Store and manage Facebook page IDs in MongoDB
- **Keyword management**: Configure and manage Avon-related keywords in MongoDB

### Requirements

- Node.js 14+
- Facebook Developer Account and Access Token
- MongoDB (local or cloud instance)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/sentiment-analysis-scraper.git
   cd sentiment-analysis-scraper
   ```

2. Install required dependencies:
   ```
   npm install
   ```

3. Configure your environment variables:
   - Copy `.env.example` to `.env`
   - Add your Facebook app ID, app secret, access token, and MongoDB connection details

### Usage

Start the API server:
```
npm start
```

For development with auto-restart:
```
npm run dev
```

### API Endpoints

#### Page Management

- **GET /api/pages** - List all Facebook pages
- **POST /api/pages** - Add a new Facebook page
  ```json
  {
    "pageId": "AvonInsider",
    "name": "Avon Insider",
    "description": "Official Avon page"
  }
  ```
- **DELETE /api/pages/:pageId** - Remove a Facebook page
- **POST /api/pages/import** - Import multiple page IDs
  ```json
  {
    "pageIds": ["AvonInsider", "AvonUK", "AvonUSA"]
  }
  ```

#### Keyword Management

- **GET /api/keywords** - List all keywords
- **POST /api/keywords** - Add a new keyword
  ```json
  {
    "keyword": "avon true",
    "category": "makeup",
    "description": "Avon's makeup line"
  }
  ```
- **DELETE /api/keywords/:keyword** - Remove a keyword
- **POST /api/keywords/import** - Import multiple keywords
  ```json
  {
    "keywords": [
      {
        "keyword": "avon true",
        "category": "makeup",
        "description": "Avon's makeup line"
      },
      "avon brochure",
      "avon campaign"
    ]
  }
  ```

#### Scraper Operations

- **POST /api/scraper/run** - Run the scraper
  ```json
  {
    "pageIds": ["AvonInsider", "AvonUK"],  // Optional, uses all pages if not provided
    "daysBack": 30  // Optional, defaults to 30
  }
  ```
- **GET /api/scraper/status** - Get scraper status (last run times)
- **GET /api/scraper/comments** - Get Avon-related comments
  - Query parameters:
    - `pageId` - Filter by page ID
    - `startDate` - Filter by start date (ISO format)
    - `endDate` - Filter by end date (ISO format)
    - `limit` - Limit results (default: 100)
    - `skip` - Skip results for pagination (default: 0)
- **GET /api/scraper/stats** - Get statistics about the scraped data

### Data Processing

The application includes a data processing module for cleaning, anonymizing, and analyzing text data.

### DataProcessorManager

The `DataProcessorManager` class in `services/utils/dataProcessorManager.js` is responsible for orchestrating the data processing workflow. It utilizes the following utility functions:

### Text Preprocessing

The `text-preprocessor.js` module in `services/utils/dataProcessing/` provides functions for text normalization, tokenization, stopword removal, and lemmatization.

### Anonymization

The `anonymizer.js` module in `services/utils/anonymization/` provides functions for masking personally identifiable information (PII) in text data.

### MongoDB Structure

The scraper uses four MongoDB collections:

1. **facebook_comments**: Stores Avon-related comments with the following structure:
   ```json
   {
     "comment_id": "123456789_12345",
     "post_id": "123456789",
     "page_id": "avon_page_id",
     "message": "I love the new Avon Anew serum!",
     "created_time": "2023-01-15T14:22:15+0000",
     "from_id": "user_id",
     "from_name": "User Name",
     "scraped_at": "2023-01-16T08:30:45"
   }
   ```

2. **scraped_posts**: Tracks which posts have already been scraped:
   ```json
   {
     "post_id": "123456789",
     "page_id": "avon_page_id",
     "created_time": "2023-01-15T14:22:15+0000",
     "last_scraped": "2023-01-16T08:30:45"
   }
   ```

3. **page_ids**: Stores Facebook pages to be scraped:
   ```json
   {
     "page_id": "AvonInsider",
     "name": "Avon Insider",
     "description": "Official Avon page",
     "added_at": "2023-01-15T14:22:15+0000",
     "last_scraped": "2023-01-16T08:30:45"
   }
   ```

4. **keywords**: Stores Avon-related keywords for filtering comments:
   ```json
   {
     "keyword": "avon true",
     "category": "makeup",
     "description": "Avon's makeup line",
     "is_default": false,
     "added_at": "2023-01-15T14:22:15+0000",
     "last_updated": "2023-01-16T08:30:45"
   }
   ```

### Keyword Format for Import

You can import keywords in two formats:

1. Simple string list:
   ```json
   [
     "avon lipstick",
     "avon mascara",
     "avon foundation"
   ]
   ```

2. Detailed format with metadata:
   ```json
   [
     {
       "keyword": "avon true",
       "category": "makeup",
       "description": "Avon's makeup line"
     },
     {
       "keyword": "anew clinical",
       "category": "skincare",
       "description": "Advanced anti-aging skincare"
     }
   ]
   ```

### Important Notes

- Ensure your Facebook access token has the necessary permissions
- Be mindful of Facebook's rate limits and terms of service
- This tool is intended for research purposes only
- The scraper will only process new posts and comments that haven't been scraped before
- Default keywords are automatically added if no keywords exist in the database

### AWS Deployment Instructions

To deploy this application to AWS, follow these steps:

1. **Prerequisites**
   - AWS CLI installed and configured with appropriate permissions
   - AWS account with necessary permissions for:
     - EC2
     - RDS
     - ElastiCache
     - Elastic Beanstalk
     - CloudFormation
     - S3
     - CloudWatch
     - SNS

2. **Configure AWS CLI**
   ```bash
   # Configure your AWS credentials
   aws configure
   
   # Verify configuration
   aws sts get-caller-identity
   ```

3. **Prepare Application for Deployment**
   ```bash
   # Build your application
   npm run build
   
   # Create deployment package
   zip -r sentiment-analysis-app.zip . -x "*.git*" "node_modules/*" "*.zip"
   ```

4. **Deploy to AWS**
   ```bash
   # Make the deployment script executable
   chmod +x deploy.sh
   
   # Run the deployment script
   ./deploy.sh
   ```

5. **Deployment Process Overview**
The deployment script will:
   - Create a VPC with public and private subnets
   - Set up security groups with proper rules
   - Create RDS instance for MongoDB
   - Create Redis instance for caching
   - Set up Elastic Beanstalk environment
   - Configure auto-scaling and monitoring
   - Create CloudFormation stack
   - Set up CloudWatch alarms
   - Configure SNS notifications

6. **Post-Deployment Configuration**
   - Update your `.env` file with the RDS and Redis endpoints provided by the deployment script
   - Configure your Facebook app credentials in the AWS environment variables
   - Monitor CloudWatch logs for application status
   - Set up monitoring alerts through CloudWatch alarms

7. **Accessing the Application**
   - The application URL will be displayed at the end of deployment
   - Access the application through the provided URL
   - Monitor health and metrics through CloudWatch

8. **Troubleshooting**
   - Check CloudFormation stack events for deployment status
   - View CloudWatch logs for application errors
   - Verify security group rules if connectivity issues occur
   - Check SNS notifications for deployment alerts

9. **Cleanup**
   ```bash
   # To delete all resources created by the deployment
   aws cloudformation delete-stack --stack-name sentiment-analysis-stack
   ```

### Security Considerations

- All sensitive information (credentials, API keys) should be stored in AWS Secrets Manager
- Security groups are configured to allow only necessary inbound traffic
- RDS and Redis instances are configured with proper network isolation
- Application logs are encrypted at rest
- Regular backups are configured for RDS instances

### Monitoring and Maintenance

- CloudWatch metrics and alarms are set up for:
  - CPU utilization
  - Memory usage
  - Disk space
  - Network traffic
- Auto-scaling is configured based on CPU and memory metrics
- Regular backups are configured for RDS instances
- CloudWatch logs are configured for application monitoring
