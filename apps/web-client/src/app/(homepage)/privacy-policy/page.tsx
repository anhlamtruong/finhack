import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Lock, Server, FileText } from "lucide-react";

const PrivacyPage = () => {
  return (
    <div className="container mx-auto px-4 py-12 pt-10 max-w-4xl">
      <div className="mb-8">
        <Button
          asChild
          variant="ghost"
          className="gap-2 pl-0 hover:bg-transparent hover:text-primary"
        >
          <Link href="/">
            <ArrowLeft className="size-4" /> Back to Home
          </Link>
        </Button>
      </div>

      <div className="space-y-4 mb-12 border-b pb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="text-lg text-muted-foreground">
          <strong>Effective Date:</strong> January 25, 2026
        </p>
        <p className="text-base text-foreground/80 leading-relaxed max-w-3xl">
          Chuchube Finance (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
          is committed to protecting your privacy. This Privacy Policy explains
          how we collect, use, disclose, and safeguard your information when you
          visit our application. Please read this privacy policy carefully. If
          you do not agree with the terms of this privacy policy, please do not
          access the application.
        </p>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-12 leading-relaxed text-foreground/80">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="size-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground m-0">
              1. Information Collection and Usage
            </h3>
          </div>
          <p>
            We collect information that you voluntarily provide to us when you
            register on the application, express an interest in obtaining
            information about us or our products and services, or otherwise when
            you participate in activities on the application.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="p-5 rounded-lg border bg-card">
              <h4 className="font-bold text-foreground mb-2">Personal Data</h4>
              <p className="text-sm">
                Personally identifiable information, such as your name and email
                address, that you voluntarily give to us when you register with
                the application via our authentication provider (Clerk).
              </p>
            </div>
            <div className="p-5 rounded-lg border bg-card">
              <h4 className="font-bold text-foreground mb-2">Financial Data</h4>
              <p className="text-sm">
                Data related to your financial accounts, transactions, and
                balances that you choose to upload (via CSV) or sync (via
                Plaid). We store this data to provide our core financial
                tracking services.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-primary/5 p-8 rounded-2xl border border-primary/10">
          <div className="flex items-center gap-2 mb-4">
            <Server className="size-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground m-0">
              2. Artificial Intelligence and Data Processing
            </h3>
          </div>
          <p>
            Our application utilizes Large Language Models (LLMs) to provide the
            &quot;AI Financial Advisor&quot; feature. We adhere to strict data
            usage protocols regarding AI:
          </p>
          <ul className="list-disc pl-6 space-y-3 mt-4">
            <li>
              <strong>No Training on User Data:</strong> We do not grant our AI
              model providers the right to use your personal financial data to
              train their foundation models. Your data remains yours.
            </li>
            <li>
              <strong>Ephemeral Processing:</strong> When you interact with the
              AI Advisor, relevant financial context is transmitted securely for
              the sole purpose of generating a response. This context is not
              retained by the model provider for long-term storage or learning.
            </li>
            <li>
              <strong>Anonymization:</strong> Where possible, personally
              identifiable information (such as your specific name or email) is
              decoupled from financial transaction data before being processed
              by AI services.
            </li>
          </ul>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="size-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground m-0">
              3. Data Security Protocols
            </h3>
          </div>
          <p>
            We use administrative, technical, and physical security measures to
            help protect your personal information. While we have taken
            reasonable steps to secure the personal information you provide to
            us, please be aware that despite our efforts, no security measures
            are perfect or impenetrable.
          </p>
          <div className="mt-6 space-y-4">
            <div className="flex gap-4 items-start">
              <div className="mt-1 bg-muted p-1.5 rounded-md">
                <Shield className="size-4" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base">
                  Encryption at Rest & In Transit
                </h4>
                <p className="text-sm mt-1">
                  All sensitive data stored in our databases is encrypted using
                  AES-256 standards. Data transmission between your browser and
                  our servers is secured via TLS 1.3.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="mt-1 bg-muted p-1.5 rounded-md">
                <Shield className="size-4" />
              </div>
              <div>
                <h4 className="font-bold text-foreground text-base">
                  Strict Access Controls
                </h4>
                <p className="text-sm mt-1">
                  We implement rigorous Row-Level Security (RLS) policies at the
                  database level, ensuring that users can strictly only access
                  records associated with their own user ID.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            4. Disclosure to Third Parties
          </h3>
          <p>
            We do not sell, trade, or otherwise transfer to outside parties your
            Personally Identifiable Information. However, we share data with
            trusted third-party service providers who assist us in operating our
            application, conducting our business, or serving our users, so long
            as those parties agree to keep this information confidential.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>
              <strong>Clerk:</strong> For identity management and authentication
              services.
            </li>
            <li>
              <strong>Plaid:</strong> For secure connection to financial
              institutions (optional).
            </li>
            <li>
              <strong>Neon / PostgreSQL:</strong> For secure, encrypted database
              hosting.
            </li>
            <li>
              <strong>Vercel:</strong> For cloud infrastructure and hosting
              services.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            5. Your Data Rights
          </h3>
          <p>
            Depending on your location, you may have the following rights
            regarding your personal data:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>
              <strong>Right to Access:</strong> You have the right to request
              copies of your personal data.
            </li>
            <li>
              <strong>Right to Rectification:</strong> You have the right to
              request that we correct any information you believe is inaccurate.
            </li>
            <li>
              <strong>Right to Erasure:</strong> You have the right to request
              that we erase your personal data (&quot;Right to be
              Forgotten&quot;). This can be performed directly via the Settings
              page in the application.
            </li>
            <li>
              <strong>Right to Data Portability:</strong> You have the right to
              request that we transfer the data that we have collected to
              another organization, or directly to you.
            </li>
          </ul>
        </section>

        <section className="pt-8 border-t">
          <p className="text-base font-medium">
            If you have any questions about this Privacy Policy, please contact
            us at:
          </p>
          <p className="mt-2 text-primary">
            <a href="mailto:privacy@chuchube.com" className="hover:underline">
              privacy@chuchube.co
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;
