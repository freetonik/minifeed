import type { Bindings } from '../../bindings';

export async function deleteUnverifiedAccounts(env: Bindings) {
    // select accounts created more than 3 days ago with email_verified != 1
    const { results: accounts } = await env.DB.prepare(
        'SELECT user_id, email, created FROM users WHERE created < ? AND email_verified != 1',
    )
        .bind(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .all();
    for (const account of accounts) {
        console.log({
            message: 'Deleting account due to unverified email for 3 days',
            accountId: account.user_id,
            created: account.created,
            email: account.email,
        });
        await env.DB.prepare('DELETE FROM users WHERE user_id = ?').bind(account.user_id).run();
        break;
    }
}
