import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DesignInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { fetchDesigns, createDesign } from "@/services/api";

export function useDesigns() {
  return useQuery({
    queryKey: [api.designs.list.path],
    queryFn: async () => {
      return await fetchDesigns();
    },
  });
}

export function useCreateDesign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: DesignInput) => {
      return await createDesign(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.designs.list.path] });
      toast({
        title: "Success!",
        description: "Your masterpiece has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
