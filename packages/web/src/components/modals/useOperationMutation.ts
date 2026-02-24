import { useCallback,useState } from 'react';
import type { AnyVariables, DocumentInput } from 'urql';
import { useMutation } from 'urql';

export function useOperationMutation<TData, TVars extends AnyVariables>(
  mutation: DocumentInput<TData, TVars>,
  onClose: () => void,
) {
  const [, execute] = useMutation(mutation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (variables?: TVars) => {
    setLoading(true);
    setError(null);
    const result = await execute(variables ?? {} as TVars);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
    } else {
      onClose();
    }
  }, [execute, onClose]);

  return { loading, error, run };
}
