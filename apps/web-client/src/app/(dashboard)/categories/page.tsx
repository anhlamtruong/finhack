"use client";

import { useNewCategory } from "@/services/categories/hooks/use-new-category";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useDeleteCategories } from "@/services/categories/hooks/use-delete-categories";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Plus } from "lucide-react";

import { columns } from "./columns";

const CategoriesPage = () => {
  const { onOpen } = useNewCategory();

  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.getCategories.queryOptions());
  const { mutate: deleteCategories, isPending } = useDeleteCategories();
  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-16">
      <Card className=" border-none drop-shadow-sm">
        <CardHeader className=" gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className=" text-xl line-clamp-1">
            Categories Page
          </CardTitle>
          <Button onClick={onOpen} size={"sm"}>
            <Plus className="size-4 mr-2" />
            Add New Category
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            onDelete={(rows) => {
              const ids = rows.map((r) => r.original.id);
              deleteCategories({ ids });
            }}
            defaultFilterKey="name"
            columns={columns}
            data={data}
            disabled={isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoriesPage;
