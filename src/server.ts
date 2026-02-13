import express, { Express } from 'express';
import path from 'path';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import bodyParser from 'body-parser';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

export function createServer(): Express {
  const app = express();

  // Trust proxy (important for cPanel behind nginx/apache)
  app.set('trust proxy', 1);

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to allow inline scripts
  }));

  // Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Body parsing
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Session configuration with Redis
  const sessionConfig: session.SessionOptions = {
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to false when using Cloudflare Flexible SSL
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    proxy: true, // Trust the proxy
  };

  // Use Redis for session storage in production
  if (env.REDIS_URL) {
    const redisClient = createClient({
      url: env.REDIS_URL,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.connect().catch(console.error);

    sessionConfig.store = new RedisStore({
      client: redisClient,
      prefix: 'sess:',
    });

    console.log('✅ Using Redis for session storage');
  } else {
    console.warn('⚠️  Using in-memory session storage (not recommended for production)');
  }

  app.use(session(sessionConfig));

  // Static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Routes
  app.use('/', routes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
