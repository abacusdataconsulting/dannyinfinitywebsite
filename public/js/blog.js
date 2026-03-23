(function() {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Update year
    document.getElementById('current-year').textContent = new Date().getFullYear();


    // Load and render writings posts
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

                article.innerHTML =
                    '<div class="post-header">' +
                        '<span class="post-date">' + escapeHtml(dateStr) + '</span>' +
                        '<span class="post-tag">[' + escapeHtml(post.tag || 'UPDATE') + ']</span>' +
                    '</div>' +
                    '<h2 class="post-title">' + escapeHtml(post.title) + '</h2>' +
                    '<div class="post-body">' + (post.body || '') + '</div>' +
                    '<div class="post-footer">' +
                        '<span class="post-terminal">&gt; END_OF_POST</span>' +
                    '</div>';

                postsContainer.appendChild(article);
            });
        })
        .catch(function() {
            postsContainer.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Failed to load posts</div>';
        });
})();
