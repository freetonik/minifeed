import { html } from 'hono/html'
import { feedIdToSqid, itemIdToSqid } from './utils'
import { version } from './changelog'

export const renderHTML = (
    title: string, 
    inner:any, 
    username:string = '', 
    active:string = 'all', 
    searchQuery:string = '',
    canonicalUrl:string = ''
    ) => {
        
    const canonicalUrlBlock = canonicalUrl ? html`<link rel="canonical" href="${canonicalUrl}">` : ''
    
    let userBlock = html``
    if (username) {
        userBlock = html`
        <a href="/my/account" class="bold">${username}</a>
        <a href="/logout" class="bold">(logout)</a>
        `
    } else {
        userBlock = html`<a href="/login" class="bold">Log in or create account</a>`
    }
    
    return html`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <meta name="author" content="">
        <meta name="description" content="">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${canonicalUrlBlock}
        <link rel="apple-touch-icon" sizes="180x180" href="/static/favicons/apple-touch-icon.png">
        <link rel="icon" type="image/png" sizes="32x32" href="/static/favicons/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/static/favicons/favicon-16x16.png">
        <link rel="manifest" href="/static/favicons/site.webmanifest">
        <link rel="stylesheet" href="/static/minifeed.css">
        <script defer src="/static/htmx.min.js"></script>
    </head>
    
    <body>
    <header>
        <div class="topline">
        <div class="logo">
        <a href="/"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;">minifeed</span>.net</a>
        </div>
        <div class="user">
        ${userBlock}
        </div>
        </div>
        
        <nav aria-label="Site sections">
            <a href="/my" class="${active==='my' ? 'active' : ''}">My feed</a>
            <a href="/global" class="${active==='global' ? 'active' : ''}" style="margin-left: 0.5em">Global feed</a>
            <a href="/blogs" class="${active==='blogs' ? 'active' : ''}" style="margin-left: 0.5em">Blogs</a>
            <a href="/users" class="${active==='users' ? 'active' : ''}" style="margin-left: 0.5em">Users</a>
            <span class="search-form ${active==='search' ? 'active' : ''}">
            <form action="/search" method="GET">
                <input type="text" name="q" placeholder="Search..." size="22" minlength="2" autocomplete="off" value="${searchQuery}">
            </form>
            </span>
        </nav>
    </header>
    
    <main>${inner}</main>
    
    <footer>
        <div>
        <p><a href="/my/account" class="bold">${userBlock}</p>
        <p>Minifeed.net (version ${version} / <a class="bold" href="/about/changelog">changelog</a> / <a class="bold" href="https://status.minifeed.net/">status</a>) <a href="/feedback" class="bold">feedback</a></p>
        </div>
    </footer>
    
    </body>
    </html>`
}
    
const dateFormatOptions:Intl.DateTimeFormatOptions = {year: 'numeric', month: 'short', day: 'numeric'};

export const renderItemShort = (item_id:number, title:string, url:string, feed_title:string, feed_id:number, pub_date:string='', summary: string = '') => {
    const postDate = new Date(pub_date).toLocaleDateString('en-UK', dateFormatOptions)
    const feedSqid = feedIdToSqid(feed_id)
    const itemSqid = itemIdToSqid(item_id)
    
    const feedLink = feed_title ? `from <a href="/blogs/${feedSqid}">${feed_title}</a> | ` : ''
    const summaryContent = summary ? `<p class="item-summary">${summary}</p>` : ''
    
    return `
    <div class="item-short">
    <a href="/items/${itemSqid}" class="item-short-title">${title}</a> <br>
    <small class="muted">
    ${feedLink}
    <time>${postDate}</time> |
    <a class="no-underline no-color" href="${url}">original</a> 
    ${summaryContent}
    </small>
    </div>
    `
}

export const renderItemSearchResult = (searchResult:any) => {
    const item = searchResult['document']
    // item_id, title, url, feed_title, feed_id, pub_date=''
    const postDate = new Date(item['pub_date']).toLocaleDateString('en-UK', dateFormatOptions)
    const feedSqid = feedIdToSqid(item['feed_id'])
    const itemSqid = itemIdToSqid(item['id'])
    const uri_root_from_type = item['type'] === 'blog' ? 'blogs' : ''
    
    let title = item['title'];
    if (searchResult['highlight']['title'] && searchResult['highlight']['title']['snippet']) {
        title = searchResult['highlight']['title']['snippet']
    }
    let content = '';
    if (searchResult['highlight']['content'] && searchResult['highlight']['content']['snippet']) {
        content = searchResult['highlight']['content']['snippet']
    }
    
    return `
    <div class="item-short" style="margin-top:2em">
    <a href="/items/${itemSqid}" class="item-short-title">${title}</a> <br>
    <small class="muted">
    from ${item['type']} <a href="/${uri_root_from_type}/${feedSqid}">${item['feed_title']}</a> | 
    <time>${postDate}</time> |
    <a class="no-underline no-color" href="${item['url']}">original</a> 
    <br>
    
    </small>
    <small>
    <span class="search-result-snippet">
    ${content}...
    </span>
    </small>
    </div>
    `
}
    
export const renderAddFeedForm = (url:string = '', flash:string = '') => {
    let flash_test = ''
    if (flash.includes('Cannot find RSS link')) flash_test += "Cannot find RSS link on that page. Try entering direct RSS URL."
    else if (flash.includes('UNIQUE constraint failed: feeds.rss_url')) flash_test += 'Blog already exists.'
    else if (flash.includes('Cannot fetch url')) flash_test += 'That page does not exist.'
    else if (flash.includes('error code 530')) flash_test += 'That page does not exist.'
    else flash_test += flash;
    
    const flashBlock = flash ? html`<div class="flash-red">${flash_test}</div>` : ''
    return html`
    <h1>Add new blog</h1>
    ${flashBlock}
    <div class="formbg">
    <form action="/blogs/new" method="POST">
    <div style="margin-bottom:1em;">
    <label for="url">Blog URL (or direct RSS URL):</label>
    <input type="url" id="url" name="url" value="${url}" style="width: 100%;"><br>
    </div>
    <input type="submit" value="Add blog">
    </form> 
    </div>
    `
}
