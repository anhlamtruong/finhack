"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CompanionRenderer } from "@/services/ai-agent/components/companion-renderer";
import { useInvalidateCompanionQueries } from "@/services/ai-agent/hooks/use-invalidate-companion-queries";
import type {
  CompanionEvolutionStage,
  CompanionProfile,
} from "@/services/ai-agent/types/companion";

/**
 * Editable form fields for companion metadata.
 */
type CompanionFormValues = {
  name: string;
  archetype: string;
  prompt: string;
  tone: string;
  backstory: string;
  financialFocus: string;
};

/**
 * Detail view for editing and deleting a single companion.
 */
export function CompanionDetail() {
  const trpc = useTRPC();
  const router = useRouter();
  const { invalidateList } = useInvalidateCompanionQueries();
  const params = useParams();
  const companionId =
    typeof params?.id === "string" ? params.id : (params?.id?.[0] ?? "");
  const { data, isLoading } = useQuery({
    ...trpc.getCompanion.queryOptions({ id: companionId }),
    enabled: Boolean(companionId),
  });

  const form = useForm<CompanionFormValues>({
    defaultValues: {
      name: "",
      archetype: "",
      prompt: "",
      tone: "",
      backstory: "",
      financialFocus: "",
    },
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      name: data.name ?? "",
      archetype: data.archetype ?? "",
      prompt: data.prompt ?? "",
      tone: data.personality?.tone ?? "",
      backstory: data.personality?.backstory ?? "",
      financialFocus: data.personality?.financialFocus ?? "",
    });
  }, [data, form]);

  const updateMutation = useMutation(
    trpc.updateCompanion.mutationOptions({
      onSuccess: () => toast.success("Companion updated"),
      onError: (error) => toast.error(error.message || "Update failed"),
    }),
  );

  const deleteMutation = useMutation(
    trpc.deleteCompanion.mutationOptions({
      onSuccess: () => {
        toast.success("Companion deleted");
        invalidateList();
        router.push("/companions");
      },
      onError: (error) => toast.error(error.message || "Delete failed"),
    }),
  );

  if (!companionId) {
    return null;
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
        <div className="text-sm text-muted-foreground">
          Loading companion...
        </div>
      </div>
    );
  }

  const companionProfile: CompanionProfile = {
    ...data,
    evolutionStage: data.evolutionStage as CompanionEvolutionStage | undefined,
    dataHygiene: data.dataHygiene ?? undefined,
  };

  const onSave = form.handleSubmit((values) => {
    updateMutation.mutate({
      id: data.id,
      name: values.name.trim(),
      archetype: values.archetype.trim() || undefined,
      prompt: values.prompt.trim() || null,
      personality: {
        tone: values.tone.trim() || undefined,
        backstory: values.backstory.trim() || undefined,
        financialFocus: values.financialFocus.trim() || undefined,
      },
    });
  });

  const onDelete = () => {
    deleteMutation.mutate({ id: data.id });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            Manage companion metadata and view current status.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/companions">Back to list</Link>
        </Button>
      </div>

      <CompanionRenderer profile={companionProfile} showActions={false} />

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Edit companion metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="archetype"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Archetype</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Textarea {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="financialFocus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financial focus</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="backstory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Backstory</FormLabel>
                    <FormControl>
                      <Textarea {...field} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending
                        ? "Deleting..."
                        : "Delete companion"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete companion?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the companion and its history.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
