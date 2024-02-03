export const version = "0.1.8";

export const changelog = `
    <h2>Changelog</h2>

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
        <li>Improvement: Paginated search results</li>
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
`