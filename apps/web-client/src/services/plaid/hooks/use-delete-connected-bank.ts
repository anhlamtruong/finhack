import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { InferResponseType } from "hono";

import { client } from "@/lib/hono";
import { useInvalidatePlaidQueries } from "./use-invalidate-plaid-queries";

type ResponseType = InferResponseType<
  typeof client.api.plaid["connected-bank"]["$delete"],
  200
>;

export const useDeleteConnectedBank = () => {
  const { invalidateAll } = useInvalidatePlaidQueries();
  const mutation = useMutation<ResponseType, Error>({
    mutationFn: async () => {
      const response = await client.api.plaid["connected-bank"].$delete();
      console.log(response);
      if (!response.ok) {
        throw new Error("Failed to delete connected bank");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Connected bank deleted!");
      invalidateAll();
    },
    onError: () => {
      toast.error("Failed to delete connected bank");
    },
  });

  return mutation;
};
