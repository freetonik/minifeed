# Quality Assurance checklist

## Environments

1. macOS, Chrome
2. macOS, Safari
3. macOS, Firefox
4. Android, Chrome
5. Linux, Chrome

## Actions

### As guest (not logged in)

#### All pages

1. check that "Log in or create account" link in the upper right corner is always visible for guests, but not for logged in users
    - same for links in footer 
1. check that top navigation menu always shows correct active section (white tab-like block) 


#### "Everything" page

https://minifeed.net/all

1. click on items' titles
1. click on items' feed titles 
1. click on original links
1. check dates rendered correctly
1. check dates sorted correctly

#### "Feeds" page

https://minifeed.net/feeds

1. click on feeds
1. try adding new feed

#### Single feed page

1. open any feed page from https://minifeed.net/feeds
1. check `site` link opens correct external page
1. check correct items listing (check a few random items, not all)
    - dates sorted correctly
    - links open corresponding items
    - "original" links open correct original pages

#### Single item page

1. open any item from any feed
1. check `open original` button opens correct external page
1. check that item has text content
1. check "More from..." block shows items from correct feed


#### "Users" page https://minifeed.net/users

1. click on users


#### Search (search box on any page)

1. search for any words
2. check that results are relevant (include searched words)
3. check that no results are found for a long, random string of characters
4. check that pagination (clicking `More`) works when search query returns many results (e.g. search for word `a`)

#### "Login or sign up" page https://minifeed.net/login

1. try signing up with bad password (shorter than 8 characters)
1. try signing up with empty fields
1. sign up correctly
1. logout in several ways
    - via https://minifeed.net/my/account
    - via header link (upper-right corner)
    - via footer link
1. try logging in with bad username and/or password
1. log in correctly

<br>

---

### As logged in user

#### All pages

1. check that "username (logout)" link in the upper right corner is always visible for logged in users, but not for guests
    - same for links in footer
1. check that top navigation menu always shows correct active section (white tab-like block) 



#### "My" page https://minifeed.net/my

1. check sub-pages:
    - https://minifeed.net/my
    - https://minifeed.net/my/subs
    - https://minifeed.net/my/follows
1. sub-pages must be empty for a new user
1. subscribe to some feeds at https://minifeed.net/feeds
    - sub-pages https://minifeed.net/my and https://minifeed.net/my/subs should show content now
1. follow some users at https://minifeed.net/users
    - sub-page https://minifeed.net/my/follows should show content now
1. randomly unsubscribe/resubscribe and unfollow/refollow users to check that corresponding sub-pages always show correct content

#### "Users" page https://minifeed.net/users

1. check that your new user is listed
1. check that when opening your user page it says "This is your public profile"
    - check that it does not say the same when viewing other users
1. check that sub-sections are showing correct content:
    - Favorites
    - Subscriptions
    - Follows
    - Followers

#### Single feed page

1. open any feed page from https://minifeed.net/feeds
1. check `site` link opens correct external page
1. check correct items listing (check a few random items, not all)
    - dates sorted correctly
    - links open corresponding items
    - "original" links open correct original pages
1. check `subscribe`/`unsubscribe` button behavior

#### Single item page

1. open any item from any feed
1. check `open original` button opens correct external page
1. check `favorite`/`unfavorite` button behavior
1. check that item has text content
    - check that favorited item now shows with a star ★ symbol on all other pages
1. check "More from..." block shows items from correct feed

#### Add new feed https://minifeed.net/feeds/new

1. try adding wrong URLs:
    - incorrect url (does not start with `http`)
    - non-existent url (some page that returns 404)
    - existent url, but not a blog
1. try adding a blog that already exists on minifeed at https://minifeed.net/feeds
1. try adding new blog (find any non-trashy blog for this)
