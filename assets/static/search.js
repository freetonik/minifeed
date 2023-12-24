const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
    server: {
        apiKey: 'GCuPvjR4vz3gvACRo2N5hpRjZnEaijKE', // Be sure to use an API key that only allows searches, in production
        nodes: [
            {
                host: '3afyidm6tgzxlvq7p-1.a1.typesense.net',
                port: '443',
                protocol: 'https',
            },
        ],
    },
    additionalSearchParameters: {
        queryBy: 'title,content',
    },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;

const search = instantsearch({
    searchClient,
    indexName: 'blog_items',
});

search.addWidgets([
    instantsearch.widgets.searchBox({
        container: '#searchbox',
    }),
    instantsearch.widgets.configure({
        hitsPerPage: 8,
    }),
    instantsearch.widgets.hits({
        container: '#hits',
        templates: {
            item(item) {
                return `
                    <div>
                    ${item.title}
                    </div>
                    `;
            },
        },
    }),
    instantsearch.widgets.pagination({
        container: '#pagination',
    }),
]);

search.start();