GET http://localhost:8181/
HTTP 302
[Asserts]
header "Location" contains "/welcome"

GET http://localhost:8181/subscriptions
HTTP 302
[Asserts]
header "Location" contains "/login"

GET http://localhost:8181/favorites
HTTP 302
[Asserts]
header "Location" contains "/login"

GET http://localhost:8181/friendfeed
HTTP 302
[Asserts]
header "Location" contains "/login"



GET http://localhost:8181/about
HTTP 200

GET http://localhost:8181/about/changelog
HTTP 200

GET http://localhost:8181/feedback
HTTP 200
[Asserts]
xpath "//script" exists



GET http://localhost:8181/global
HTTP 200

GET http://localhost:8181/global/newest
HTTP 200

GET http://localhost:8181/global/oldest
HTTP 200

GET http://localhost:8181/global/random
HTTP 200

GET http://localhost:8181/lists
HTTP 200

GET http://localhost:8181/users
HTTP 200





GET http://localhost:8181/welcome
HTTP 200
Content-Type: text/html; charset=UTF-8
[Asserts]
xpath "string(/html/head/title)" contains "Minifeed"
xpath "count(//main)" == 1


GET http://localhost:8181/blogs
HTTP 200
Content-Type: text/html; charset=UTF-8
[Asserts]
xpath "string(/html/head/title)" contains "Blogs"
xpath "count(//main)" == 1


GET http://localhost:8181/login
HTTP 200
Content-Type: text/html; charset=UTF-8
[Asserts]
xpath "string(/html/head/title)" contains "Log in"
xpath "//form" exists

GET http://localhost:8181/signup
HTTP 200
Content-Type: text/html; charset=UTF-8
[Asserts]
xpath "string(/html/head/title)" contains "Create account"
xpath "//form" exists
