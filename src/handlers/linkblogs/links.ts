import { raw } from 'hono/html';
import { renderHTML, renderLinkShort, renderLinksSubsections } from '../../htmltools';

export async function handleLinks(c: Context) {
    const userId = c.get('USER_ID') || '0';
    const userLoggedIn = c.get('USER_LOGGED_IN');
    const currentUsername = c.get('USERNAME');
    const listingType = c.req.param('listingType') || 'newest';

    const itemsPerPage = 200;
    const page = Number(c.req.query('p')) || 1;
    const offset = page * itemsPerPage - itemsPerPage;

    let ordering = 'created DESC';
    if (listingType === 'oldest') ordering = 'created ASC';

    const { results, meta } = await c.env.DB.prepare(
        `
        SELECT
        url,
        title,
        created

        FROM linkblog_items

        ORDER BY ${ordering}
        LIMIT ? OFFSET ?
        `,
    )
        .bind(itemsPerPage + 1, offset)
        .all();

    if (!results.length) return c.notFound();

    let inner = renderLinksSubsections(listingType, currentUsername);

    for (let i = 0; i < results.length - 1; i++) {
        const item = results[i];
        inner += renderLinkShort(item.title, item.url, '', item.created, item.linkblog_user_item_id);
    }

    if (results.length > itemsPerPage) inner += `<a href="?p=${page + 1}">More...</a></p>`;

    return c.html(
        renderHTML(
            'Links | minifeed',
            raw(inner),
            c.get('USER_LOGGED_IN'),
            'links',
            '',
            '',
            c.get('USER_IS_ADMIN') ? `${meta.duration} ms., ${meta.rows_read} rows read` : '',
        ),
    );
}
