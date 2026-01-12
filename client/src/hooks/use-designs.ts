import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type DesignInput, type DesignResponse, type DesignsListResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useDesigns() {
  return useQuery({
    queryKey: [api.designs.list.path],
    queryFn: async () => {
      const res = await fetch(api.designs.list.path);
      if (!res.ok) throw new Error("Failed to fetch designs");
      return api.designs.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDesign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: DesignInput) => {
      // Validate input locally before sending (optional but good practice)
      const validated = api.designs.create.input.parse(data);
      
      const res = await fetch(api.designs.create.path, {
        method: api.designs.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.designs.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create design");
      }

      return api.designs.create.responses[201].parse(await res.json());
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
