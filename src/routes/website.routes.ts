import { Router } from 'express';
import {
  startWebsiteScrape,
  listWebsiteSources,
  getWebsiteStatus,
  deleteWebsiteSource,
  rescanWebsite,
  getWebsiteStats,
  testSemanticSearch,
} from '../controllers/websiteController';

const router = Router({ mergeParams: true }); // Allow access to parent route params

// Website scraping endpoints
router.post('/', startWebsiteScrape);
router.get('/', listWebsiteSources);
router.get('/stats', getWebsiteStats);
router.post('/search', testSemanticSearch);
router.get('/:websiteId', getWebsiteStatus);
router.delete('/:websiteId', deleteWebsiteSource);
router.post('/:websiteId/rescan', rescanWebsite);

export default router;
