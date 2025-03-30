export const about = `
    <h2>About Minifeed.net</h2>

    <p>
    <strong>Minifeed</strong> is a curated blog directory, reader, and search engine.
    The goal is to collect blogs written by real humans, make them discoverable and searchable.
    Minifeed is created and maintained by <a href="https://rakhim.org">Rakhim</a>.
    Reach me via <a href="/feedback">contact form</a> or on <a href="https://bsky.app/profile/rakhim.org">Bluesky</a>.
    </p>

    <p>
    Features:
    <ol>
        <li>Subscribe to blogs to see their posts in your feed</li>
        <li>Follow other users to see their subscriptions in your feed</li>
        <li>Discover blogs and posts related to your interests</li>
        <li>Add posts to favorites</li>
        <li>Create lists of posts</li>
        <li>Full-text search across all blogs</li>
        <li>Full-text search in your subscriptions*</li>
        <li>Reader view*</li>
        <li>OPML export*</li>
        <li>Personal link blogs*</li>
    </ol>

    <i>* — paid features</i>
    </p>

    <h3>How are blogs collected?</h3>
    <p>
    Blogs are collected manually by me. Each blog must pass the curation criteria. You can suggest blogs to be added to minifeed <a href="/suggest">here</a>.
    </p>

    <h3>What are the curation criteria for blogs?</h3>
    <p>
    <ol>
        <li>Must be written by a human.</li>
        <li>Must be in English (for now).</li>
        <li>Must have a valid RSS feed.</li>
        <li>Personal blogs are preferred.</li>
        <li>Must not be purely a "micro-blog", i.e. must have some content other than tweet-sized status updates or links.</li>
        <li>Corporate blogs are generally not allowed. Exceptions are made for blogs from small teams and solo developers who write primarily about their own work, technology, or experiences. However, if the blog becomes dominated by marketing or sales material, it is removed.</li>
    </ol>
    </p>

    <h3>What are the plans for the future?</h3>
    <p>
    The general plan is:

    <ol>
        <li>Grow the number of blogs from hundreds (today) to thousands</li>
        <li>Develop a way for users to discover new blogs based on their interests</li>
        <li>Keep the website minimal, lean, and fast</li>
        <li>Find a sustainable model such as paid subscriptions and/or donations</li>
    </ol>
    </p>

    <h3>How do I know Minifeed will stay afloat?</h3>
    <p>
    I have been building and using Minifeed since December 2023 (see <a href="/about/changelog">changelog</a>). Today, the registrations are open, and there is an optional paid subscription. I will actively work on Minifeed at least until the end of 2025. In December 2025 I will make a public announcement choosing between one of 3 options:
    <ol>
        <li>Given enough interest and support from users, continue to develop and maintain Minifeed for the long term.</li>
        <li>Given little, but not enough interest, run it for as long as the money lasts.</li>
        <li>Given no interest, shut it down and allow users to download all their data in a simple, usable format.</li>
    </ol>
    </p>

    <h3>How is Minifeed built?</h3>
    <p>
    Minifeed is built with Typescript and runs on Cloudflare Workers platform. The database is SQLite, and the search engine is Typesense. The technical goal is to keep loading times of any page under 1 second. There is minimal JavaScript (htmx) to allow small interactive features such as adding posts to favorites, building lists, and following users. There is no tracking, no ads, and the only cookies are for authentication. Minifeed uses Cloudflare's analytics system to track page views and errors, but this data is anonymized and not connected to user accounts.
    </p>

    <h3>How can I support Minifeed?</h3>
    <p>
    Check out the <a href="/donate">donations page</a> for ways to support Minifeed.
    </p>

    <h3>How do I contact you?</h3>
    <p>
    You can contact me via <a href="/feedback">feedback</a>.
    </p>
`;
