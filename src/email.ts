import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { Bindings } from './bindings';

export async function sendEmail(
    env: Bindings,
    to: string,
    subject: string,
    body: string,
    from = 'no-reply@minifeed.net',
) {
    const mail = new SendEmailCommand({
        Source: from,
        ReturnPath: from,
        Destination: { ToAddresses: [to] },
        Message: {
            Subject: { Data: subject },
            Body: {
                Html: { Data: body },
            },
        },
    });

    const client = new SESClient({
        region: 'eu-north-1',
        credentials: {
            accessKeyId: env.AWS_SES_ACCESS_KEY,
            secretAccessKey: env.AWS_SES_ACCESS_KEY_SECRET,
        },
    });

    try {
        await client.send(mail);
    } catch (e: unknown) {
        console.error(e);
        return e instanceof Error ? e.toString() : 'An unknown error occurred';
    }
    return true;
}
