"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t py-12">
      <div className="container mx-auto px-4 sm:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} FinHack Finance. All rights reserved.
          </p>
        </div>

        <div className="flex gap-8">
          <Link
            href="/privacy-policy"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Privacy Policy
          </Link>

          <Link
            href="/terms-of-service"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Terms of Service
          </Link>

          <Dialog>
            <DialogTrigger asChild>
              <button className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Contact us
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Get in Touch</DialogTitle>
                <DialogDescription>
                  Have a question about your AI Advisor? Drop us a message.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    className="w-full p-2 rounded-md border bg-background"
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <textarea
                    className="w-full p-2 rounded-md border bg-background"
                    rows={4}
                    placeholder="How can we help?"
                  />
                </div>
                <Button className="w-full rounded-full">Send Message</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </footer>
  );
}
