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

    // State
    var postsContainer = document.getElementById('blog-posts');
    var posts = [];
    var sortOrder = 'asc'; // default: oldest first

    function renderPosts() {
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
                '</div>' +
                '<h2 class="post-title"><a href="' + escapeHtml(href) + '">' + escapeHtml(post.title) + '</a></h2>' +
                '<p class="post-excerpt">' + escapeHtml(excerpt) + '</p>' +
                '<a href="' + escapeHtml(href) + '" class="post-read-more">READ MORE &rarr;</a>';

            postsContainer.appendChild(article);
        });
    }

    // Sort toggle
    var sortToggleBtn = document.getElementById('sort-toggle-btn');

    if (sortToggleBtn) {
        sortToggleBtn.addEventListener('click', function() {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            posts.reverse();
            renderPosts();
            sortToggleBtn.innerHTML = (sortOrder === 'asc' ? 'OLDEST FIRST' : 'NEWEST FIRST') +
                ' <span class="sort-arrow">&#9650;</span>';
            sortToggleBtn.classList.toggle('desc', sortOrder === 'desc');
        });
    }

    // Fetch and render
    fetch('/api/blog')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            posts = data.posts || [];
            renderPosts();
        })
        .catch(function() {
            postsContainer.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load posts</div>';
        });
})();
