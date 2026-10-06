import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { createHandler, type ContactEvent } from './handler';
import { toSesInput } from './email';
import { verifyTurnstile } from './turnstile';

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`missing_env_${name}`);
  return v;
};

const ses = new SESv2Client({});
const ssm = new SSMClient({});

// Fetched once per cold start. The value lives in SSM (set out of band), never in Terraform state.
let secret: Promise<string> | undefined;
const turnstileSecret = () =>
  (secret ??= ssm
    .send(new GetParameterCommand({ Name: env('TURNSTILE_SECRET_PARAM'), WithDecryption: true }))
    .then((r) => r.Parameter?.Value ?? '')
    .catch((e) => {
      secret = undefined; // do not cache a failure
      throw e;
    }));

const handle = createHandler({
  config: {
    ownerEmails: (process.env.OWNER_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    fromAddress: env('FROM_ADDRESS'),
    fromName: env('FROM_NAME'),
    shopPhone: env('SHOP_PHONE'),
    shopHours: env('SHOP_HOURS'),
    maxBodyBytes: 16 * 1024,
  },
  send: async (email) => {
    await ses.send(new SendEmailCommand(toSesInput(email, env('CONFIG_SET'))));
  },
  verifyTurnstile: async (token, ip) =>
    verifyTurnstile(fetch as never, await turnstileSecret(), token, ip),
  log: (entry) => console.log(JSON.stringify(entry)),
});

export const handler = (event: ContactEvent) => handle(event);
