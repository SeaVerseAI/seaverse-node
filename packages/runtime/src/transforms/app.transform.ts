import type { App, DbSchema } from '../types/models.types.js';

/**
 * 转换数据库应用对象为前端模型
 */
export function transformApp(dbApp: DbSchema.App): App {
  const metadata = (dbApp.metadata || {}) as any;
  const coverImageUrls = Array.isArray(metadata.coverImageUrls)
    ? metadata.coverImageUrls
    : Array.isArray(metadata.coverImageURLS)
      ? metadata.coverImageURLS
      : [];

  const createdAtRaw = (dbApp.created_at ?? 0) as any;
  const updatedAtRaw = (dbApp.updated_at ?? 0) as any;

  const createdAtMs =
    typeof createdAtRaw === 'string' ? Date.parse(createdAtRaw) :
    typeof createdAtRaw === 'number' ? (createdAtRaw > 10000000000 ? createdAtRaw : createdAtRaw * 1000) :
    0;
  const updatedAtMs =
    typeof updatedAtRaw === 'string' ? Date.parse(updatedAtRaw) :
    typeof updatedAtRaw === 'number' ? (updatedAtRaw > 10000000000 ? updatedAtRaw : updatedAtRaw * 1000) :
    0;

  const published = Boolean(metadata.published);
  const id = dbApp.app_id || dbApp.id || '';
  const name = dbApp.app_name || dbApp.name || '';

  return {
    id,
    name,
    displayName: dbApp.display_name || name,
    description: dbApp.description || '',
    thumbnailUrls: dbApp.thumbnail_urls || coverImageUrls,
    userName: dbApp.user_id || dbApp.user_name || '',
    version: dbApp.version || '',
    tags: dbApp.tags ?? null,
    status: dbApp.status || (published ? 'published' : 'draft'),
    positiveCount: dbApp.positive_count || 0,
    forkCount: dbApp.fork_count || 0,
    commentCount: dbApp.comment_count || 0,
    createdAt: Number.isFinite(createdAtMs) ? createdAtMs : 0,
    updatedAt: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
  };
}
