import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Scale,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
} from "lucide-react";

const TermsPage = () => {
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
          Terms of Service
        </h1>
        <p className="text-lg text-muted-foreground">
          <strong>Effective Date:</strong> January 25, 2026
        </p>
        <p className="text-base text-foreground/80 leading-relaxed max-w-3xl">
          Welcome to FinHack Finance. By accessing or using our web
          application, dashboard, or AI-powered advisory tools, you agree to be
          bound by these Terms of Service (&quot;Terms&quot;). If you do not
          agree to these Terms, you must not access or use our services.
        </p>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-12 leading-relaxed text-foreground/80">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Scale className="size-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground m-0">
              1. Nature of Services (Not Financial Advice)
            </h3>
          </div>
          <div className="p-5 rounded-lg border bg-amber-500/10 border-amber-500/20">
            <div className="flex gap-3">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-foreground mb-1 mt-0 text-base">
                  Critical Disclaimer
                </h4>
                <p className="text-sm m-0 text-foreground/80">
                  FinHack Finance is a data visualization and tracking tool. We
                  are <strong>not</strong> a bank, financial planner, broker, or
                  tax advisor. The insights provided by our &quot;AI
                  Advisor&quot; are for informational and educational purposes
                  only and do not constitute professional financial advice.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4">
            You acknowledge that any financial decisions you make are your sole
            responsibility. We strongly recommend consulting with a qualified
            accountant or financial professional before making significant
            financial decisions based on data presented in this application.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="size-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground m-0">
              2. User Responsibilities & Data Accuracy
            </h3>
          </div>
          <p>
            To use FinHack Finance, you must be at least 18 years old. By using
            our services, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>
              <strong>Maintain Accuracy:</strong> You are responsible for the
              accuracy of the data you input, including CSV uploads and manual
              transactions. We are not liable for insights derived from
              incorrect user data.
            </li>
            <li>
              <strong>Secure Your Account:</strong> You are responsible for
              maintaining the confidentiality of your login credentials (managed
              via Clerk). You agree to notify us immediately of any unauthorized
              access.
            </li>
            <li>
              <strong>Lawful Use:</strong> You agree not to use the application
              for any unlawful purpose, including money laundering, fraud, or
              tax evasion.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            3. Intellectual Property Rights
          </h3>
          <p>
            While you retain full ownership of your personal financial data
            (&quot;User Content&quot;), the FinHack Finance application,
            including but not limited to its source code, theme engine, database
            architecture, logos, and UI design, is the exclusive property of
            FinHack Finance.
          </p>
          <p>
            You agree not to copy, modify, distribute, sell, or lease any part
            of our services, nor may you reverse engineer or attempt to extract
            the source code of that software.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="size-5 text-primary" />
            <h3 className="text-2xl font-bold text-foreground m-0">
              4. Limitation of Liability
            </h3>
          </div>
          <p>
            To the maximum extent permitted by law, FinHack Finance and its
            developers shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages, including without
            limitation:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>
              Loss of profits, data, use, goodwill, or other intangible losses.
            </li>
            <li>
              Financial losses resulting from decisions made based on
              AI-generated insights.
            </li>
            <li>
              Service interruptions, system failures, or data loss due to
              technical issues.
            </li>
          </ul>
          <p>
            Our services are provided on an &quot;AS IS&quot; and &quot;AS
            AVAILABLE&quot; basis without warranties of any kind, either express
            or implied.
          </p>
        </section>

        <section>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            5. Termination
          </h3>
          <p>
            We reserve the right to suspend or terminate your access to the
            application immediately, without prior notice or liability, for any
            reason whatsoever, including without limitation if you breach these
            Terms. Upon termination, your right to use the Service will cease
            immediately.
          </p>
        </section>

        <section>
          <h3 className="text-2xl font-bold text-foreground mb-4">
            6. Changes to Terms
          </h3>
          <p>
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. If a revision is material, we will try to
            provide at least 30 days&apos; notice prior to any new terms taking
            effect. What constitutes a material change will be determined at our
            sole discretion.
          </p>
        </section>

        <section className="pt-8 border-t">
          <p className="text-base font-medium">
            For questions regarding these Terms of Service, please contact us
            at:
          </p>
          <p className="mt-2 text-primary">
            <a href="mailto:legal@chuchube.com" className="hover:underline">
              legal@chuchube.co
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
