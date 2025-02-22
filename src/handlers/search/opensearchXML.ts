import type { Context } from 'hono';

export async function handleOpensearchXML(c: Context) {
    c.header('Content-Type', 'application/xml');
    c.status(200);
    return c.body(`
        <OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
            <ShortName>Minifeed.net</ShortName>
            <LongName>Minifeed.net Search</LongName>
            <Description>Search through Minifeed.net</Description>
            <Query role="example" searchTerms="example search"/>
            <InputEncoding>UTF-8</InputEncoding>
            <OutputEncoding>UTF-8</OutputEncoding>
            <AdultContent>false</AdultContent>
            <Language>en-us</Language>
            <SyndicationRight>open</SyndicationRight>
            <Developer>Minifeed.net</Developer>
            <Tags>tag1,tag2</Tags>
            <Image height="16" width="16" type="image/vnd.microsoft.icon">https://minifeed.net/favicon.ico</Image>
            <Url type="text/html" template="https://minifeed.net/search?q={searchTerms}"/>
        </OpenSearchDescription>
`);
}
