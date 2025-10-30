import type {
  NitroFetchRequest,
  NitroFetchOptions,
  TypedInternalResponse,
  ExtractedRouteMethod,
} from 'nitropack/types'
import { FetchError } from 'ofetch'

type RevertFn<
  R extends NitroFetchRequest,
  T = unknown,
  O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
> = (
  success: boolean,
  data?:
    | TypedInternalResponse<
        R,
        T,
        NitroFetchOptions<R> extends O ? 'get' : ExtractedRouteMethod<R, O>
      >
    | undefined
) => Promise<void>

type SubmitOpts<
  R extends NitroFetchRequest,
  T = unknown,
  O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
> = {
  revert: RevertFn<R, T, O>
  successMsg?: string
  noSuccessToast?: boolean
}

/**
 * Универсальный хук отправки данных с уведомлениями и rollback-логикой.
 */
export function useSubmit<
  R extends NitroFetchRequest,
  O extends NitroFetchOptions<R>,
  T = unknown,
>(
  url: R,
  options: O,
  opts: SubmitOpts<R, T, O>,
): (data: unknown) => Promise<void> {
  const toast = useToast()
  let isSubmitting = false

  return async (data: unknown): Promise<void> => {
    if (isSubmitting) return
    isSubmitting = true

    try {
      const res = await $fetch<T>(url, { ...options, body: data })

      if (!opts.noSuccessToast) {
        toast.showToast({
          type: 'success',
          message: opts.successMsg ?? 'Успешно выполнено',
        })
      }

      await opts.revert(
        true,
        res as TypedInternalResponse<
          R,
          T,
          NitroFetchOptions<R> extends O ? 'get' : ExtractedRouteMethod<R, O>
        >,
      )
    } catch (e) {
      if (e instanceof FetchError) {
        toast.showToast({
          type: 'error',
          message: e.data?.message ?? e.message ?? 'Ошибка запроса',
        })
      } else if (e instanceof Error) {
        toast.showToast({
          type: 'error',
          message: e.message,
        })
      } else {
        console.error('[useSubmit] Unexpected error:', e)
        toast.showToast({
          type: 'error',
          message: 'Неизвестная ошибка',
        })
      }

      await opts.revert(false, undefined)
    } finally {
      isSubmitting = false
    }
  }
}
