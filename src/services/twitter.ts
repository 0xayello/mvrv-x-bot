import { TwitterApi } from 'twitter-api-v2';
import { Logger } from '../utils/logger';

export class TwitterService {
  private client: TwitterApi;

  constructor() {
    // Check each environment variable
    const credentials = {
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET
    };

    // Log the status of credentials (but not their values for security)
    Logger.info('Checking Twitter credentials', {
      apiKey: !!credentials.apiKey,
      apiSecret: !!credentials.apiSecret,
      accessToken: !!credentials.accessToken,
      accessSecret: !!credentials.accessSecret
    });

    if (!credentials.apiKey || 
        !credentials.apiSecret || 
        !credentials.accessToken || 
        !credentials.accessSecret) {
      throw new Error('Missing Twitter API credentials. Please check your .env file.');
    }

    // Initialize with OAuth 1.0a credentials
    this.client = new TwitterApi({
      appKey: credentials.apiKey,
      appSecret: credentials.apiSecret,
      accessToken: credentials.accessToken,
      accessSecret: credentials.accessSecret,
    });
  }

  async postTweet(message: string): Promise<void> {
    try {
      Logger.info('Attempting to post tweet', { message });

      const response = await this.client.v2.tweet(message);
      
      if (!response?.data?.id) {
        throw new Error('Failed to get confirmation of tweet posting');
      }
      
      Logger.info('Successfully posted tweet', {
        tweetId: response.data.id
      });
    } catch (error) {
      // Add more detailed error logging
      const errorDetails = {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        details: error instanceof Error && 'data' in error ? (error as any).data : undefined
      };
      
      Logger.error('Failed to post tweet', errorDetails);
      
      if (error instanceof Error) {
        throw new Error(
          `Twitter API Error: ${error.message}\n` +
          'Please verify your API keys and ensure your app has write permissions enabled.'
        );
      }
      
      throw error;
    }
  }

  async postTweetWithMedia(text: string, imageBuffer: Buffer): Promise<void> {
    try {
      Logger.info('Uploading media to Twitter');
      const mediaId = await this.client.v1.uploadMedia(imageBuffer, { type: 'png' });
      
      Logger.info('Posting tweet with media');
      await this.client.v2.tweet({
        text,
        media: { media_ids: [mediaId] }
      });
      
      Logger.info('Successfully posted tweet with media');
    } catch (error) {
      Logger.error('Failed to post tweet with media', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 