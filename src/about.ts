export const about = `
    <h2>About Minifeed.net</h2>

    <p>
    <strong>Minifeed</strong> is a curated blog directory, reader, and search engine.
    The goal is to collect blogs written by real humans, make them discoverable and searchable, and to maintain an archive akin to Archive.org, but for blogs.
    Minifeed is created by <a href="https://rakhim.org">Rakhim</a>.
    </p>

    <p>
    Features:
    <ol>
        <li>Subscribe to blogs to see their posts in your feed</li>
        <li>Follow other users to see their subscriptions in your feed</li>
        <li>Add posts to favorites</li>
        <li>Create lists of posts</li>
        <li>Full-text search across all blogs</li>
        <li>Create own blogs at Minifeed</li>
    </ol>
    </p>

    <p>
    After the public launch, some features will be available to paid subscribers only. I plan to introduce a relatively affordable yearly subscription in order to cover the costs of development and hosting. 
    </p>

    <h3>How are blogs collected?</h3>
    <p>
    Blogs are collected manually by Rakhim. Each blog must pass the curation criteria. You can suggest blogs to be added to minifeed <a href="/suggest">here</a>.
    </p>

    <h3>What are the curation criteria for blogs?</h3>
    <p>
    <ol>
        <li>Must be written by a human.</li>
        <li>Must be in English (for now).</li>
        <li>Must have an RSS feed.</li>
        <li>Personal blogs are preferred.</li>
        <li>Must not be purely a "micro-blog", i.e. must have some content other than tweet-sized status updates or links.</li>
        <li>Corporate blogs are generally not allowed. Exceptions are made for blogs from small teams and solo developers who write primarily about their own work, technology, or experiences. However, if the blog becomes dominated by marketing or sales material, it is removed.</li>
    </ol>
    </p>

    <h3>What are the plans for the future?</h3>
    <p>
    Minifeed is currently in closed alpha. I plan to open it up to the public by the end of 2024. Contact me via <a href="/feedback">feedback</a> if you want an invite code to participate in the public alpha, or if you want to get notified when registrations open for everybody. 
    </p>

    <p>
    The general plan is:

    <ol>
        <li>Grow the number of blogs from hundreds (today) to thousands</li>
        <li>Develop a way for users to discover new blogs based on their interests</li>
        <li>Keep the website minimal, lean, and fast</li>
    </ol>
    </p>

    <p>
    Planned features are:
    <ol>
        <li>Private notes for posts</li>
        <li>Automatic tagging and categorization of posts</li>
        <li>Comments and discussions</li>
        <li>Markdown and HTML export of blogs hosted at Minifeed</li>
        <li>Custom subdomains for blogs hosted at Minifeed</li>
    </ol>
    </p>

    <p>
    Features I'm considering:
    <ol>
        <li>Downloadable personal HTML-archives of favorites</li>
        <li>Upvotes or other ways to rank posts and blogs</li>
        <li>Authors being able to "claim" their blog and gain additional controls and features</li>
        <li>Markdown and HTML export of blogs hosted at Minifeed</li>
        <li>"Podcasts" and "YouTube channels" sections in addition to blogs</li>
        <li>API for developers</li>
    </ol>
    </p>

    <h3>How do I know Minifeed will stay afloat?</h3>
    <p>
    I have been building and using Minifeed since December 2023 (see <a href="/about/changelog">changelog</a>). I will launch it publicly by the end of 2024, allow paid subscriptions, and keep actively working on it for 1 year (until end of 2025). In December 2025 I will make a public announcement, choosing between one of 3 options:
    <ol>
        <li>Given enough interest and support from users, continue to develop and maintain Minifeed for the long term.</li>
        <li>Given little, but not enough interest, run it for as long as the money lasts.</li>
        <li>Given no interest, shut it down and allow users to download all their data in a simple, usable format.</li>
    </ol>
    </p>

    <h3>How is Minifeed built?</h3>
    <p>
    Minifeed is built with Typescript and runs on Cloudflare Workers platform. The database is SQLite, and the search engine is Typesense. The technical goal is to keep loading times of any page under 1 second. There is minimal JavaScript (htmx) to allow small interactive features such as favoriting posts and following users. There is no tracking, no ads, and the only cookies are for authentication. After the public launch, all JavaScript will be made optional, and the site will be fully functional without JavaScript.
    </p>

    <h3>How do I contact you?</h3>
    <p>
    You can contact me via <a href="/feedback">feedback</a>.
    </p>
`;
