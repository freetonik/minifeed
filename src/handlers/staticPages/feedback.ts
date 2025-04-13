import type { Context } from 'hono';
import { raw } from 'hono/html';
import { renderHTML } from '../../htmltools';

export async function handleSupport(c: Context) {
    const supportForm = `
    <style>
    iframe {
        height: 500px;
    }
    </style>
    <h1 style="text-align:center;">Feedback and support</h1>
    <p style="text-align:center;">Send your support request or any feedback below. I will reply within 3 working days.</p>
    <script data-letterbirduser="minifeed" src="https://letterbird.co/embed/v1.js"></script>
    `;
    return c.html(renderHTML(c, 'Feedback | minifeed', raw(supportForm)));
}

export async function handleSuggestBlog(c: Context) {
    const suggestBlogForm = `
    <style>
    iframe {
        height: 500px;
    }
    </style>
    <h1 style="text-align:center;">Suggest a blog</h1>
    <p style="text-align:center;">Know some good blogs written by real humans? Send us the links!</p>
    <script data-letterbirduser="minifeed" src="https://letterbird.co/embed/v1.js"></script>
    `;
    return c.html(renderHTML(c, 'Suggest a blog | minifeed', raw(suggestBlogForm)));
}
