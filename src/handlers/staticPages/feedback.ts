import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from '../../htmltools';

export async function handleFeedback(c: Context) {
    const feedbackForm = `
    <h1 style="text-align:center;">Feedback</h1>
    <p style="text-align:center;">Please leave your feedback below. We appreciate your input!</p>
    <script data-letterbirduser="minifeed" src="https://letterbird.co/embed/v1.js"></script>
    `;
    return c.html(renderHTML('Feedback | minifeed', raw(feedbackForm), c.get('USER_LOGGED_IN'), 'feedback'));
}

export async function handleSuggestBlog(c: Context) {
    const suggestBlogForm = `
    <h1 style="text-align:center;">Suggest a blog</h1>
    <p style="text-align:center;">Know some good blogs written by real humans? Send us the links!</p>
    <script data-letterbirduser="minifeed" src="https://letterbird.co/embed/v1.js"></script>
    `;
    return c.html(renderHTML('Suggest a blog | minifeed', raw(suggestBlogForm), c.get('USER_LOGGED_IN'), 'feedback'));
}
