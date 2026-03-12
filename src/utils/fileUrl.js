/**
 * Build a public URL for an R2 file key.
 *
 * When R2_PUBLIC_URL is set (e.g. "https://files.dannyinfinity.com"),
 * files are served directly from the R2 public bucket — no Worker proxy.
 * Otherwise falls back to the Worker file route.
 */
export function fileUrl(env, r2Key) {
    if (!r2Key) return null;
    const publicBase = env.R2_PUBLIC_URL;
    if (publicBase) {
        return `${publicBase}/${r2Key}`;
    }
    return `/api/files/${r2Key}`;
}

/**
 * Rewrite a URL that may already contain /api/files/ to use the public R2 domain.
 * Used for video_src which stores full URLs like "/api/files/videos/123-file.mp4"
 * in the database. Non-file URLs (YouTube IDs, external links) are passed through.
 */
export function rewriteFileUrl(env, url) {
    if (!url) return url;
    const publicBase = env.R2_PUBLIC_URL;
    if (publicBase && url.startsWith('/api/files/')) {
        return `${publicBase}/${url.slice('/api/files/'.length)}`;
    }
    return url;
}
