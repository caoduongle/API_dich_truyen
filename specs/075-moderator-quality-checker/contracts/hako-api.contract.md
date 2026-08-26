# Contract: Server Endpoints (Deprecated & Removed)

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Deprecated & Removed

## Note
All server-side scraping endpoints (`/api/hako/*`) have been completely removed.
The Moderator Quality Checker now reads chapter and project data exclusively from local browser state / IndexedDB (`ProjectContext` and `StoryProject`), requiring zero server proxy endpoints.
