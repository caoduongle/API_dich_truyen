/**
 * Hako & Docln Public Proxy Routes
 * Feature: 075-moderator-quality-checker
 */

import { Router } from 'express';
import {
  getNovelInfoHandler,
  getChapterContentHandler,
} from '../controllers/hakoController';

const hakoRouter = Router();

hakoRouter.post('/novel-info', getNovelInfoHandler);
hakoRouter.post('/chapter-content', getChapterContentHandler);

export default hakoRouter;
