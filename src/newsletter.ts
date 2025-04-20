import type { Bindings } from './bindings';
import { gatherResponse } from './utils';

export async function newsletterSubscribe(env: Bindings, email: string) {
    const url = new URL('https://api.buttondown.com/v1/subscribers');
    const options = {
        method: 'POST',
        headers: {
            Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
        },
        body: JSON.stringify({
            email_address: email,
            type: 'regular',
        }),
    };

    try {
        const response = await fetch(url.toString(), options);
        const result = await gatherResponse(response);
    } catch (e) {
        console.log({
            message: `Error while subscribing user to newsletter: ${e}`,
            email,
        });
    }
}
