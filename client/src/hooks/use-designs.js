import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { fetchDesigns, createDesign } from '@/services/api';

const DESIGNS_PATH = '/api/designs';

export function useDesigns() {
  return useQuery({
    queryKey: [DESIGNS_PATH],
    queryFn: async () => {
      return await fetchDesigns();
    }
  });
}

export function useCreateDesign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data) => {
      return await createDesign(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DESIGNS_PATH] });
      toast({
        title: 'Success!',
        description: 'Your masterpiece has been saved.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export default { useDesigns, useCreateDesign };
