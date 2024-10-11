import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Bindings } from "./bindings";

export const sendEmail = async (
    env: Bindings,
    to: string,
    from: string = "no-reply@minifeed.net",
    subject: string,
    body: string,
) => {

    const mail = new SendEmailCommand({
        Source: from,
        ReturnPath: from,
        Destination: { ToAddresses: [to] },
        Message: {
            Subject: { Data: subject },
            Body: {
                Html: { Data: body },
            },
        }
    })
    
    const client = new SESClient({
        region: "eu-north-1",
        credentials: {
            accessKeyId: env.AWS_SES_ACCESS_KEY,
            secretAccessKey: env.AWS_SES_ACCESS_KEY_SECRET
        },
    })
    
    try {
        await client.send(mail)
    } catch (e: unknown) {
        console.error(e);
        return e instanceof Error ? e.toString() : 'An unknown error occurred';
    }
    return true;
};
