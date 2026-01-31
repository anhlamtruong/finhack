import { useOpenCategory } from "@/services/categories/hooks/use-open-category";
import { useOpenTransaction } from "@/services/transactions/hooks/use-open-transaction"; // 1. Import this hook
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

type Props = {
  id: string;
  categoryName: string | null | undefined;
  categoryId: string | null | undefined;
};

export const CategoryColumn = ({ id, categoryName, categoryId }: Props) => {
  const { onOpen: onOpenCategory } = useOpenCategory();
  const { onOpen: onOpenTransaction } = useOpenTransaction();

  const onClick = () => {
    if (categoryId) {
      onOpenCategory(categoryId);
    } else {
      onOpenTransaction(id);
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center cursor-pointer hover:underline",
        !categoryName && "text-destructive",
      )}
    >
      {!categoryName && <TriangleAlert className="mr-2 size-4 shrink-0" />}
      {categoryName || "Uncategorized"}
    </div>
  );
};
