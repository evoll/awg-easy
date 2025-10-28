import type {
  NitroFetchRequest,
  NitroFetchOptions,
  TypedInternalResponse,
  ExtractedRouteMethod,
} from 'nitropack/types';
import { FetchError } from 'ofetch';

// Упрощённый тип для метода запроса (избегаем сложной условной логики)
type RequestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

// Тип для RevertFn с упрощённой типизацией
type RevertFn<
  R extends NitroFetchRequest,
  T = unknown,
  O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
> = (
  success: boolean,
  data: TypedInternalResponse<R, T, RequestMethod> | undefined
) => Promise<void>;

// Опции для useSubmit
type SubmitOpts<
  R extends NitroFetchRequest,
  T = unknown,
  O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
> = {
  revert: RevertFn<R, T, O>;
  successMsg?: string;
  noSuccessToast?: boolean;
};

/**
 * Хук для отправки HTTP-запросов с обработкой успеха/ошибок и показом тостов
 * @param url URL запроса
 * @param options Опции fetch
 * @param opts Дополнительные опции (revert, сообщения)
 * @returns Асинхронная функция для выполнения запроса
 */
export function useSubmit<
  R extends NitroFetchRequest,
  O extends NitroFetchOptions<R> & { body?: never },
  T = unknown,
>(url: R, options: O, opts: SubmitOpts<R, T, O>) {
  const toast = useToast();

  return async (data: T) => {
    try {
      // Явно указываем тип ответа
      const res = await $fetch<TypedInternalResponse<R, T, RequestMethod>>(url, {
        ...options,
        body: data,
      });

      // Показываем тост об успехе, если не отключено
      if (!opts.noSuccessToast) {
        toast.showToast({
          type: 'success',
          message: opts.successMsg ?? 'Request completed successfully',
        });
      }

      // Вызываем revert с успешным результатом
      await opts.revert(true, res);
    } catch (e) {
      let errorMessage: string;

      if (e instanceof FetchError) {
        errorMessage = e.data?.message ?? 'Fetch error occurred';
      } else if (e instanceof Error) {
        errorMessage = e.message;
      } else {
        console.error('Unexpected error in useSubmit:', e);
        errorMessage = 'An unexpected error occurred';
      }

      // Показываем тост об ошибке
      toast.showToast({
        type: 'error',
        message: errorMessage,
      });

      // Вызываем revert с ошибкой
      await opts.revert(false, undefined);
    }
  };
}
