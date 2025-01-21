export const changelog = `
    <h2>Changelog</h2>

    <h3>1.2.0 (21.01.2025)</h3>
    <ul>
        <li>You can set your preferred section of the homepage (all, subscriptions, etc.) in <a href="/account">account settings</a>.</li>
    </ul>

    <h3>1.1.0 (15.01.2025)</h3>
    <ul>
        <li>Link blog feature, closed testing.</li>
    </ul>

    <h3>1.0.0 (22.12.2024)</h3>
    <ul>
        <li>Sign ups are now open to everyone.</li>
        <li>Paid subscriptions (early bird).</li>
        <li>Reader mode.</li>
    </ul>

    <h3>0.9.0 (21.12.2024)</h3>
    <ul>
        <li>New feature: related blogs.</li>
        <li>New feature: OPML exports.</li>
        <li>Related posts and blogs are now refreshed every 2 weeks.</li>
    </ul>

    <h3>0.8.0 (11.12.2024)</h3>
    <ul>
        <li>New feature: you can now choose whether to show full post content (when available), or just a summary.</li>
    </ul>

    <h3>0.7.1 (01.12.2024)</h3>
    <ul>
        <li>New section in Blogs: <a href="/blogs/by/subscribed">subscribed</a>.</li>
        <li>Show blogs and posts on <a href="/welcome">welcome page</a>; show new blogs on user homepage</li>
        <li>Scraping speed improvements.</li>
    </ul>

    <h3>0.7.0 (30.11.2024)</h3>
    <ul>
        <li>Lists of related blog posts are now regenerated every 2 weeks.</li>
        <li>Front page for guests now shows a selection of random blogs and latest blog posts.</li>
        <li>Links to original websites and RSS feeds are now displayed more predominantly.</li>
        <li>Small improvements to typography and visual design.</li>
    </ul>

    <h3>0.6.3 (25.11.2024)</h3>
    <ul>
        <li>Fix various minor bugs: rendering list items, handling wrong links in RSS feeds.</li>
    </ul>

    <h3>0.6.1 (23.10.2024)</h3>
    <ul>
        <li>Minifeed-hosted blogs: image uploads.</li>
    </ul>

    <h3>0.6.1 (20.10.2024)</h3>
    <ul>
        <li>Search results now include blogs, not just blog posts.</li>
    </ul>

    <h3>0.6.0 (17.10.2024)</h3>
    <ul>
        <li>Show related blog posts.</li>
    </ul>

    <h3>0.5.0 (06.10.2024)</h3>
    <ul>
        <li>Lists, private beta.</li>
        <li>Markdown blog post editor.</li>
    </ul>

    <h3>0.4.0 (29.09.2024)</h3>
    <ul>
        <li>Redesign.</li>
        <li>Native blogs at minifeed, private beta.</li>
    </ul>

    <h3>0.3.0 (31.07.2024)</h3>
    <ul>
        <li>Additional feed validation.</li>
        <li>User registrations with email verifications.</li>
        <li>Bugfix: some profile pages showed incorrect follower/following status.</li>
    </ul>

    <h3>0.2.5 (31.07.2024)</h3>
    <ul>
        <li>Blog descriptions are now fetched and stored.</li>
    </ul>

    <h3>0.2.4 (28.07.2024)</h3>
    <ul>
        <li>Personal feeds now load approximately 4 times faster.</li>
        <li>Search performance improvements, search results load approximately twice faster.</li>
    </ul>

    <h3>0.2.3 (09.05.2024)</h3>
    <ul>
        <li>Bugfix: RSS feeds with non-unique item URLs are now processed correctly.</li>
        <li>Adaptive layout improvements for mobile devices.</li>
    </ul>

    <h3>0.2.2 (29.03.2024)</h3>
    <ul>
        <li>Blogs listing now shows 5 latest posts from each blog, and a subscription button.</li>
    </ul>

    <h3>0.2.1 (23.03.2024)</h3>
    <ul>
        <li>Attempting to add an existing feed/blog now redirects to it instead of just showing a warning message.</li>
        <li>Responsive layout improvements for smaller screens.</li>
        <li>Nicer 404 and error pages.</li>
        <li>Bugfix: cookie policy changed so that session cookie can be read when redirecting from another site.</li>
        <li>Bugfix: wrong autocompletion in the search field removed.</li>
        <li>Bugfix: trailing slash in url is now acceptable.</li>
        <li>Bugfix: items with empty description now get description from scraped content.</li>
    </ul>

    <h3>0.2.0 (17.03.2024)</h3>
    <ul>
        <li>Bugfix: non-standard dates in RSS feeds are now parsed properly.</li>
    </ul>

    <h3>0.1.9 (03.02.2024)</h3>
    <ul>
        <li>Bugfix: failed scraping does not affect indexing</li>
    </ul>

    <h3>0.1.8 (03.02.2024)</h3>
    <ul>
        <li>Improvement: restructure navigation, better naming and URIs</li>
        <li>Improvement: my favorites page</li>
        <li>Improvement: status page</li>
        <li>Improvement: feedback page</li>
        <li>Bugfix: favorites are now shown in My feed even if user is not subscribed to parent feed</li>
    </ul>

    <h3>0.1.7 (28.01.2024)</h3>
    <ul>
        <li>Improvement: show item summaries on feed page</li>
        <li>Improvement: submit search index asynchronously, taking into account scraped content #28 #4</li>
        <li>Bugfix: do not index ascii formatting in content</li>
    </ul>

    <h3>0.1.6 (27.01.2024)</h3>
    <ul>
        <li>New feature: show typo-tolerant search results clearly #9</li>
        <li>Bugfix: favorited item icons now show consistently on all pages #15</li>
        <li>Bugfix: correct error when adding unreachable URL as feed URL #19</li>
        <li>Bugfix: subscription status shows correctly on all feeds page #16</li>
        <li>Bugfix: current user is correctly highlighted on all users page #22</li>
    </ul>

    <h3>0.1.5 (23.01.2024)</h3>
    <ul>
        <li>Bugfix: wrong navigation highlight fixed on item page #8</li>
        <li>New feature: scraping of item content #20</li>
        <li>Bugfix: show correct user status on feed add page #7</li>
        <li>Bugfix: show correct favorite status on item page and related articles</li>
        <li>Bugfix: show correct navigation on login page</li>
    </ul>

    <h3>0.1.4 (20.01.2024)</h3>
    <ul>
        <li>Bugfix: some items no longer appear empty to logged in users</li>
    </ul>

    <h3>0.1.3 (19.01.2024)</h3>
    <ul>
        <li>New feature: add items to favorites</li>
        <li>New feature: show related items on item view</li>
        <li>Improvement: paginated search results</li>
    </ul>

    <h3>0.1.2 (11.01.2024)</h3>
    <ul>
        <li>Added public changelog</li>
    </ul>

    <h3>0.1.1 (02.01.2024)</h3>
    <ul>
        <li>Bugfix: follow and subscribe buttons no longer shown to guests</li>
        <li>Improved error messages</li>
    </ul>

    <h3>0.1.0 (02.01.2024)</h3>
    <ul>
        <li>New feature: Follow users</li>
        <li>New feature: Full-text search</li>
    </ul>

    <h3>0.0.2 (27.12.2023)</h3>
    <ul>
        <li>User auth</li>
    </ul>

    <h3>0.0.1 (20.12.2023)</h3>
    <ul>
        <li>Initial release</li>
        <li>Subscribe to feeds</li>
    </ul>
`;
