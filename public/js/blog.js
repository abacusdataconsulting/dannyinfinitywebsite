(function() {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function stripHtml(html) {
        if (!html) return '';
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function makeExcerpt(html, maxLen) {
        maxLen = maxLen || 200;
        var text = stripHtml(html);
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
    }

    // Update year
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Load and render writings listing
    var postsContainer = document.getElementById('blog-posts');

    fetch('/api/blog')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var posts = data.posts || [];
            if (posts.length === 0) {
                postsContainer.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">No posts yet</div>';
                return;
            }

            postsContainer.innerHTML = '';
            posts.forEach(function(post) {
                var article = document.createElement('article');
                article.className = 'blog-post';

                var dateStr = post.published_at ? post.published_at.replace(/-/g, '.') : '';
                var slug = post.slug || '';
                var excerpt = makeExcerpt(post.body);
                var href = slug ? '/blog/' + encodeURIComponent(slug) : '#';

                article.innerHTML =
                    '<div class="post-header">' +
                        '<span class="post-date">' + escapeHtml(dateStr) + '</span>' +
                        '<span class="post-tag">[' + escapeHtml(post.tag || 'UPDATE') + ']</span>' +
                    '</div>' +
                    '<h2 class="post-title"><a href="' + escapeHtml(href) + '">' + escapeHtml(post.title) + '</a></h2>' +
                    '<p class="post-excerpt" style="opacity:0.7;margin:8px 0 16px;font-size:0.9rem;line-height:1.5;">' + escapeHtml(excerpt) + '</p>' +
                    '<div style="text-align:center;margin-top:20px;">' +
                        '<a href="' + escapeHtml(href) + '" class="post-read-more" style="display:inline-block;font-size:1.1rem;padding:10px 28px;color:var(--text-primary);border:2px solid var(--border-color);letter-spacing:2px;transition:all 0.2s ease;">READ MORE &rarr;</a>' +
                    '</div>';

                postsContainer.appendChild(article);
            });
        })
        .catch(function() {
            postsContainer.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load posts</div>';
        });
})();
