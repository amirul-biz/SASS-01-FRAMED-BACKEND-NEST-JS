// zeptomail ships its own .d.ts files, but they use extension-less relative imports
// (e.g. `from '../types'`), which `moduleResolution: nodenext` rejects (TS2834). That makes
// SendMailClient unresolvable to typed linting even though the package works fine at runtime.
// This shim restates the shape we actually use so `email.service.ts` type-checks cleanly.
declare module 'zeptomail' {
  interface EmailAddress {
    address: string;
    name?: string;
  }

  interface EmailRecipient {
    email_address: EmailAddress;
  }

  interface SendMailOptions {
    from: EmailAddress;
    to: EmailRecipient[];
    subject: string;
    htmlbody: string;
  }

  export class SendMailClient {
    constructor(options: { url: string; token: string });
    sendMail(options: SendMailOptions): Promise<unknown>;
  }
}
